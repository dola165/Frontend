import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { TwoFactorSettings } from './TwoFactorSettings';
import { apiClient } from '../../api/axiosConfig';
import { useAuth } from '../../context/AuthContext';
import { clearStoredAuth, getAuthSessionId, getStoredAccessToken, setStoredAccessToken } from '../../utils/authStorage';

vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));

const codes = Array.from({ length: 10 }, (_, index) => `abcdef-123456-abcdef-${String(index).padStart(6, '0')}`);
const setup = { secret: 'JBSWY3DPEHPK3PXP', authenticatorUri: 'otpauth://totp/GrassKickZ:test?secret=JBSWY3DPEHPK3PXP&issuer=GrassKickZ', expiresIn: 600 };
const latch = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => { resolve = done; });
    return { promise, resolve };
};
const setAccount = (id = 7) => vi.mocked(useAuth).mockImplementation(() => ({ user: { id }, sessionId: getAuthSessionId() } as ReturnType<typeof useAuth>));
const open = (passwordLoginEnabled = true, onCredentialsChanged?: () => void) => render(<MemoryRouter><TwoFactorSettings accountId={7} passwordLoginEnabled={passwordLoginEnabled} onCredentialsChanged={onCredentialsChanged} /></MemoryRouter>);
const enterPassword = () => fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'SyntheticPassword1' } });
const beginSetup = async () => {
    await screen.findByRole('button', { name: 'Set up authenticator' });
    enterPassword();
    fireEvent.click(screen.getByRole('button', { name: 'Set up authenticator' }));
    await screen.findByText(setup.secret);
};
const enable = async () => {
    fireEvent.change(screen.getByLabelText('Six-digit authenticator code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enable authenticator' }));
    await screen.findByRole('heading', { name: 'Save your recovery codes' });
};
const beforeUnload = () => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; };

beforeEach(() => {
    vi.resetAllMocks(); localStorage.clear(); clearStoredAuth(); setStoredAccessToken('initial-session-token'); setAccount();
    vi.mocked(apiClient.get).mockResolvedValue({ data: { available: true, enabled: false, recoveryCodesRemaining: 0 } });
    vi.mocked(apiClient.post).mockImplementation(async url => {
        if (url.endsWith('/setup')) return { data: setup };
        if (url.endsWith('/enable')) return { data: { enabled: true, accessToken: 'rotated-token', recoveryCodes: codes } };
        if (url.endsWith('/disable')) return { data: { enabled: false, accessToken: 'disabled-token' } };
        return { data: { recoveryCodes: codes } };
    });
});
afterEach(() => { clearStoredAuth(); vi.restoreAllMocks(); });

it('enrolls with local QR rendering and preserves codes and session identity until explicit save acknowledgement', async () => {
    const session = getAuthSessionId();
    open(); await beginSetup();
    expect(screen.getByTitle('Authenticator setup QR code').closest('svg')).toBeInTheDocument();
    expect(beforeUnload()).toBe(true);
    await enable();
    expect(getAuthSessionId()).toBe(session);
    expect(getStoredAccessToken()).toBe('rotated-token');
    expect(apiClient.get).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(localStorage)).not.toContain(setup.secret);
    expect(JSON.stringify(localStorage)).not.toContain(codes[0]);
    expect(screen.getByRole('button', { name: 'Done saving codes' })).toBeDisabled();
    vi.mocked(apiClient.get).mockResolvedValue({ data: { available: true, enabled: true, recoveryCodesRemaining: 10 } });
    fireEvent.click(screen.getByRole('checkbox', { name: /I saved these recovery codes/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Done saving codes' }));
    expect(await screen.findByText('10 unused recovery codes remain.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Save your recovery codes' })).not.toBeInTheDocument();
    expect(beforeUnload()).toBe(false);
});

it('keeps issued codes visible on remount without making another status request', async () => {
    const view = open(); await beginSetup(); await enable(); view.unmount();
    open();
    expect(screen.getByLabelText('Recovery codes')).toHaveTextContent(codes[0]);
    expect(apiClient.get).toHaveBeenCalledTimes(1);
});

it('warns about unsaved recovery codes on SPA navigation and retains them when returning', async () => {
    const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<MemoryRouter><Routes><Route path="/" element={<><Link to="/other">Other page</Link><TwoFactorSettings accountId={7} passwordLoginEnabled /></>} /><Route path="/other" element={<Link to="/">Security settings</Link>} /></Routes></MemoryRouter>);
    await beginSetup(); await enable();
    fireEvent.click(screen.getByRole('link', { name: 'Other page' }));
    expect(confirmation).toHaveBeenCalled();
    expect(screen.getByLabelText('Recovery codes')).toBeInTheDocument();
    confirmation.mockReturnValue(true);
    fireEvent.click(screen.getByRole('link', { name: 'Other page' }));
    fireEvent.click(await screen.findByRole('link', { name: 'Security settings' }));
    expect(await screen.findByLabelText('Recovery codes')).toHaveTextContent(codes[0]);
});

