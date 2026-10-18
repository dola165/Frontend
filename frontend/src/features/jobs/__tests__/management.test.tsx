import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JobManagement } from '../JobManagement';
import * as api from '../api';

vi.mock('../api', async original => ({ ...await original<typeof import('../api')>(), editJob: vi.fn(), closeJob: vi.fn(), reopenJob: vi.fn() }));
const job: api.Job = { id: 707, clubId: null, title: 'Synthetic owner07 trainer', description: 'Synthetic fixture for management tests.',
    status: 'OPEN', createdAt: '2026-10-18T00:00:00Z', version: 7, canManage: true, direction: 'OFFERING', category: 'COACHING', engagementType: 'PAID',
    applyMethod: 'EMAIL', applyTarget: 'owner07@example.test', hours: 'SESSIONS', pay: '50 GEL/session', licence: 'Self stated',
    poster: { kind: 'PERSON', id: 7, name: 'Synthetic owner07', city: 'Tbilisi', avatarUrl: null } };
const recoveryKey = 'gk-job-management:7:owner07-login:707';
beforeEach(() => { vi.resetAllMocks(); sessionStorage.clear(); localStorage.setItem('gk-session-id', 'owner07-login'); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Personal listing management', () => {
    it('edits saved content without sending owner, direction or recruitment identity', async () => {
        const saved = vi.fn(); vi.mocked(api.editJob).mockResolvedValue({ ...job, version: 8 });
        render(<JobManagement job={job} userId={7} onSaved={saved} />);
        fireEvent.click(screen.getByRole('button', { name: 'Edit listing' }));
        expect(screen.getByLabelText('Title')).toHaveValue(job.title);
        fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Synthetic owner07 edited' } });
        fireEvent.change(screen.getByLabelText('Where'), { target: { value: 'Batumi' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
        await waitFor(() => expect(saved).toHaveBeenCalledOnce());
        expect(api.editJob).toHaveBeenCalledWith(job.id, expect.objectContaining({ expectedVersion: 7, title: 'Synthetic owner07 edited', city: 'Batumi', requestId: expect.any(String) }));
        const input = vi.mocked(api.editJob).mock.calls[0][1];
        expect(input).not.toHaveProperty('direction'); expect(input).not.toHaveProperty('posterKind'); expect(input).not.toHaveProperty('requiredRole');
        expect(sessionStorage.length).toBe(0);
    });
    it('keeps the exact uncertain edit across reload even when server readback advanced', async () => {
        vi.mocked(api.editJob).mockRejectedValueOnce(new Error('Lost response')).mockResolvedValueOnce({ ...job, version: 8 });
        const saved = vi.fn(); const view = render(<JobManagement job={job} userId={7} onSaved={saved} />);
        fireEvent.click(screen.getByRole('button', { name: 'Edit listing' }));
        fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Synthetic owner07 uncertain edit' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
        await screen.findByRole('alert'); const first = vi.mocked(api.editJob).mock.calls[0][1];
        view.unmount(); render(<JobManagement job={{ ...job, version: 8 }} userId={7} onSaved={saved} />);
        expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Check previous change' }));
        await waitFor(() => expect(saved).toHaveBeenCalledOnce());
        expect(vi.mocked(api.editJob).mock.calls[1][1]).toEqual(first);
    });
    it('retains typed answers on conflict and requires review before a new versioned save', async () => {
        vi.mocked(api.editJob).mockRejectedValueOnce({ response: { status: 409 } }).mockResolvedValueOnce({ ...job, version: 9 });
        const saved = vi.fn(); const view = render(<JobManagement job={job} userId={7} onSaved={saved} />);
        fireEvent.click(screen.getByRole('button', { name: 'Edit listing' }));
        fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Keep my typed answer' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
        await waitFor(() => expect(saved).toHaveBeenCalledOnce());
        view.rerender(<JobManagement job={{ ...job, version: 8, title: 'Newer saved title' }} userId={7} onSaved={saved} />);
        expect(screen.getByLabelText('Title')).toHaveValue('Keep my typed answer');
        expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
        expect(screen.getByText(/Latest listing: Newer saved title/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Use latest version' }));
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
        await waitFor(() => expect(api.editJob).toHaveBeenCalledTimes(2));
        const [first, second] = vi.mocked(api.editJob).mock.calls.map(call => call[1]);
        expect(second).toMatchObject({ expectedVersion: 8, title: 'Keep my typed answer' }); expect(second.requestId).not.toBe(first.requestId);
    });
    it('retries an uncertain close using the original version after reload, then permits reopen', async () => {
        vi.mocked(api.closeJob).mockRejectedValueOnce(new Error('Lost response')).mockResolvedValueOnce({ ...job, status: 'CLOSED', version: 8 });
        const saved = vi.fn(); const view = render(<JobManagement job={job} userId={7} onSaved={saved} />);
        fireEvent.click(screen.getByRole('button', { name: 'Close listing' }));
        await screen.findByRole('alert'); const first = vi.mocked(api.closeJob).mock.calls[0];
        view.unmount(); const closed = { ...job, status: 'CLOSED' as const, version: 8 };
        render(<JobManagement job={closed} userId={7} onSaved={saved} />);
        expect(screen.queryByRole('button', { name: 'Reopen listing' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Check previous change' }));
        await waitFor(() => expect(saved).toHaveBeenCalledOnce()); expect(vi.mocked(api.closeJob).mock.calls[1]).toEqual(first);
        vi.mocked(api.reopenJob).mockResolvedValue({ ...job, version: 9 });
        fireEvent.click(screen.getByRole('button', { name: 'Reopen listing' }));
        await waitFor(() => expect(api.reopenJob).toHaveBeenCalledWith(job.id, { expectedVersion: 8, requestId: expect.any(String) }));
    });
    it('edits a closed listing without reopening and validates the contact method', async () => {
        vi.mocked(api.editJob).mockResolvedValue({ ...job, status: 'CLOSED', version: 8 });
        render(<JobManagement job={{ ...job, status: 'CLOSED' }} userId={7} onSaved={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: 'Edit listing' }));
        expect(screen.getByText('Saving edits keeps this listing closed. Reopen it when you are ready.')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Contact method'), { target: { value: 'LINK' } });
        fireEvent.change(screen.getByLabelText('Contact'), { target: { value: 'http://example.test' } });
        expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
        fireEvent.change(screen.getByLabelText('Contact'), { target: { value: 'https://example.test' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
        await waitFor(() => expect(api.editJob).toHaveBeenCalledOnce()); expect(api.reopenJob).not.toHaveBeenCalled();
    });
    it('retries an uncertain reopen with its original closed version after reload', async () => {
        vi.mocked(api.reopenJob).mockRejectedValueOnce(new Error('Lost reopen response')).mockResolvedValueOnce({ ...job, version: 9 });
        const saved = vi.fn(); const view = render(<JobManagement job={{ ...job, status: 'CLOSED', version: 8 }} userId={7} onSaved={saved} />);
        fireEvent.click(screen.getByRole('button', { name: 'Reopen listing' })); await screen.findByRole('alert');
        const first = vi.mocked(api.reopenJob).mock.calls[0][1];
        view.unmount(); render(<JobManagement job={{ ...job, version: 9 }} userId={7} onSaved={saved} />);
        fireEvent.click(screen.getByRole('button', { name: 'Check previous change' }));
        await waitFor(() => expect(saved).toHaveBeenCalledOnce());
        expect(vi.mocked(api.reopenJob).mock.calls[1][1]).toEqual(first);
    });
    it('does not show controls after current ownership is lost', () => {
        render(<JobManagement job={{ ...job, canManage: false }} userId={7} onSaved={vi.fn()} />);
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
    it('keeps typed answers and dispatches nothing when pending recovery cannot be stored', async () => {
        const saved = vi.fn(); render(<JobManagement job={job} userId={7} onSaved={saved} />);
        fireEvent.click(screen.getByRole('button', { name: 'Edit listing' }));
        fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Preserve this unsent answer' } });
        const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('This attempt was not sent');
        expect(api.editJob).not.toHaveBeenCalled(); expect(saved).not.toHaveBeenCalled();
        expect(screen.getByLabelText('Title')).toHaveValue('Preserve this unsent answer');
        expect(JSON.parse(sessionStorage.getItem(recoveryKey)!).pending).toBeUndefined();
        storage.mockRestore(); vi.mocked(api.editJob).mockResolvedValue({ ...job, version: 8 });
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
        await waitFor(() => expect(saved).toHaveBeenCalledOnce());
        expect(api.editJob).toHaveBeenCalledTimes(1);
    });
    it.each([403, 404])('keeps the exact uncertain request through HTTP%s and another reload', async code => {
        vi.mocked(api.closeJob).mockRejectedValueOnce(new Error('Lost response'))
            .mockRejectedValueOnce({ response: { status: code } }).mockResolvedValueOnce({ ...job, status: 'CLOSED', version: 8 });
        const saved = vi.fn(); const firstView = render(<JobManagement job={job} userId={7} onSaved={saved} />);
        fireEvent.click(screen.getByRole('button', { name: 'Close listing' })); await screen.findByRole('alert');
        const first = vi.mocked(api.closeJob).mock.calls[0]; firstView.unmount();
        const secondView = render(<JobManagement job={{ ...job, status: 'CLOSED', version: 8 }} userId={7} onSaved={saved} />);
        fireEvent.click(screen.getByRole('button', { name: 'Check previous change' })); await screen.findByRole('alert');
        expect(saved).not.toHaveBeenCalled();
        expect(JSON.parse(sessionStorage.getItem(recoveryKey)!).pending.input).toEqual({ expectedVersion: first[1], requestId: first[2] });
        expect(screen.queryByRole('button', { name: 'Reopen listing' })).not.toBeInTheDocument(); secondView.unmount();
        render(<JobManagement job={{ ...job, status: 'CLOSED', version: 8 }} userId={7} onSaved={saved} />);
        fireEvent.click(screen.getByRole('button', { name: 'Check previous change' }));
        await waitFor(() => expect(saved).toHaveBeenCalledOnce());
        expect(vi.mocked(api.closeJob).mock.calls).toEqual([first, first, first]);
    });
    it.each(['success', 'failure'] as const)('keeps the replacement visit recovery after an unmounted %s', async outcome => {
        let finishFirst!: () => void, finishSecond!: (value: api.Job) => void;
        vi.mocked(api.closeJob).mockImplementationOnce(() => new Promise((resolve, reject) => {
            finishFirst = () => outcome === 'success' ? resolve({ ...job, status: 'CLOSED', version: 8 }) : reject(new Error('Retired visit failure'));
        })).mockImplementationOnce(() => new Promise(resolve => { finishSecond = resolve; }));
        const oldSaved = vi.fn(), newSaved = vi.fn();
        const oldView = render(<JobManagement job={job} userId={7} onSaved={oldSaved} />);
        fireEvent.click(screen.getByRole('button', { name: 'Close listing' })); oldView.unmount();
        render(<JobManagement job={{ ...job, status: 'CLOSED', version: 8 }} userId={7} onSaved={newSaved} />);
        fireEvent.click(screen.getByRole('button', { name: 'Check previous change' }));
        const recovery = sessionStorage.getItem(recoveryKey);
        await act(async () => finishFirst());
        expect(sessionStorage.getItem(recoveryKey)).toBe(recovery); expect(oldSaved).not.toHaveBeenCalled(); expect(newSaved).not.toHaveBeenCalled();
        expect(screen.queryByText('Retired visit failure')).not.toBeInTheDocument();
        await act(async () => finishSecond({ ...job, status: 'CLOSED', version: 8 }));
        expect(newSaved).toHaveBeenCalledOnce(); expect(sessionStorage.getItem(recoveryKey)).toBeNull();
    });
    it('does not erase a newer persisted draft when an older mounted response finishes', async () => {
        let finishOld!: (value: api.Job) => void;
        vi.mocked(api.closeJob).mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }))
            .mockResolvedValueOnce({ ...job, status: 'CLOSED', version: 8 });
        const oldSaved = vi.fn(), newSaved = vi.fn();
        const oldView = render(<JobManagement job={job} userId={7} onSaved={oldSaved} />);
        fireEvent.click(within(oldView.container).getByRole('button', { name: 'Close listing' }));
        const newView = render(<JobManagement job={{ ...job, status: 'CLOSED', version: 8 }} userId={7} onSaved={newSaved} />);
        fireEvent.click(within(newView.container).getByRole('button', { name: 'Check previous change' }));
        await waitFor(() => expect(newSaved).toHaveBeenCalledOnce());
        fireEvent.click(within(newView.container).getByRole('button', { name: 'Edit listing' }));
        fireEvent.change(within(newView.container).getByLabelText('Title'), { target: { value: 'New visit draft must survive' } });
        const replacement = sessionStorage.getItem(recoveryKey);
        await act(async () => finishOld({ ...job, status: 'CLOSED', version: 8 }));
        expect(oldSaved).not.toHaveBeenCalled(); expect(sessionStorage.getItem(recoveryKey)).toBe(replacement);
        expect(within(newView.container).getByLabelText('Title')).toHaveValue('New visit draft must survive');
    });
    it('keeps recovery isolated from another login and suppresses the old response', async () => {
        let resolve!: (result: api.Job) => void;
        vi.mocked(api.closeJob).mockReturnValue(new Promise(done => { resolve = done; }));
        const saved = vi.fn(); const view = render(<JobManagement job={job} userId={7} onSaved={saved} />);
        fireEvent.click(screen.getByRole('button', { name: 'Close listing' }));
        localStorage.setItem('gk-session-id', 'different-login'); view.unmount();
        render(<JobManagement job={job} userId={7} onSaved={saved} />);
        expect(screen.queryByRole('button', { name: 'Check previous change' })).not.toBeInTheDocument();
        resolve({ ...job, status: 'CLOSED', version: 8 });
        await waitFor(() => expect(screen.getByRole('button', { name: 'Edit listing' })).toBeInTheDocument());
        expect(saved).not.toHaveBeenCalled();
    });
});
