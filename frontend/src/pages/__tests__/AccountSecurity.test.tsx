import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../../i18n';
import { AccountPage } from '../AccountPage';
import { apiClient } from '../../api/axiosConfig';
import { useAuth } from '../../context/AuthContext';
import { fetchMyPlayerCards } from '../../features/clubs/api';
import { clearStoredAuth, getAuthSessionId, setStoredAccessToken } from '../../utils/authStorage';

vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../features/clubs/api', () => ({ fetchMyPlayerCards: vi.fn(), activatePlayerCard: vi.fn() }));
vi.mock('../../utils/resolveMediaUrl', () => ({ resolveMediaUrl: (value?: string) => value || null }));
vi.mock('../../components/ui/MediaImage', () => ({ MediaImage: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }));
vi.mock('../../features/journey/components/ClubJourneyPanel', () => ({ ClubJourneyPanel: () => null }));

beforeEach(() => {
    vi.resetAllMocks(); localStorage.clear(); clearStoredAuth(); setStoredAccessToken('account-token');
    vi.mocked(useAuth).mockReturnValue({ user: { id: 7 }, sessionId: getAuthSessionId(), bootstrapSession: vi.fn(), logout: vi.fn() } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(fetchMyPlayerCards).mockResolvedValue([]);
    vi.mocked(apiClient.get).mockImplementation(async path => ({ data: path === '/users/me/account' ? {
        id: 7, username: 'example', email: 'example@example.test', displayName: 'Example User', role: 'FAN', fullName: 'Example User',
        emailVerified: true, passwordLoginEnabled: true, linkedAccounts: [], sessionsSupported: true, sessionRevocationSupported: true, accountDeletionSupported: false,
    } : path === '/auth/sessions' ? { sessions: [], activeCount: 1, revokedCount: 0, expiredCount: 0 } : { available: true, enabled: false, recoveryCodesRemaining: 0 } }));
    vi.mocked(apiClient.post).mockResolvedValue({ data: { url: '/uploads/test-profile-image.png' } });
});
afterEach(() => { clearStoredAuth(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });

it.each([undefined, 'false', 'TRUE', 'invalid'])('keeps unreleased security panels unmounted in production with flag %s', async flag => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_ACCOUNT_SECURITY_EXTENSIONS', flag);
    const view = render(<MemoryRouter initialEntries={['/account?tab=security']}><AccountPage/></MemoryRouter>);
    await screen.findByText('Email And Password');
    expect(screen.queryByRole('heading', { name: 'Authenticator Security' })).not.toBeInTheDocument();
    expect(vi.mocked(apiClient.get).mock.calls.some(([path]) => String(path).includes('two-factor'))).toBe(false);
    view.unmount();
    render(<MemoryRouter initialEntries={['/account?tab=accounts']}><AccountPage/></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Linked Providers' });
    expect(vi.mocked(apiClient.get).mock.calls.some(([path]) => String(path).includes('/users/me/providers'))).toBe(false);
});

it.each([['avatar', 'profile'], ['banner', 'banner']])('uploads the account %s with the backend-supported %s context', async (asset, context) => {
    render(<MemoryRouter><AccountPage /></MemoryRouter>);
    const input = await screen.findByLabelText(`Upload profile ${asset}`);
    const file = new File(['synthetic-image'], 'test.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/media/upload', expect.any(FormData), expect.objectContaining({ params: { context } })));
    expect((vi.mocked(apiClient.post).mock.calls[0][1] as FormData).get('file')).toBe(file);
    expect(await screen.findByText(`${asset === 'avatar' ? 'Avatar' : 'Banner'} updated in the draft form.`)).toBeInTheDocument();
});

it('replaces the deferred security slot with the real authenticator controls for this account', async () => {
    render(<MemoryRouter initialEntries={['/account?tab=security']}><AccountPage /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Authenticator Security' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Set up authenticator' })).toBeInTheDocument();
    expect(screen.queryByText(/intentionally deferred/)).not.toBeInTheDocument();
});