it('shows an unavailable server separately from the recorded enabled setting and offers no mutation', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { available: false, enabled: true, recoveryCodesRemaining: 3 } });
    open();
    expect(await screen.findByText('Authenticator enabled')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('temporarily unavailable');
    expect(screen.queryByRole('button', { name: 'Disable authenticator' })).not.toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
});

it('uses account recovery for provider-only accounts instead of a non-working setup action', async () => {
    open(false);
    expect(await screen.findByRole('link', { name: 'Set a password through account recovery' })).toHaveAttribute('href', '/forgot-password');
    expect(screen.queryByRole('button', { name: 'Set up authenticator' })).not.toBeInTheDocument();
});

it('offers a read retry after status errors and never assumes authenticator is enabled', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('Offline'));
    open();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load authenticator settings.');
    expect(screen.queryByText('Authenticator enabled')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry authenticator settings' }));
    expect(await screen.findByRole('button', { name: 'Set up authenticator' })).toBeInTheDocument();
});

it('clears a cancelled setup and password without a server enable request', async () => {
    open(); await beginSetup();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel setup' }));
    expect(screen.queryByText(setup.secret)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Current password')).toHaveValue('');
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect(beforeUnload()).toBe(false);
});

it('requires a new setup after its server-issued expiry', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { ...setup, expiresIn: 0.001 } });
    open(); await beginSetup();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start setup again' })).toBeInTheDocument(), { timeout: 1500 });
    expect(screen.queryByRole('button', { name: 'Enable authenticator' })).not.toBeInTheDocument();
});

it('keeps setup after invalid proof and prevents duplicate enables while saving', async () => {
    const saved = latch<{ data: { enabled: boolean; accessToken: string; recoveryCodes: string[] } }>();
    open(); await beginSetup();
    vi.mocked(apiClient.post).mockRejectedValueOnce({ response: { status: 400, data: { code: 'second_factor_invalid' } } }).mockReturnValueOnce(saved.promise);
    fireEvent.change(screen.getByLabelText('Six-digit authenticator code'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enable authenticator' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Use a new authenticator code');
    fireEvent.change(screen.getByLabelText('Six-digit authenticator code'), { target: { value: '123456' } });
    const submit = screen.getByRole('button', { name: 'Enable authenticator' });
    fireEvent.click(submit); fireEvent.click(submit);
    expect(submit).toBeDisabled();
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(3));
    await act(async () => saved.resolve({ data: { enabled: true, accessToken: 'rotated-token', recoveryCodes: codes } }));
    expect(await screen.findByLabelText('Recovery codes')).toBeInTheDocument();
});

