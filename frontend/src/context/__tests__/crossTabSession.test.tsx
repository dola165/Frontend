import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { AuthProvider, useAuth } from '../AuthContext';
import { AuthSessionBoundary } from '../AuthSessionBoundary';
import { apiClient } from '../../api/axiosConfig';
import { getAuthSessionId, getStoredAccessToken, setStoredAccessToken, setRefreshedAccessToken } from '../../utils/authStorage';
import { CommerceDraftContext, useCommerceDraftState, useScopedDraftStore } from '../../components/workspace/commerceDraftState';

const profile = (token: string | null) => HttpResponse.json({ id: token === 'Bearer B' ? 2 : 1,
    fullName: token === 'Bearer B' ? 'Bravo' : 'Alpha', profileComplete: true, emailVerified: true });
const writes = vi.fn(({ request }: { request: Request }) => HttpResponse.json({ id: 10, authorization: request.headers.get('Authorization') }));
const refresh = vi.fn(() => new HttpResponse(null, { status: 401 }));
const profiles = vi.fn(({ request }: { request: Request }) => profile(request.headers.get('Authorization')));
const server = setupServer(
    http.get('*/auth/csrf', () => HttpResponse.json({ headerName: 'X-XSRF-TOKEN', token: 'csrf' })),
    http.get('*/users/me', profiles), http.post('*/posts', writes), http.post('*/auth/refresh', refresh),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); setStoredAccessToken('A'); });
afterEach(() => { cleanup(); server.resetHandlers(); });
let auth!: ReturnType<typeof useAuth>;
const unmounted = vi.fn();
function Probe() {
    const current = useAuth();
    useEffect(() => { auth = current; }, [current]);
    return <output>{current.status}:{current.user?.fullName ?? '-'}</output>;
}
function Draft() {
    const [draft, setDraft] = useCommerceDraftState('form:text', '');
    return <input aria-label="Workspace draft" value={draft} onChange={e => setDraft(e.target.value)} />;
}
function Shell() {
    const [draft, setDraft] = useState('');
    const { store } = useScopedDraftStore(10, 'store');
    useEffect(() => () => { unmounted(); }, []);
    return <><input aria-label="Post draft" value={draft} onChange={e => setDraft(e.target.value)} />
        <CommerceDraftContext.Provider value={store}><Draft /></CommerceDraftContext.Provider></>;
}
async function start() {
    render(<AuthProvider><Probe /><AuthSessionBoundary><Shell /></AuthSessionBoundary></AuthProvider>);
    await screen.findByText('authenticated:Alpha');
    fireEvent.change(screen.getByLabelText('Post draft'), { target: { value: 'Alpha post' } });
    fireEvent.change(screen.getByLabelText('Workspace draft'), { target: { value: 'Alpha workspace' } });
}
// Storage writes in another document do not fire this tab's custom event.
function otherTab(token: string | null, notify = true) {
    const id = crypto.randomUUID();
    if (token) localStorage.setItem(`gk-session-token:${id}`, token);
    localStorage.setItem('gk-session-id', id);
    if (token) localStorage.setItem('accessToken', token);
    else { localStorage.removeItem('accessToken'); localStorage.removeItem('userId'); localStorage.removeItem('user'); }
    if (notify) window.dispatchEvent(new StorageEvent('storage', { key: 'gk-session-id', newValue: id, storageArea: localStorage }));
    return id;
}
function latch() {
    let release!: () => void;
    const promise = new Promise<void>(resolve => { release = resolve; });
    return { promise, release };
}

it('blocks a stale-screen write and logout before the storage event is delivered', async () => {
    await start();
    otherTab('B', false);
    expect(screen.getByText('authenticated:Alpha')).toBeVisible();
    await expect(apiClient.post('/posts', { content: 'Alpha post' })).rejects.toMatchObject({ code: 'AUTH_SESSION_CHANGED' });
    await expect(auth.logout()).rejects.toMatchObject({ code: 'AUTH_SESSION_CHANGED' });
    expect(writes).not.toHaveBeenCalled(); expect(getStoredAccessToken()).toBe('B');
    await act(async () => { window.dispatchEvent(new Event('storage')); });
    await screen.findByText('authenticated:Bravo');
});

