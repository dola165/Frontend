import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../api';
import { useCampaignCommand } from '../useCampaignCommand';

vi.mock('../api', async original => ({ ...await original<typeof import('../api')>(), createCampaign: vi.fn(), editCampaign: vi.fn(), changeCampaignState: vi.fn(), postCampaignUpdate: vi.fn() }));
const input: api.CampaignInput = { title: 'Synthetic project', summary: 'Test only', description: 'No funds received', beneficiary: 'Synthetic adults', useOfFunds: '', category: 'COMMUNITY', currency: 'GEL', goalAmount: null, reportedAmount: null, reportedNote: '', startsOn: null, endsOn: null, images: [] };
const campaign: api.Campaign = { ...input, id: 90, clubId: 10, clubName: 'Synthetic FC', version: 2, status: 'PUBLISHED', phase: 'ACTIVE', reportedAt: null, publishedAt: '2026-10-18T00:00:00Z', updatedAt: '', updates: [] };
const marker = 'gk-campaign-command:owner-a:1:10';

beforeEach(() => {
    vi.resetAllMocks(); localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('gk-session-id', 'owner-a'); localStorage.setItem('userId', '1');
    vi.mocked(api.createCampaign).mockResolvedValue(campaign);
    vi.mocked(api.editCampaign).mockResolvedValue(campaign);
    vi.mocked(api.changeCampaignState).mockResolvedValue(campaign);
    vi.mocked(api.postCampaignUpdate).mockResolvedValue(campaign);
});

