import { act, renderHook, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import { apiClient } from '../../api/axiosConfig';
import { setStoredAccessToken } from '../../utils/authStorage';

vi.mock('../../api/axiosConfig', () => ({
    apiClient: { get: vi.fn(), post: vi.fn() }, ensureCsrfToken: vi.fn(), refreshAccessToken: vi.fn(),
    setAccountRestrictionHandler: vi.fn(), setAuthFailureHandler: vi.fn(), setDisplayedAuthSession: vi.fn(),
}));

const capabilities = { version: 1, workspaces: [{ id: 'club.workspace', context: { type: 'club', id: 21, label: 'Academy' } }] };
const profile = (navigationCapabilities: unknown = capabilities, id = 7) => ({ data: { id, role: 'PARENT', profileComplete: true, emailVerified: true, navigationCapabilities } });
const deferred = () => {
    let resolve!: (value: ReturnType<typeof profile>) => void;
    const promise = new Promise<ReturnType<typeof profile>>(done => { resolve = done; });
    return { promise, resolve };
};

beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear(); setStoredAccessToken('session-a');
    vi.mocked(apiClient.get).mockResolvedValue(profile());
});

it('ignores locally cached capabilities and installs only the current-user projection', async () => {
    localStorage.setItem('user', JSON.stringify({ id: 7, navigationCapabilities: { version: 1, workspaces: [{ id: 'admin.console' }] } }));
    const { result } = renderHook(useAuth, { wrapper: AuthProvider });
    expect(result.current.user).toBeNull();
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(result.current.user?.navigationCapabilities).toEqual(capabilities);
    expect(JSON.parse(localStorage.getItem('user') ?? '{}')).not.toHaveProperty('navigationCapabilities');
});

it('replaces removed memberships and does not merge old capabilities into an older server response', async () => {
    const { result } = renderHook(useAuth, { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    vi.mocked(apiClient.get).mockResolvedValue(profile({ version: 1, workspaces: [] }));
    await act(async () => { await result.current.refreshNavigationCapabilities(); });
    expect(result.current.user?.navigationCapabilities?.workspaces).toEqual([]);
    vi.mocked(apiClient.get).mockResolvedValue({ data: { id: 7, role: 'PARENT', profileComplete: true } });
    await act(async () => { await result.current.refreshNavigationCapabilities(); });
    expect(result.current.user?.navigationCapabilities).toBeUndefined();
});

it('retires stale shortcuts when refreshing fails and preserves sign-in', async () => {
    const { result } = renderHook(useAuth, { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('offline'));
    await act(async () => { await result.current.refreshNavigationCapabilities(); });
    expect(result.current.status).toBe('authenticated');
    expect(result.current.user?.navigationCapabilities?.workspaces).toEqual([]);
});

it('prevents a delayed older response from restoring revoked membership', async () => {
    const { result } = renderHook(useAuth, { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    const old = deferred();
    vi.mocked(apiClient.get).mockReturnValueOnce(old.promise).mockResolvedValueOnce(profile({ version: 1, workspaces: [] }));
    let pending!: Promise<void>;
    await act(async () => { pending = result.current.refreshNavigationCapabilities(); await result.current.refreshNavigationCapabilities(); });
    await act(async () => { old.resolve(profile()); await pending; });
    expect(result.current.user?.navigationCapabilities?.workspaces).toEqual([]);
});

it('does not install another session’s delayed projection after account switching', async () => {
    const { result } = renderHook(useAuth, { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    const old = deferred();
    vi.mocked(apiClient.get).mockReturnValueOnce(old.promise).mockResolvedValue(profile({ version: 1, workspaces: [] }, 8));
    let pending!: Promise<void>;
    await act(async () => { pending = result.current.refreshNavigationCapabilities(); });
    await act(async () => { setStoredAccessToken('session-b'); });
    await waitFor(() => expect(result.current.user?.id).toBe(8));
    await act(async () => { old.resolve(profile()); await pending; });
    expect(result.current.user?.id).toBe(8);
    expect(result.current.user?.navigationCapabilities?.workspaces).toEqual([]);
});

it('refreshes on window focus', async () => {
    const { result } = renderHook(useAuth, { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    vi.mocked(apiClient.get).mockResolvedValue(profile({ version: 1, workspaces: [] }));
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    await waitFor(() => expect(result.current.user?.navigationCapabilities?.workspaces).toEqual([]));
});

it('refreshes expired contexts on the visible-tab interval', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    try {
        const { result, unmount } = renderHook(useAuth, { wrapper: AuthProvider });
        await act(async () => { await result.current.bootstrapSession(); });
        expect(result.current.status).toBe('authenticated');
        vi.mocked(apiClient.get).mockResolvedValue(profile({ version: 1, workspaces: [] }));
        await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
        expect(result.current.user?.navigationCapabilities?.workspaces).toEqual([]);
        unmount();
    } finally {
        vi.useRealTimers();
    }
});