it('removes the old shell while B loads, then starts B with empty account drafts and B credentials', async () => {
    await start(); const started = latch(), finish = latch();
    server.use(http.get('*/users/me', async ({ request }) => { started.release(); await finish.promise; return profile(request.headers.get('Authorization')); }));
    await act(async () => { otherTab('B'); await started.promise; });
    expect(screen.getByText('bootstrapping:-')).toBeVisible();
    expect(screen.queryByLabelText('Post draft')).toBeNull(); expect(unmounted).toHaveBeenCalledTimes(1);
    await expect(apiClient.post('/posts', { content: 'old callback' })).rejects.toMatchObject({ code: 'AUTH_SESSION_CHANGED' });
    await act(async () => { finish.release(); });
    await screen.findByText('authenticated:Bravo');
    expect(screen.getByLabelText('Post draft')).toHaveValue(''); expect(screen.getByLabelText('Workspace draft')).toHaveValue('');
    await apiClient.post('/posts', { content: 'Bravo post' });
    expect(writes.mock.calls[0][0].request.headers.get('Authorization')).toBe('Bearer B');
});

it('adopts remote logout without refreshing or rotating its marker', async () => {
    await start(); let logoutId!: string;
    await act(async () => { logoutId = otherTab(null); });
    await screen.findByText('anonymous:-');
    expect(getAuthSessionId()).toBe(logoutId); expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Post draft')).toHaveValue('');
    expect(screen.getByLabelText('Workspace draft')).toHaveValue('');
});

it('preserves mounted drafts and identity on same-session token renewal and unrelated storage events', async () => {
    await start(); const id = getAuthSessionId(); const count = profiles.mock.calls.length;
    await act(async () => {
        setRefreshedAccessToken('A-renewed', id);
        window.dispatchEvent(new StorageEvent('storage', { key: 'theme', newValue: 'dark' }));
    });
    expect(screen.getByText('authenticated:Alpha')).toBeVisible(); expect(unmounted).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Post draft')).toHaveValue('Alpha post');
    expect(screen.getByLabelText('Workspace draft')).toHaveValue('Alpha workspace');
    expect(profiles).toHaveBeenCalledTimes(count);
    await apiClient.post('/posts', { content: 'Alpha post' });
    expect(writes.mock.calls[0][0].request.headers.get('Authorization')).toBe('Bearer A-renewed');
});

it('retires local and retained workspace drafts on a new login to the same account', async () => {
    await start();
    await act(async () => { otherTab('A'); });
    await screen.findByText('authenticated:Alpha');
    expect(screen.getByLabelText('Post draft')).toHaveValue('');
    expect(screen.getByLabelText('Workspace draft')).toHaveValue('');
    expect(unmounted).toHaveBeenCalledTimes(1);
});

it.each(['pageshow', 'visibilitychange'])('reconciles a suspended tab at %s even if it missed storage events', async event => {
    await start(); otherTab('B', false);
    await act(async () => { (event === 'pageshow' ? window : document).dispatchEvent(new Event(event)); });
    await screen.findByText('authenticated:Bravo');
    expect(screen.getByLabelText('Post draft')).toHaveValue('');
});

it('ignores a held B profile after another tab returns to a new A login', async () => {
    await start(); const started = latch(), finish = latch();
    server.use(http.get('*/users/me', async ({ request }) => {
        if (request.headers.get('Authorization') === 'Bearer B') { started.release(); await finish.promise; }
        return profile(request.headers.get('Authorization'));
    }));
    await act(async () => { otherTab('B'); await started.promise; });
    const pending = auth.bootstrapSession();
    await act(async () => { otherTab('A'); });
    await screen.findByText('authenticated:Alpha');
    await act(async () => { finish.release(); await pending; });
    await waitFor(() => expect(screen.getByText('authenticated:Alpha')).toBeVisible());
    expect(getStoredAccessToken()).toBe('A'); expect(refresh).not.toHaveBeenCalled();
});
