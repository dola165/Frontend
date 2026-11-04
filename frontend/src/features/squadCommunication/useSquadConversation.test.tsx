import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FormEvent } from 'react';
import { useSquadConversation } from './useSquadConversation';
import * as api from './api';

const state = vi.hoisted(() => ({ session: 'A', copy: (en: string) => en }));
vi.mock('./journeyCopy', () => ({ useJourneyCopy: () => state.copy }));
vi.mock('../../utils/authStorage', () => ({ getAuthSessionId: () => state.session,
    getStoredUserId: () => '7', isCurrentAuthSession: (session: string) => session === state.session }));
vi.mock('./api', () => ({ messages: vi.fn(), postMessage: vi.fn(), markRead: vi.fn() }));
const deferred = <T,>() => { let resolve!: (value: T) => void; let reject!: (error: unknown) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const message = (id: number): api.SquadMessage => ({ id, author_id: 8, author_name: 'Coach', thread_user_id: null,
    kind: 'CHAT', title: null, body: `Message ${id}`, important: false, created_at: '2026-10-30T09:00:00Z',
    acknowledgement_requested: false, acknowledged_at: null });
const page = (latest: number, size = 50) => Array.from({ length: size }, (_, n) => message(latest - n));
const form = { preventDefault: vi.fn() } as unknown as FormEvent;
const space = { id: 11, viewer_id: 7 } as api.SquadOverview;
const follow = { current: true };
const mount = (thread: number | null = null, readOnly = false) => renderHook(() => useSquadConversation({
    space, kind: 'CHAT', thread, room: null, readOnly, onSent: vi.fn(), follow,
}));

beforeEach(() => {
    vi.resetAllMocks(); state.session = 'A'; sessionStorage.clear(); follow.current = true;
    vi.mocked(api.messages).mockResolvedValue([]); vi.mocked(api.markRead).mockResolvedValue({} as never);
});

describe('squad conversation continuity', () => {
    it('keeps a draft and the uncertain request ID after leaving and returning', async () => {
        let view = mount();
        await waitFor(() => expect(view.result.current.loading).toBe(false));
        act(() => view.result.current.setBody('Pick up at the north gate'));
        vi.mocked(api.postMessage).mockRejectedValueOnce(new Error('reply lost'));
        await act(async () => { await view.result.current.send(form); });
        const key = vi.mocked(api.postMessage).mock.calls[0][1].requestId;
        expect(view.result.current.body).toBe('Pick up at the north gate');
        view.unmount(); view = mount();
        await waitFor(() => expect(view.result.current.loading).toBe(false));
        expect(view.result.current.body).toBe('Pick up at the north gate');
        vi.mocked(api.postMessage).mockResolvedValueOnce({ data: { id: 20 } } as never);
        await act(async () => { await view.result.current.send(form); });
        expect(api.postMessage).toHaveBeenLastCalledWith(11, expect.objectContaining({ requestId: key, body: 'Pick up at the north gate' }));
        expect(view.result.current.body).toBe('');
    });

    it('keeps a newer draft when the earlier message is acknowledged', async () => {
        const request = deferred<never>();
        vi.mocked(api.postMessage).mockReturnValue(request.promise);
        const view = mount();
        act(() => view.result.current.setBody('First message'));
        act(() => { void view.result.current.send(form); });
        act(() => view.result.current.setBody('New draft'));
        await act(async () => request.resolve({ data: { id: 8 } } as never));
        expect(view.result.current.body).toBe('New draft');
    });

    it('requires a server message ID and durable retry receipt before clearing or dispatching', async () => {
        const view = mount();
        act(() => view.result.current.setBody('Keep me'));
        vi.mocked(api.postMessage).mockResolvedValue({ data: {} } as never);
        await act(async () => { await view.result.current.send(form); });
        expect(view.result.current.body).toBe('Keep me');
        const key = vi.mocked(api.postMessage).mock.calls[0][1].requestId;
        await act(async () => { await view.result.current.send(form); });
        expect(vi.mocked(api.postMessage).mock.calls[1][1].requestId).toBe(key);
        const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('storage unavailable'); });
        await act(async () => { await view.result.current.send(form); });
        expect(api.postMessage).toHaveBeenCalledTimes(2);
        storage.mockRestore();
    });

    it('separates squad group, family thread and a new login, discarding retired replies', async () => {
        let view = mount(); act(() => view.result.current.setBody('Group draft')); view.unmount();
        view = mount(7); expect(view.result.current.body).toBe('');
        act(() => view.result.current.setBody('Family draft')); view.unmount();
        view = mount(); expect(view.result.current.body).toBe('Group draft'); view.unmount();
        const history = deferred<api.SquadMessage[]>();
        vi.mocked(api.messages).mockReturnValue(history.promise);
        view = mount(); state.session = 'B';
        await act(async () => history.resolve([message(9)]));
        view.rerender(); expect(view.result.current.rows).toEqual([]); expect(view.result.current.body).toBe('');
        await act(async () => { await view.result.current.send(form); });
        expect(api.postMessage).not.toHaveBeenCalled();
        view.unmount(); view = mount(); expect(view.result.current.body).toBe('');
    });

    it('revocation clears history and retires concurrent older pages and send acknowledgements', async () => {
        vi.mocked(api.messages).mockResolvedValueOnce(page(100));
        const view = mount();
        await waitFor(() => expect(view.result.current.rows).toHaveLength(50));
        const older = deferred<api.SquadMessage[]>(), send = deferred<never>();
        vi.mocked(api.messages).mockReturnValueOnce(older.promise).mockRejectedValueOnce({ response: { status: 403 } });
        vi.mocked(api.postMessage).mockReturnValueOnce(send.promise);
        act(() => view.result.current.setBody('Private draft'));
        act(() => { void view.result.current.loadOlder(); void view.result.current.send(form); });
        await act(async () => { await view.result.current.refresh(); });
        expect(view.result.current.unavailable).toBe(true); expect(view.result.current.rows).toEqual([]);
        await act(async () => { older.resolve(page(50)); send.resolve({ data: { id: 101 } } as never); });
        expect(view.result.current.rows).toEqual([]); expect(view.result.current.body).toBe('Private draft');
        await act(async () => { await view.result.current.send(form); });
        expect(api.postMessage).toHaveBeenCalledTimes(1);
    });

    it('backfills a reconnect gap before marking the newest history read', async () => {
        vi.mocked(api.messages).mockResolvedValueOnce([message(1)]);
        const view = mount();
        await waitFor(() => expect(view.result.current.rows).toHaveLength(1));
        vi.mocked(api.messages).mockResolvedValueOnce(page(121)).mockResolvedValueOnce(page(71)).mockResolvedValueOnce(page(21, 21));
        await act(async () => { await view.result.current.refresh(); });
        expect(view.result.current.rows).toHaveLength(121);
        expect(api.messages).toHaveBeenCalledWith(11, 'CHAT', null, expect.any(AbortSignal), 72, null);
        expect(api.messages).toHaveBeenCalledWith(11, 'CHAT', null, expect.any(AbortSignal), 22, null);
        expect(api.markRead).toHaveBeenLastCalledWith(11, 121, null, null);
    });

    it('does not claim a read while scrolled away, and stops offering exhausted history', async () => {
        follow.current = false;
        vi.mocked(api.messages).mockResolvedValueOnce(page(100)).mockResolvedValueOnce(page(50, 3));
        const view = mount();
        await waitFor(() => expect(view.result.current.hasOlder).toBe(true));
        await act(async () => { await view.result.current.loadOlder(); });
        expect(view.result.current.hasOlder).toBe(false); expect(api.markRead).not.toHaveBeenCalled();
    });

    it('a chat nobody may write in for now sends nothing', async () => {
        const view = mount(9, true);
        act(() => view.result.current.setBody('Attempt'));
        await act(async () => { await view.result.current.send(form); });
        expect(api.postMessage).not.toHaveBeenCalled();
        expect(api.messages).toHaveBeenCalledWith(11, 'CHAT', 9, expect.any(AbortSignal), undefined, null);
    });

    it('cancels outstanding history on leaving and recovers a failed load on explicit retry', async () => {
        vi.mocked(api.messages).mockRejectedValueOnce(new Error('temporarily offline')).mockResolvedValueOnce([message(4)]);
        const view = mount();
        await waitFor(() => expect(view.result.current.error).not.toBe(''));
        await act(async () => { await view.result.current.refresh(); });
        expect(view.result.current.rows).toEqual([message(4)]); expect(view.result.current.error).toBe('');
        const signal = vi.mocked(api.messages).mock.calls[0][3]!;
        view.unmount(); expect(signal.aborted).toBe(true);
    });
});
