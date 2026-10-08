import { act, renderHook, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import { apiClient } from '../../api/axiosConfig';
import { clearStoredAuth, getAuthSessionId, getStoredAccessToken, setStoredAccessToken } from '../../utils/authStorage';

vi.mock('../../api/axiosConfig', () => ({
    apiClient: { get: vi.fn(), post: vi.fn() }, ensureCsrfToken: vi.fn(), refreshAccessToken: vi.fn(),
    setAccountRestrictionHandler: vi.fn(), setAuthFailureHandler: vi.fn(), setDisplayedAuthSession: vi.fn(),
}));

it('rejects an incomplete login without changing the existing session or stored access token', async () => {
    localStorage.clear(); clearStoredAuth(); setStoredAccessToken('existing-token');
    vi.mocked(apiClient.get).mockResolvedValue({ data: { id: 7, role: 'FAN', profileComplete: true, emailVerified: true } });
    const { result } = renderHook(useAuth, { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    const session = getAuthSessionId();
    await act(async () => {
        await expect(result.current.loginWithAccessToken(undefined as unknown as string)).rejects.toThrow('Sign-in has not completed');
        await expect(result.current.loginWithAccessToken('  ')).rejects.toThrow('Sign-in has not completed');
    });
    expect(getAuthSessionId()).toBe(session);
    expect(getStoredAccessToken()).toBe('existing-token');
    expect(result.current.user?.id).toBe(7);
});