const codes = Array.from({ length: 10 }, (_, index) => `abcdef-123456-abcdef-${String(index).padStart(6, '0')}`);
const accountData = {
    id: 7, username: 'example', email: 'example@example.test', displayName: 'Example User', role: 'FAN', fullName: 'Example User',
    emailVerified: true, passwordLoginEnabled: true, linkedAccounts: [], sessionsSupported: true, sessionRevocationSupported: true, accountDeletionSupported: false,
};

it('shows a cancelled tryout independently of its retained accepted application', async () => {
    vi.mocked(apiClient.get).mockImplementation(async path => ({ data: path === '/users/me/account' ? { ...accountData, role: 'PLAYER' }
        : path === '/tryouts/my-applications' ? [{ id: 1, tryoutId: 9, tryoutTitle: 'Cancelled academy session', status: 'ACCEPTED', appliedAt: '2026-09-19T12:00:00', tryoutLifecycleStatus: 'CANCELLED', cancelledAt: '2026-09-20T12:00:00' }]
        : { sessions: [], activeCount: 1, revokedCount: 0, expiredCount: 0 } }));
    render(<MemoryRouter><AccountPage/></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /View My Tryout Applications/ }));
    expect(await screen.findByText('Cancelled academy session')).toBeVisible();
    expect(screen.getByText('ACCEPTED')).toBeVisible();
    expect(screen.getByText(/Your accepted decision and existing club affiliation are retained/)).toBeVisible();
});

