import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import '../../i18n';
import { OnboardingPage } from '../OnboardingPage';
import { SetPasswordPage } from '../SetPasswordPage';
import { apiClient } from '../../api/axiosConfig';
import { useAuth } from '../../context/AuthContext';
import { clearStoredAuth, getAuthSessionId, getStoredAccessToken, setStoredAccessToken } from '../../utils/authStorage';

vi.mock('../../api/axiosConfig', () => ({ apiClient: { put: vi.fn(), post: vi.fn() } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));
const user = { id: 7, role: 'FAN', fullName: 'Initial Person', dob: '2000-01-01', profileComplete: false, onboardingRequired: true, mustChangePassword: false, emailVerified: true };
const jwt = (revision: string, sub = '7') => `header.${btoa(JSON.stringify({ sub, revision }))}.signature`;
const bootstrap = vi.fn(); const logout = vi.fn();
const Location = () => <output data-testid="location">{useLocation().pathname}{useLocation().search}</output>;
const renderOnboarding = () => render(<MemoryRouter initialEntries={['/onboarding']}><OnboardingPage /><Location /></MemoryRouter>);
const latch = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => { resolve = done; });
    return { promise, resolve };
};
beforeEach(() => {
    vi.resetAllMocks(); localStorage.clear(); sessionStorage.clear(); clearStoredAuth(); setStoredAccessToken(jwt('original'));
    vi.mocked(useAuth).mockReturnValue({ user, sessionId: getAuthSessionId(), bootstrapSession: bootstrap, logout } as unknown as ReturnType<typeof useAuth>);
    bootstrap.mockImplementation(async () => {
        expect(getStoredAccessToken()).toBe(jwt('updated'));
        return { ...user, fullName: 'Updated Person', profileComplete: true, onboardingRequired: false };
    });
    vi.mocked(apiClient.put).mockResolvedValue({ data: { accessToken: jwt('updated') } });
    vi.mocked(apiClient.post).mockResolvedValue({ data: { message: 'Password changed successfully.' } });
});
afterEach(() => clearStoredAuth());

it('adopts onboarding credentials before metadata bootstrap while preserving the session', async () => {
    const session = getAuthSessionId(); renderOnboarding();
    fireEvent.change(document.getElementById('onboarding-name') as HTMLInputElement, { target: { value: 'Updated Person' } });
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);
    await waitFor(() => expect(bootstrap).toHaveBeenCalledTimes(1));
    expect(getAuthSessionId()).toBe(session); expect(getStoredAccessToken()).toBe(jwt('updated'));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/home'));
});
it.each(['FAN', 'PARENT'])('completes onboarding as Parent from an existing %s role without replacing the session', async (initialRole) => {
    vi.mocked(useAuth).mockReturnValue({
        user: { ...user, role: initialRole }, sessionId: getAuthSessionId(), bootstrapSession: bootstrap, logout,
    } as unknown as ReturnType<typeof useAuth>);
    const session = getAuthSessionId(); renderOnboarding();
    const parent = screen.getByRole('radio', { name: 'Parent or guardian' });
    if (initialRole === 'PARENT') expect(parent).toBeChecked();
    else fireEvent.click(parent);
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);
    await waitFor(() => expect(bootstrap).toHaveBeenCalledTimes(1));
    expect(apiClient.put).toHaveBeenCalledWith('/users/me/onboarding', {
        fullName: 'Initial Person', role: 'PARENT', dateOfBirth: '2000-01-01',
    }, expect.anything());
    expect(getAuthSessionId()).toBe(session);
    expect(getStoredAccessToken()).toBe(jwt('updated'));
});
it('does not install mismatched onboarding credentials or bootstrap another account', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: { accessToken: jwt('wrong', '8') } });
    renderOnboarding(); fireEvent.submit(document.querySelector('form') as HTMLFormElement);
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(document.querySelector('button[type="submit"]')).not.toBeDisabled());
    expect(bootstrap).not.toHaveBeenCalled(); expect(getStoredAccessToken()).toBe(jwt('original'));
    expect(screen.getByTestId('location')).toHaveTextContent('/onboarding');
});
it('cancels onboarding on account replacement and discards its late response', async () => {
    const response = latch<{ data: { accessToken: string } }>(); vi.mocked(apiClient.put).mockReturnValue(response.promise);
    const view = renderOnboarding(); fireEvent.submit(document.querySelector('form') as HTMLFormElement);
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledTimes(1));
    act(() => {
        setStoredAccessToken(jwt('other', '8'));
        vi.mocked(useAuth).mockReturnValue({ user: { ...user, id: 8 }, sessionId: getAuthSessionId(), bootstrapSession: bootstrap, logout } as unknown as ReturnType<typeof useAuth>);
    });
    view.rerender(<MemoryRouter><OnboardingPage /><Location /></MemoryRouter>);
    await act(async () => response.resolve({ data: { accessToken: jwt('updated') } }));
    expect(bootstrap).not.toHaveBeenCalled(); expect(getStoredAccessToken()).toBe(jwt('other', '8'));
});
it('clears password proof and signs out after the first-login password write revokes all sessions', async () => {
    logout.mockImplementation(async () => clearStoredAuth());
    render(<MemoryRouter initialEntries={['/set-password']}><SetPasswordPage /><Location /></MemoryRouter>);
    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="password"]');
    fireEvent.change(inputs[0], { target: { value: 'TemporaryPassword1' } });
    fireEvent.change(inputs[1], { target: { value: 'NewPassword123' } });
    fireEvent.change(inputs[2], { target: { value: 'NewPassword123' } });
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    expect(bootstrap).not.toHaveBeenCalled(); expect(getStoredAccessToken()).toBeNull();
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/login?passwordChanged=1'));
    inputs.forEach(input => expect(input).toHaveValue(''));
    expect(JSON.stringify(localStorage)).not.toContain('NewPassword123');
});