it('regenerates all recovery codes only after confirmation and preserves them until acknowledged', async () => {
    const credentialsChanged = vi.fn();
    vi.mocked(apiClient.get).mockResolvedValue({ data: { available: true, enabled: true, recoveryCodesRemaining: 2 } });
    open(true, credentialsChanged); await screen.findByText('2 unused recovery codes remain.');
    enterPassword();
    fireEvent.change(screen.getByLabelText('Authenticator or unused recovery code'), { target: { value: 'old-unused-recovery-code' } });
    fireEvent.click(screen.getByRole('button', { name: 'Replace recovery codes' }));
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(screen.getByText(/Every old recovery code will stop working/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm replacement' }));
    expect(await screen.findByLabelText('Recovery codes')).toHaveTextContent(codes[9]);
    expect(apiClient.post).toHaveBeenCalledWith('/users/me/two-factor/recovery-codes', { currentPassword: 'SyntheticPassword1', code: 'old-unused-recovery-code' }, expect.anything());
    expect(getStoredAccessToken()).toBe('initial-session-token');
    expect(credentialsChanged).not.toHaveBeenCalled();
});

it('disables only after confirmation and adopts the new access token in the same session', async () => {
    const session = getAuthSessionId();
    vi.mocked(apiClient.get).mockResolvedValue({ data: { available: true, enabled: true, recoveryCodesRemaining: 2 } });
    open(); await screen.findByText('2 unused recovery codes remain.');
    enterPassword(); fireEvent.change(screen.getByLabelText('Authenticator or unused recovery code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Disable authenticator' }));
    expect(apiClient.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm disable' }));
    expect(await screen.findByText('Authenticator not enabled')).toBeInTheDocument();
    expect(getStoredAccessToken()).toBe('disabled-token'); expect(getAuthSessionId()).toBe(session);
});

it('keeps recovery codes visible after a clipboard failure', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) } });
    open(); await beginSetup(); await enable();
    fireEvent.click(screen.getByRole('button', { name: 'Copy recovery codes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Select the text and copy it manually');
    expect(screen.getByLabelText('Recovery codes')).toHaveTextContent(codes[0]);
    expect(screen.getByRole('button', { name: 'Done saving codes' })).toBeDisabled();
});

it('rejects malformed enable confirmation without installing a token or inventing success', async () => {
    open(); await beginSetup();
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { enabled: true, recoveryCodes: codes, accessToken: '' } });
    fireEvent.change(screen.getByLabelText('Six-digit authenticator code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enable authenticator' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be confirmed');
    expect(getStoredAccessToken()).toBe('initial-session-token');
    expect(screen.queryByLabelText('Recovery codes')).not.toBeInTheDocument();
});

it('does not adopt a late enable response or leak codes into another account', async () => {
    const credentialsChanged = vi.fn();
    const saved = latch<{ data: { enabled: boolean; accessToken: string; recoveryCodes: string[] } }>();
    const view = open(true, credentialsChanged); await beginSetup();
    vi.mocked(apiClient.post).mockReturnValueOnce(saved.promise);
    fireEvent.change(screen.getByLabelText('Six-digit authenticator code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enable authenticator' }));
    act(() => { clearStoredAuth(); setStoredAccessToken('other-account-token'); setAccount(8); });
    view.rerender(<MemoryRouter><TwoFactorSettings accountId={8} passwordLoginEnabled /></MemoryRouter>);
    await act(async () => saved.resolve({ data: { enabled: true, accessToken: 'retired-token', recoveryCodes: codes } }));
    expect(getStoredAccessToken()).toBe('other-account-token');
    expect(screen.queryByLabelText('Recovery codes')).not.toBeInTheDocument();
    expect(screen.queryByText(setup.secret)).not.toBeInTheDocument();
    expect(beforeUnload()).toBe(false);
    expect(credentialsChanged).not.toHaveBeenCalled();
});

it('rejects a replacement access token for a different account', async () => {
    const jwt = (subject: string) => `header.${btoa(JSON.stringify({ sub: subject }))}.signature`;
    setStoredAccessToken(jwt('7')); setAccount();
    open(); await beginSetup();
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { enabled: true, accessToken: jwt('8'), recoveryCodes: codes } });
    fireEvent.change(screen.getByLabelText('Six-digit authenticator code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enable authenticator' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be confirmed');
    expect(getStoredAccessToken()).toBe(jwt('7'));
    expect(screen.queryByLabelText('Recovery codes')).not.toBeInTheDocument();
});