it('discards delayed application outcomes after the account session is replaced', async () => {
    let resolve!: (value: unknown) => void;
    const pending = new Promise(done => { resolve = done; });
    vi.mocked(apiClient.get).mockImplementation(async path => path === '/tryouts/my-applications' ? pending as never : { data: path === '/users/me/account' ? { ...accountData, role: 'PLAYER' } : { sessions: [], activeCount: 1, revokedCount: 0, expiredCount: 0 } });
    const view = render(<MemoryRouter><AccountPage/></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /View My Tryout Applications/ }));
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/tryouts/my-applications', expect.anything()));
    clearStoredAuth(); setStoredAccessToken('replacement');
    vi.mocked(useAuth).mockReturnValue({ user: { id: 8 }, sessionId: getAuthSessionId(), bootstrapSession: vi.fn(), logout: vi.fn() } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(apiClient.get).mockImplementation(async path => ({ data: path === '/users/me/account' ? { ...accountData, id: 8 } : { sessions: [], activeCount: 1, revokedCount: 0, expiredCount: 0 } }));
    view.rerender(<MemoryRouter><AccountPage/></MemoryRouter>);
    await act(async () => { resolve({ data: [{ id: 1, tryoutId: 9, tryoutTitle: 'Private previous outcome', status: 'ACCEPTED', appliedAt: '2026-09-19', tryoutLifecycleStatus: 'CANCELLED' }] }); });
    expect(screen.queryByText('Private previous outcome')).not.toBeInTheDocument();
    expect(screen.queryByText('My Submitted Applications')).not.toBeInTheDocument();
});
const oldSessions = { sessions: [{ id: 1, current: true, status: 'ACTIVE' }, { id: 2, current: false, status: 'ACTIVE' }], activeCount: 2, revokedCount: 0, expiredCount: 0 };
const renewedSessions = { sessions: [{ id: 1, current: false, status: 'REVOKED' }, { id: 2, current: false, status: 'REVOKED' }, { id: 3, current: true, status: 'ACTIVE' }], activeCount: 1, revokedCount: 2, expiredCount: 0 };
const latch = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => { resolve = done; });
    return { promise, resolve };
};
const configureSecurity = ({ enabled = false, initialSessions, refreshedAccount, refreshedSessions }: {
    enabled?: boolean;
    initialSessions?: Promise<{ data: typeof oldSessions }>;
    refreshedAccount?: Promise<{ data: typeof accountData }>;
    refreshedSessions?: () => Promise<{ data: typeof renewedSessions }>;
} = {}) => {
    let renewed = false;
    let factorEnabled = enabled;
    vi.mocked(apiClient.get).mockImplementation(async path => {
        if (path === '/users/me/account') return renewed && refreshedAccount ? refreshedAccount : { data: accountData };
        if (path === '/auth/sessions') return renewed ? refreshedSessions?.() ?? { data: renewedSessions } : initialSessions ?? { data: oldSessions };
        return { data: { available: true, enabled: factorEnabled, recoveryCodesRemaining: factorEnabled ? 10 : 0 } };
    });
    vi.mocked(apiClient.post).mockImplementation(async path => {
        if (path.endsWith('/setup')) return { data: { secret: 'JBSWY3DPEHPK3PXP', authenticatorUri: 'otpauth://totp/GrassKickZ:test?secret=JBSWY3DPEHPK3PXP', expiresIn: 600 } };
        renewed = true;
        factorEnabled = !path.endsWith('/disable');
        return { data: { enabled: factorEnabled, accessToken: 'renewed-token', recoveryCodes: factorEnabled ? codes : undefined } };
    });
};
const enroll = async () => {
    await screen.findByRole('button', { name: 'Set up authenticator' });
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'SyntheticPassword1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set up authenticator' }));
    fireEvent.change(await screen.findByLabelText('Six-digit authenticator code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enable authenticator' }));
    return screen.findByLabelText('Recovery codes');
};
const acknowledgeCodes = () => {
    fireEvent.click(screen.getByRole('checkbox', { name: /I saved these recovery codes/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Done saving codes' }));
};
const expectRenewedSessions = async () => {
    const old = await screen.findByText('Remembered Session #1');
    expect(within(old.closest('article') as HTMLElement).getByText('REVOKED')).toBeInTheDocument();
    expect(within(screen.getByText('Remembered Session #2').closest('article') as HTMLElement).getByText('REVOKED')).toBeInTheDocument();
    expect(within(screen.getByText('Current Browser Session').closest('article') as HTMLElement).getByText('ACTIVE')).toBeInTheDocument();
};

it('refreshes the renewed session inventory without unmounting recovery codes or replacing profile drafts', async () => {
    const accountRefresh = latch<{ data: typeof accountData }>();
    const sessionRefresh = latch<{ data: typeof renewedSessions }>();
    configureSecurity({ refreshedAccount: accountRefresh.promise, refreshedSessions: () => sessionRefresh.promise });
    render(<MemoryRouter><AccountPage /></MemoryRouter>);
    fireEvent.change(await screen.findByLabelText('Display Name'), { target: { value: 'Unsaved profile draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Security' }));
    const recoveryNode = await enroll();
    expect(recoveryNode).toHaveTextContent(codes[0]);
    expect(vi.mocked(apiClient.get).mock.calls.filter(([path]) => path === '/auth/sessions')).toHaveLength(2);
    expect(vi.mocked(apiClient.get).mock.calls.filter(([path]) => path === '/users/me/account')).toHaveLength(2);
    const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: 'Sessions' }));
    expect(confirmation).toHaveBeenCalled(); expect(screen.getByLabelText('Recovery codes')).toBe(recoveryNode);
    await act(async () => {
        accountRefresh.resolve({ data: { ...accountData, fullName: 'Updated server name' } });
        sessionRefresh.resolve({ data: renewedSessions });
    });
    expect(screen.getByLabelText('Recovery codes')).toBe(recoveryNode);
    expect(screen.getByRole('button', { name: 'Done saving codes' })).toBeDisabled();
    acknowledgeCodes(); fireEvent.click(screen.getByRole('button', { name: 'Sessions' }));
    await expectRenewedSessions();
    fireEvent.click(screen.getByRole('button', { name: 'Profile' }));
    expect(screen.getByLabelText('Display Name')).toHaveValue('Unsaved profile draft');
});

it('refreshes revoked and replacement sessions after disabling an authenticator', async () => {
    configureSecurity({ enabled: true });
    render(<MemoryRouter initialEntries={['/account?tab=security']}><AccountPage /></MemoryRouter>);
    await screen.findByText('10 unused recovery codes remain.');
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'SyntheticPassword1' } });
    fireEvent.change(screen.getByLabelText('Authenticator or unused recovery code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Disable authenticator' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm disable' }));
    await screen.findByText('Authenticator not enabled');
    fireEvent.click(screen.getByRole('button', { name: 'Sessions' }));
    await expectRenewedSessions();
    expect(vi.mocked(apiClient.get).mock.calls.filter(([path]) => path === '/users/me/account')).toHaveLength(2);
});

