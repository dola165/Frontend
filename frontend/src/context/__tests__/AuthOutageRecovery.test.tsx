import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AxiosError, type AxiosResponse } from 'axios';
import { AuthProvider, useAuth } from '../AuthContext';
import { apiClient, ensureCsrfToken, refreshAccessToken } from '../../api/axiosConfig';
import { clearStoredAuth, getAuthSessionId, getStoredAccessToken, setStoredAccessToken } from '../../utils/authStorage';

vi.mock('../../api/axiosConfig', () => ({
    apiClient: { get: vi.fn(), post: vi.fn() }, ensureCsrfToken: vi.fn(), refreshAccessToken: vi.fn(),
    setAccountRestrictionHandler: vi.fn(), setAuthFailureHandler: vi.fn(), setDisplayedAuthSession: vi.fn(),
}));
const http = (status: number) => new AxiosError('Account unavailable', undefined, undefined, undefined, { status } as AxiosResponse);
function Account() { const auth = useAuth(); return <p>{auth.status}:{auth.user?.id ?? 'none'}</p>; }
beforeEach(() => { vi.resetAllMocks(); vi.mocked(ensureCsrfToken).mockResolvedValue({ headers: {}, withXSRFToken: true }); localStorage.clear(); clearStoredAuth(); setStoredAccessToken('retained-test-token'); });

it('keeps the exact session through a service outage and retries without losing sign-in', async () => {
    const session = getAuthSessionId();
    vi.mocked(apiClient.get).mockRejectedValueOnce(http(503)).mockResolvedValue({ data: { id: 7, role: 'FAN', profileComplete: true, emailVerified: true } });
    render(<AuthProvider><Account /></AuthProvider>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Your sign-in has been kept');
    expect(getStoredAccessToken()).toBe('retained-test-token'); expect(getAuthSessionId()).toBe(session);
    expect(refreshAccessToken).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('authenticated:7'); expect(getAuthSessionId()).toBe(session);
});

it('also preserves the session when refresh hits an outage after an expired access token', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(http(401)); vi.mocked(refreshAccessToken).mockRejectedValue(http(502));
    render(<AuthProvider><Account /></AuthProvider>);
    await screen.findByRole('alert'); expect(getStoredAccessToken()).toBe('retained-test-token');
});

it('clears a definitively rejected refresh instead of restoring unauthorized access', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(http(401)); vi.mocked(refreshAccessToken).mockRejectedValue(http(401));
    render(<AuthProvider><Account /></AuthProvider>);
    await waitFor(() => expect(screen.getByText('anonymous:none')).toBeInTheDocument());
    expect(getStoredAccessToken()).toBeNull(); expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
