import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useGoogleOAuth } from '@react-oauth/google';
import { apiClient } from '../../api/axiosConfig';
import { nativeCall, nativeSession } from '../../android/bridge';
import { useAuth } from '../../context/AuthContext';
import { clearStoredAuth, getAuthSessionId, getStoredAccessToken, setStoredAccessToken } from '../../utils/authStorage';
import { GoogleProviderSettings } from './GoogleProviderSettings';

const mode = vi.hoisted(() => ({ native: false }));
const popups = vi.hoisted(() => [] as Array<{ nonce: string; onSuccess: (value: { credential: string }) => void }>);
vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../android/bridge', () => ({ get isAndroidApp() { return mode.native; }, nativeCall: vi.fn(), nativeSession: vi.fn(), decodeBody: (value: string) => Uint8Array.from(atob(value), character => character.charCodeAt(0)) }));
vi.mock('@react-oauth/google', () => ({ useGoogleOAuth: vi.fn(), GoogleLogin: (props: { nonce: string; onSuccess: (value: { credential: string }) => void }) => {
    popups.push(props);
    return <button onClick={() => props.onSuccess({ credential: `header.${btoa(JSON.stringify({ nonce: props.nonce }))}.signature` })}>Select test Google account</button>;
} }));
const jwt = (subject = '7') => `header.${btoa(JSON.stringify({ sub: subject }))}.signature`;
const links = [{ provider: 'google', linkedAt: '2026-09-13T00:00:00Z' }];
const status = { googleAvailable: true, passwordLoginEnabled: true, twoFactorEnabled: false, linkedAccounts: [], googleUnlinkAllowed: false, googleUnlinkBlockedReason: null };
const setAccount = (id = 7) => vi.mocked(useAuth).mockReturnValue({ user: { id }, sessionId: getAuthSessionId() } as ReturnType<typeof useAuth>);
const open = (onChanged = vi.fn()) => render(<MemoryRouter><GoogleProviderSettings accountId={7} onCredentialsChanged={onChanged} /></MemoryRouter>);
const latch = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => { resolve = done; });
    return { promise, resolve };
};
const beginLink = async () => {
    fireEvent.click(await screen.findByRole('button', { name: 'Link Google' }));
    fireEvent.change(screen.getByLabelText('Current account password'), { target: { value: 'SyntheticPassword1' } });
};
beforeEach(() => {
    vi.resetAllMocks(); mode.native = false; popups.length = 0;
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'configured.apps.googleusercontent.com');
    clearStoredAuth(); setStoredAccessToken(jwt()); setAccount();
    vi.mocked(useGoogleOAuth).mockReturnValue({ scriptLoadedSuccessfully: true, clientId: 'configured' });
    vi.mocked(apiClient.get).mockResolvedValue({ data: status });
    vi.mocked(apiClient.post).mockImplementation(async path => ({ data: { provider: 'google', linked: path.endsWith('/link'), accessToken: jwt(), linkedAccounts: path.endsWith('/link') ? links : [] } }));
});
afterEach(() => { clearStoredAuth(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

it('links Google with fresh browser proof, refreshes account metadata and preserves the logical session', async () => {
    const changed = vi.fn(); const session = getAuthSessionId();
    open(changed); await beginLink();
    expect(apiClient.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Select test Google account' }));
    expect(await screen.findByRole('heading', { name: 'Google linked' })).toBeInTheDocument();
    expect(changed).toHaveBeenCalledTimes(1); expect(getAuthSessionId()).toBe(session);
    expect(apiClient.post).toHaveBeenCalledWith('/users/me/providers/google/link', expect.objectContaining({ currentPassword: 'SyntheticPassword1', googleIdToken: expect.any(String) }), expect.anything());
    expect(screen.queryByLabelText('Current account password')).not.toBeInTheDocument();
    expect(JSON.stringify(localStorage)).not.toContain('SyntheticPassword1');
    expect(screen.getByRole('button', { name: 'Unlink Google' })).toBeEnabled();
});
it('requires the enrolled second factor, retains a rejected proof flow and prevents duplicate mutations', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { ...status, twoFactorEnabled: true } });
    const response = latch<{ data: { provider: string; linked: boolean; accessToken: string; linkedAccounts: typeof links } }>();
    vi.mocked(apiClient.post).mockRejectedValueOnce({ response: { status: 400, data: { code: 'second_factor_invalid' } } }).mockReturnValueOnce(response.promise);
    const changed = vi.fn(); open(changed); await beginLink();
    expect(screen.queryByRole('button', { name: 'Select test Google account' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Authenticator or unused recovery code'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Select test Google account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Use a new authenticator code');
    expect(screen.getByLabelText('Authenticator or unused recovery code')).toHaveValue('');
    fireEvent.change(screen.getByLabelText('Authenticator or unused recovery code'), { target: { value: 'unused-recovery' } });
    const popup = popups[popups.length - 1];
    const proof = `header.${btoa(JSON.stringify({ nonce: popup.nonce }))}.signature`;
    act(() => { popup.onSuccess({ credential: proof }); popup.onSuccess({ credential: proof }); });
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(2));
    await act(async () => response.resolve({ data: { provider: 'google', linked: true, accessToken: jwt(), linkedAccounts: links } }));
    expect(changed).toHaveBeenCalledTimes(1);
    expect(apiClient.post).toHaveBeenLastCalledWith('/users/me/providers/google/link', expect.objectContaining({ oneTimeCode: 'unused-recovery' }), expect.anything());
});
it('requires explicit unlink confirmation and password proof before replacing the native session metadata', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { ...status, linkedAccounts: links, googleUnlinkAllowed: true } });
    const changed = vi.fn(); open(changed);
    fireEvent.click(await screen.findByRole('button', { name: 'Unlink Google' }));
    expect(screen.getByRole('button', { name: 'Confirm unlink Google' })).toBeDisabled();
    expect(apiClient.post).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Current account password'), { target: { value: 'SyntheticPassword1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm unlink Google' }));
    expect(await screen.findByRole('heading', { name: 'Google not linked' })).toBeInTheDocument();
    expect(apiClient.post).toHaveBeenCalledWith('/users/me/providers/google/unlink', { currentPassword: 'SyntheticPassword1' }, expect.anything());
    expect(changed).toHaveBeenCalledTimes(1);
});
it('protects a Google-only account from losing its last usable sign-in method', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { ...status, passwordLoginEnabled: false, linkedAccounts: links, googleUnlinkBlockedReason: 'last_login_method' } });
    open(); expect(await screen.findByRole('button', { name: 'Unlink Google' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Set a password through account recovery' })).toHaveAttribute('href', '/forgot-password');
    expect(apiClient.post).not.toHaveBeenCalled();
});
it.each(['web', 'server'])('shows missing %s Google configuration without offering a non-working link', async source => {
    if (source === 'web') vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
    else vi.mocked(apiClient.get).mockResolvedValue({ data: { ...status, googleAvailable: false } });
    open(); expect(await screen.findByRole('button', { name: 'Link Google' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('not configured');
});
it('allows password-proven unlink even when Google linking is not configured', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { ...status, googleAvailable: false, linkedAccounts: links, googleUnlinkAllowed: true } });
    open(); expect(await screen.findByRole('button', { name: 'Unlink Google' })).toBeEnabled();
});
it('offers status retry after a failed read without pretending to know linked state', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('Offline'));
    open(); expect(await screen.findByRole('alert')).toHaveTextContent('Could not load');
    expect(screen.queryByRole('heading', { name: /Google/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh provider settings' }));
    expect(await screen.findByRole('button', { name: 'Link Google' })).toBeEnabled();
});
it('reports an identity conflict and does not report success or change account credentials', async () => {
    vi.mocked(apiClient.post).mockRejectedValue({ response: { status: 409, data: { code: 'provider_identity_in_use' } } });
    const changed = vi.fn(); open(changed); await beginLink();
    fireEvent.click(screen.getByRole('button', { name: 'Select test Google account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('linked to another GrassKickZ account');
    expect(changed).not.toHaveBeenCalled(); expect(getStoredAccessToken()).toBe(jwt());
});
it('cancels an old browser popup and rejects its proof if delivered to a later attempt', async () => {
    open(); await beginLink(); const old = popups[popups.length - 1];
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Google linking' }));
    act(() => old.onSuccess({ credential: `header.${btoa(JSON.stringify({ nonce: old.nonce }))}.signature` }));
    expect(apiClient.post).not.toHaveBeenCalled();
    await beginLink(); const next = popups[popups.length - 1];
    act(() => next.onSuccess({ credential: `header.${btoa(JSON.stringify({ nonce: old.nonce }))}.signature` }));
    expect(await screen.findByRole('alert')).toHaveTextContent('expired');
    expect(apiClient.post).not.toHaveBeenCalled();
});
it('discards late success after cancellation and requires a status check before another write', async () => {
    const response = latch<{ data: { provider: string; linked: boolean; accessToken: string; linkedAccounts: typeof links } }>();
    vi.mocked(apiClient.post).mockReturnValue(response.promise);
    const changed = vi.fn(); open(changed); await beginLink();
    fireEvent.click(screen.getByRole('button', { name: 'Select test Google account' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Google linking' }));
    await act(async () => response.resolve({ data: { provider: 'google', linked: true, accessToken: jwt(), linkedAccounts: links } }));
    expect(changed).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Link Google' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('check whether the change completed');
});
it('does not apply a retired account response to a replacement account', async () => {
    const response = latch<{ data: { provider: string; linked: boolean; accessToken: string; linkedAccounts: typeof links } }>();
    vi.mocked(apiClient.post).mockReturnValue(response.promise);
    const changed = vi.fn(); const view = open(changed); await beginLink();
    fireEvent.click(screen.getByRole('button', { name: 'Select test Google account' }));
    act(() => { setStoredAccessToken(jwt('8')); setAccount(8); });
    view.rerender(<MemoryRouter><GoogleProviderSettings accountId={8} onCredentialsChanged={changed} /></MemoryRouter>);
    await act(async () => response.resolve({ data: { provider: 'google', linked: true, accessToken: jwt(), linkedAccounts: links } }));
    expect(getStoredAccessToken()).toBe(jwt('8')); expect(changed).not.toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: 'Link Google' })).toBeEnabled();
    expect(screen.queryByLabelText('Current account password')).not.toBeInTheDocument();
});
it('uses the native account picker and surfaces its cancellation without passing a Google ID token through JavaScript', async () => {
    mode.native = true; setStoredAccessToken('native-session'); setAccount();
    vi.mocked(nativeSession).mockResolvedValue({ active: true, session: '7' });
    vi.mocked(nativeCall).mockResolvedValue({ id: 'reply', status: 499, body: btoa(JSON.stringify({ code: 'GOOGLE_PROVIDER_CANCELLED' })) });
    open(); await beginLink();
    fireEvent.click(screen.getByRole('button', { name: 'Choose Google account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('was cancelled');
    expect(nativeCall).toHaveBeenCalledWith({ kind: 'googleProviderLink', session: '7', currentPassword: 'SyntheticPassword1' }, expect.any(AbortSignal));
    expect(apiClient.post).not.toHaveBeenCalled(); expect(getStoredAccessToken()).toBe('native-session');
});
it('shows a loading explanation when the browser Google script has not loaded', async () => {
    vi.mocked(useGoogleOAuth).mockReturnValue({ scriptLoadedSuccessfully: false, clientId: 'configured' });
    open(); await beginLink();
    expect(screen.getByRole('status')).toHaveTextContent('Loading Google account selection');
    expect(apiClient.post).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel Google linking' })).toBeEnabled());
});
