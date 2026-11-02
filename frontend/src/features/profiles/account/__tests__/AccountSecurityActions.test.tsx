import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../../../api/axiosConfig';
import { useAuth } from '../../../../context/AuthContext';
import { clearStoredAuth, getAuthSessionId, setStoredAccessToken } from '../../../../utils/authStorage';
import { useAccountCenter } from '../useAccountCenter';

vi.mock('../../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
vi.mock('../../../../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../../clubs/api', () => ({ fetchMyPlayerCards: vi.fn().mockResolvedValue([]) }));
const bootstrapSession = vi.fn(), logout = vi.fn();
const account = { id: 7, fullName: 'Synthetic', email: 'synthetic@example.test', passwordLoginEnabled: true, emailVerified: false, linkedAccounts: [] };
const latch = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear(); clearStoredAuth(); setStoredAccessToken('synthetic');
    vi.mocked(useAuth).mockReturnValue({ user: { id: 7 }, sessionId: getAuthSessionId(), bootstrapSession, logout } as unknown as ReturnType<typeof useAuth>);
    bootstrapSession.mockResolvedValue({ id: 7 });
    vi.mocked(apiClient.get).mockImplementation(async path => ({ data: path === '/users/me/account' ? account : path === '/auth/sessions' ? { sessions: [], activeCount: 1, revokedCount: 0, expiredCount: 0 } : [] }));
    vi.mocked(apiClient.post).mockResolvedValue({ data: { message: 'Email request accepted.' } });
});
afterEach(() => { cleanup(); clearStoredAuth(); });

it('does not confuse accepted mail with a failed account refresh and keeps retry available', async () => {
    const { result } = renderHook(useAccountCenter); await waitFor(() => expect(result.current.loading).toBe(false));
    bootstrapSession.mockRejectedValue(new Error('offline'));
    await act(async () => { await result.current.resendVerification(); });
    expect(result.current.message).toBe('Email request accepted.');
    expect(result.current.error).toEqual({ fallback: 'Email requested, but account status could not be refreshed. Retry loading your account.' });
    expect(result.current.sendingVerification).toBe(false);
    await act(async () => { await result.current.resendVerification(); });
    expect(apiClient.post).toHaveBeenCalledTimes(2);
});

it('blocks duplicate verification requests and ignores the response after account replacement', async () => {
    const response = latch<{ data: { message: string } }>(); vi.mocked(apiClient.post).mockReturnValue(response.promise);
    const { result, rerender } = renderHook(useAccountCenter); await waitFor(() => expect(result.current.loading).toBe(false));
    let pending!: Promise<void>;
    act(() => { pending = result.current.resendVerification(); void result.current.resendVerification(); });
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    act(() => { clearStoredAuth(); setStoredAccessToken('replacement'); });
    vi.mocked(useAuth).mockReturnValue({ user: { id: 9 }, sessionId: getAuthSessionId(), bootstrapSession, logout } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(apiClient.get).mockImplementation(async path => ({ data: path === '/users/me/account' ? { ...account, id: 9 } : [] }));
    rerender();
    await act(async () => { response.resolve({ data: { message: 'Previous private email' } }); await pending; });
    expect(result.current.message).toBeNull(); expect(bootstrapSession).not.toHaveBeenCalled();
    expect(result.current.passwordForm.currentPassword).toBe('');
});

it('does not sign out the replacement account after a delayed session action', async () => {
    const response = latch<{ data: { message: string } }>(); vi.mocked(apiClient.delete).mockReturnValue(response.promise);
    const { result, rerender } = renderHook(useAccountCenter); await waitFor(() => expect(result.current.loading).toBe(false));
    let pending!: Promise<void>; act(() => { pending = result.current.endSession(31); });
    act(() => { clearStoredAuth(); setStoredAccessToken('replacement'); });
    vi.mocked(useAuth).mockReturnValue({ user: { id: 9 }, sessionId: getAuthSessionId(), bootstrapSession, logout } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(apiClient.get).mockImplementation(async path => ({ data: path === '/users/me/account' ? { ...account, id: 9 } : [] }));
    rerender();
    await act(async () => { response.resolve({ data: { message: 'Old device ended' } }); await pending; });
    expect(result.current.message).toBeNull(); expect(logout).not.toHaveBeenCalled();
});