describe('Campaign command recovery', () => {
    it('persists the original creation before dispatch and replays the same request after reload', async () => {
        vi.mocked(api.createCampaign).mockImplementationOnce(async () => {
            expect(JSON.parse(sessionStorage.getItem(marker)!)).toMatchObject({ command: { kind: 'create', input } });
            throw new Error('Response lost');
        });
        const done = vi.fn(); const first = renderHook(() => useCampaignCommand(10, done));
        await act(async () => first.result.current.send({ kind: 'create', input }));
        const key = vi.mocked(api.createCampaign).mock.calls[0][2];
        first.unmount();
        const second = renderHook(() => useCampaignCommand(10, done));
        expect(api.createCampaign).toHaveBeenCalledTimes(1); // Recovery is explicit.
        await act(async () => second.result.current.send({ kind: 'create', input: { ...input, title: 'Changed form' } }));
        expect(api.createCampaign).toHaveBeenLastCalledWith(10, input, key);
        expect(done).toHaveBeenCalledWith(campaign); expect(sessionStorage.getItem(marker)).toBeNull();
    });

    it('retries an update using the original version and text and returns the current closed record', async () => {
        vi.mocked(api.postCampaignUpdate).mockRejectedValueOnce(new Error('Response lost')).mockResolvedValue({ ...campaign, status: 'CLOSED', version: 5 });
        const done = vi.fn();const hook = renderHook(() => useCampaignCommand(10, done));
        await act(async () => hook.result.current.send({ kind: 'update', campaign, title: 'Plan', body: 'No funds received' }));
        const key = vi.mocked(api.postCampaignUpdate).mock.calls[0][4];
        await act(async () => hook.result.current.send());
        expect(api.postCampaignUpdate).toHaveBeenLastCalledWith(10, campaign, 'Plan', 'No funds received', key);
        expect(done).toHaveBeenCalledWith(expect.objectContaining({ status: 'CLOSED', version: 5 }));
    });

    it('retains the reviewed state version across a lost reply', async () => {
        vi.mocked(api.changeCampaignState).mockRejectedValueOnce(new Error('Response lost'));
        const hook = renderHook(() => useCampaignCommand(10, vi.fn()));
        await act(async () => hook.result.current.send({ kind: 'state', campaign, status: 'PAUSED' }));
        const key = vi.mocked(api.changeCampaignState).mock.calls[0][3];
        await act(async () => hook.result.current.send());
        expect(api.changeCampaignState).toHaveBeenLastCalledWith(10, campaign, 'PAUSED', key);
    });

    it('keeps stale edit rejection visible and allows a corrected command without claiming success', async () => {
        vi.mocked(api.editCampaign).mockRejectedValueOnce({ response: { status: 409, data: { detail: 'Review the changed campaign.' } } });
        const done = vi.fn();const hook = renderHook(() => useCampaignCommand(10, done));
        await act(async () => hook.result.current.send({ kind: 'edit', id: 90, input: { ...input, version: 2 } }));
        expect(hook.result.current.attempt).toBeNull();expect(hook.result.current.error).toBe('Review the changed campaign.');
        expect(done).not.toHaveBeenCalled();expect(sessionStorage.getItem(marker)).toBeNull();
    });

    it('isolates club/account/session and ignores a late completion from a retired session', async () => {
        let finish!: (value: api.Campaign) => void;
        vi.mocked(api.createCampaign).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        const done = vi.fn();const first = renderHook(() => useCampaignCommand(10, done));
        let task!: Promise<void>;
        act(() => { task = first.result.current.send({ kind: 'create', input }); });
        const otherClub = renderHook(() => useCampaignCommand(11, vi.fn()));expect(otherClub.result.current.attempt).toBeNull();
        localStorage.setItem('gk-session-id', 'owner-b');localStorage.setItem('userId', '2');
        const otherAccount = renderHook(() => useCampaignCommand(10, vi.fn()));expect(otherAccount.result.current.attempt).toBeNull();
        await act(async () => { finish(campaign);await task; });expect(done).not.toHaveBeenCalled();
        expect(sessionStorage.getItem(marker)).not.toBeNull();
    });

    it('rejects duplicate submissions while the first request is in flight', async () => {
        let finish!: (value: api.Campaign) => void;
        vi.mocked(api.createCampaign).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        const hook = renderHook(() => useCampaignCommand(10, vi.fn()));let task!: Promise<void>;
        act(() => { task = hook.result.current.send({ kind: 'create', input }); });
        await act(async () => hook.result.current.send({ kind: 'create', input }));expect(api.createCampaign).toHaveBeenCalledTimes(1);
        await act(async () => { finish(campaign);await task; });
    });

    it('refuses to send if recovery storage is unavailable', async () => {
        const hook = renderHook(() => useCampaignCommand(10, vi.fn()));
        const blocked = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked'); });
        await act(async () => hook.result.current.send({ kind: 'create', input }));blocked.mockRestore();
        expect(api.createCampaign).not.toHaveBeenCalled();expect(hook.result.current.error).toContain('not been sent');
    });

    it('keeps the original command when a successful reply cannot identify its saved record', async () => {
        vi.mocked(api.editCampaign).mockResolvedValueOnce({ ...campaign, id: 91 });
        const done = vi.fn();const hook = renderHook(() => useCampaignCommand(10, done));
        await act(async () => hook.result.current.send({ kind: 'edit', id: 90, input: { ...input, version: 2 } }));
        expect(done).not.toHaveBeenCalled();expect(hook.result.current.attempt?.command.kind).toBe('edit');
        expect(sessionStorage.getItem(marker)).not.toBeNull();
    });

    it('keeps an unknown creation identity through a permission denial until original recovery succeeds', async () => {
        vi.mocked(api.createCampaign).mockRejectedValueOnce(new Error('Response lost'))
            .mockRejectedValueOnce({ response: { status: 403, data: { detail: 'Current authority required.' } } })
            .mockResolvedValue({ ...campaign, status: 'CLOSED', version: 5 });
        const done = vi.fn();const hook = renderHook(() => useCampaignCommand(10, done));
        await act(async () => hook.result.current.send({ kind: 'create', input }));
        const key = hook.result.current.attempt?.key;
        await act(async () => hook.result.current.send());
        expect(hook.result.current.attempt?.key).toBe(key);expect(done).not.toHaveBeenCalled();
        await act(async () => hook.result.current.send());
        expect(api.createCampaign).toHaveBeenLastCalledWith(10, input, key);
        expect(done).toHaveBeenCalledWith(expect.objectContaining({ id: 90, status: 'CLOSED' }));
    });
});