it('does not let an older session read overwrite the inventory refreshed after enrollment', async () => {
    const initial = latch<{ data: typeof oldSessions }>();
    configureSecurity({ initialSessions: initial.promise });
    render(<MemoryRouter initialEntries={['/account?tab=security']}><AccountPage /></MemoryRouter>);
    await enroll();
    await act(async () => initial.resolve({ data: oldSessions }));
    acknowledgeCodes(); fireEvent.click(screen.getByRole('button', { name: 'Sessions' }));
    await expectRenewedSessions();
});

it('keeps recovery codes after a metadata refresh failure and offers a session read retry', async () => {
    const refresh = vi.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValue({ data: renewedSessions });
    configureSecurity({ refreshedSessions: refresh });
    render(<MemoryRouter initialEntries={['/account?tab=security']}><AccountPage /></MemoryRouter>);
    const recoveryNode = await enroll();
    expect(recoveryNode).toHaveTextContent(codes[9]);
    acknowledgeCodes(); fireEvent.click(screen.getByRole('button', { name: 'Sessions' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load remembered sessions.');
    expect(screen.queryByText('Current Browser Session')).not.toBeInTheDocument();
    expect(screen.queryByText('No remembered sessions are currently recorded for this account.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry sessions' }));
    await expectRenewedSessions();
});

it('discards retired account metadata when another account signs in during the background refresh', async () => {
    const accountRefresh = latch<{ data: typeof accountData }>();
    const sessionRefresh = latch<{ data: typeof renewedSessions }>();
    configureSecurity({ refreshedAccount: accountRefresh.promise, refreshedSessions: () => sessionRefresh.promise });
    const view = render(<MemoryRouter initialEntries={['/account?tab=security']}><AccountPage /></MemoryRouter>);
    await enroll();
    const replacement = { ...accountData, id: 8, displayName: 'Replacement User' };
    vi.mocked(apiClient.get).mockImplementation(async path => ({ data: path === '/users/me/account' ? replacement : path === '/auth/sessions'
        ? { sessions: [{ id: 99, current: false, status: 'ACTIVE' }], activeCount: 1, revokedCount: 0, expiredCount: 0 }
        : { available: true, enabled: false, recoveryCodesRemaining: 0 } }));
    act(() => {
        setStoredAccessToken('replacement-account');
        vi.mocked(useAuth).mockReturnValue({ user: { id: 8 }, sessionId: getAuthSessionId(), bootstrapSession: vi.fn() } as unknown as ReturnType<typeof useAuth>);
    });
    view.rerender(<MemoryRouter initialEntries={['/account?tab=security']}><AccountPage /></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Replacement User' });
    await act(async () => {
        accountRefresh.resolve({ data: accountData });
        sessionRefresh.resolve({ data: renewedSessions });
    });
    expect(screen.getByRole('heading', { name: 'Replacement User' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Recovery codes')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sessions' }));
    expect(await screen.findByText('Remembered Session #99')).toBeInTheDocument();
    expect(screen.queryByText('Remembered Session #1')).not.toBeInTheDocument();
});

it('signs out after password change instead of reading metadata with credentials the server revoked', async () => {
    configureSecurity();
    render(<MemoryRouter initialEntries={['/account?tab=security']}><AccountPage /></MemoryRouter>);
    fireEvent.change(await screen.findByLabelText('Current Password'), { target: { value: 'OldPassword1' } });
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'NewPassword1' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'NewPassword1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));
    await screen.findByText('Password changed. Sign in again with your new password.');
    expect(useAuth().logout).toHaveBeenCalledTimes(1);
    expect(vi.mocked(apiClient.get).mock.calls.filter(([path]) => path === '/users/me/account')).toHaveLength(1);
});
