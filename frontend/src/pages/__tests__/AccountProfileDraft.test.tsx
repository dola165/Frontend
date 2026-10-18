import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../../i18n';
import { AccountPage } from '../AccountPage';
import { apiClient } from '../../api/axiosConfig';
import { useAuth } from '../../context/AuthContext';
import { clearStoredAuth, getAuthSessionId, setStoredAccessToken } from '../../utils/authStorage';
import { AuthSessionBoundary } from '../../context/AuthSessionBoundary';

vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), put: vi.fn(), post: vi.fn() }, DEPLOYMENT_URLS: { mediaBaseUrl: '' } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../features/clubs/api', () => ({ fetchMyPlayerCards: vi.fn().mockResolvedValue([]), activatePlayerCard: vi.fn() }));
vi.mock('../../features/journey/components/ClubJourneyPanel', () => ({ ClubJourneyPanel: () => null }));
const initial = { id: 7, username: 'synthetic', email: 'synthetic@example.test', displayName: 'Original Person', role: 'FAN',
    fullName: 'Original Person', bio: 'Saved bio', emailVerified: false, passwordLoginEnabled: true, linkedAccounts: [],
    sessionsSupported: true, sessionRevocationSupported: true, accountDeletionSupported: false };
let account = { ...initial };
const bootstrap = vi.fn();
const latch = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
const view = () => <MemoryRouter initialEntries={['/account?tab=profile']}><AuthSessionBoundary><AccountPage /></AuthSessionBoundary></MemoryRouter>;
const mount = () => render(view());

beforeEach(async () => {
    vi.clearAllMocks(); localStorage.clear(); clearStoredAuth(); setStoredAccessToken('profile-draft-token');
    await i18n.changeLanguage('en'); account = { ...initial };
    bootstrap.mockResolvedValue({ id: 7 });
    vi.mocked(useAuth).mockReturnValue({ user: { id: 7 }, sessionId: getAuthSessionId(), bootstrapSession: bootstrap, logout: vi.fn() } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(apiClient.get).mockImplementation(async path => ({ data: path === '/users/me/account' ? account : path === '/auth/sessions'
        ? { sessions: [], activeCount: 1, revokedCount: 0, expiredCount: 0 } : [] }));
    vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
    vi.mocked(apiClient.post).mockResolvedValue({ data: { message: 'Verification email sent.' } });
});
afterEach(async () => { cleanup(); clearStoredAuth(); await i18n.changeLanguage('en'); });

it('retains newer edits made while the acknowledged profile save is still in flight', async () => {
    const write = latch<{ data: object }>(); vi.mocked(apiClient.put).mockReturnValue(write.promise);
    mount();
    fireEvent.change(await screen.findByRole('textbox', { name: 'Display Name' }), { target: { value: 'Name sent' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Profile' }));
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByRole('textbox', { name: 'Display Name' }), { target: { value: 'Newer unsaved name' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Bio' }), { target: { value: 'Newer unsaved bio' } });
    account = { ...account, fullName: 'Name sent' };
    await act(async () => write.resolve({ data: {} }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Profile' })).not.toBeDisabled());
    expect(screen.getByRole('textbox', { name: 'Display Name' })).toHaveValue('Newer unsaved name');
    expect(screen.getByRole('textbox', { name: 'Bio' })).toHaveValue('Newer unsaved bio');
    expect(screen.getByRole('status')).toHaveTextContent('Your newer changes are still here and have not been saved.');
    expect(apiClient.put).toHaveBeenCalledTimes(1);
});

it('keeps a confirmed save receipt and retries only account refresh, preserving edits while that retry runs', async () => {
    let written = false, failed = false;
    vi.mocked(apiClient.put).mockImplementation(async () => { written = true; return { data: {} }; });
    vi.mocked(apiClient.get).mockImplementation(async path => {
        if (path === '/users/me/account' && written && !failed) { failed = true; throw new Error('offline'); }
        return { data: path === '/users/me/account' ? account : path === '/auth/sessions' ? { sessions: [] } : [] };
    });
    mount();
    fireEvent.change(await screen.findByRole('textbox', { name: 'Bio' }), { target: { value: 'Saved text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Profile' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Profile saved. Account details couldn’t refresh.');
    expect(bootstrap).not.toHaveBeenCalled();
    const refresh = latch<{ data: typeof account }>();
    vi.mocked(apiClient.get).mockImplementation(async path => path === '/users/me/account' ? refresh.promise : { data: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh account details' }));
    expect(screen.getByRole('status')).toHaveTextContent('Profile saved. Refreshing account details…');
    expect(screen.getByRole('button', { name: 'Save Profile' })).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: 'Bio' }), { target: { value: 'Newer text during refresh' } });
    await act(async () => refresh.resolve({ data: { ...account, bio: 'Saved text' } }));
    expect(screen.getByRole('textbox', { name: 'Bio' })).toHaveValue('Newer text during refresh');
    expect(screen.getByRole('status')).toHaveTextContent('Your newer changes are still here and have not been saved.');
    expect(apiClient.put).toHaveBeenCalledTimes(1);
    expect(bootstrap).toHaveBeenCalledTimes(1);
});

it('does not turn a failed write into success, and translates its kept-draft feedback without resubmitting', async () => {
    vi.mocked(apiClient.put).mockRejectedValue(new Error('offline'));
    mount();
    fireEvent.change(await screen.findByRole('textbox', { name: 'Bio' }), { target: { value: 'Keep this draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Profile' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not confirm your profile save. Your draft is kept.');
    await act(async () => { await i18n.changeLanguage('ka'); });
    expect(screen.getByRole('alert')).toHaveTextContent('პროფილის შენახვა ვერ დადასტურდა. მონახაზი შენახულია.');
    expect(screen.getByRole('textbox', { name: 'ჩემ შესახებ' })).toHaveValue('Keep this draft');
    expect(screen.queryByText('პროფილი შენახულია.')).not.toBeInTheDocument();
    expect(apiClient.put).toHaveBeenCalledTimes(1);
    expect(bootstrap).not.toHaveBeenCalled();
});

it('keeps concurrent text edits while a draft avatar uploads, then includes that image in the next save', async () => {
    const upload = latch<{ data: { url: string } }>(); vi.mocked(apiClient.post).mockReturnValue(upload.promise);
    mount(); await screen.findByRole('textbox', { name: 'Bio' });
    const input = screen.getByLabelText('Upload profile avatar');
    fireEvent.change(input, { target: { files: [new File(['synthetic'], 'avatar.png', { type: 'image/png' })] } });
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Save Profile' })).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: 'Bio' }), { target: { value: 'Edited during upload' } });
    await act(async () => upload.resolve({ data: { url: '/uploads/synthetic-avatar.png' } }));
    expect(screen.getByRole('textbox', { name: 'Bio' })).toHaveValue('Edited during upload');
    expect(screen.getByRole('status')).toHaveTextContent('Avatar updated in the draft form.');
    fireEvent.click(screen.getByRole('button', { name: 'Save Profile' }));
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/users/me', expect.objectContaining({ avatarUrl: '/uploads/synthetic-avatar.png', bio: 'Edited during upload' }), expect.objectContaining({ _authSessionId: getAuthSessionId() })));
});

it('discards a late saved response after login replacement instead of bootstrapping the next account', async () => {
    const write = latch<{ data: object }>(); vi.mocked(apiClient.put).mockReturnValue(write.promise);
    const rendered = mount(); await screen.findByRole('textbox', { name: 'Bio' });
    fireEvent.click(screen.getByRole('button', { name: 'Save Profile' }));
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledTimes(1));
    clearStoredAuth(); setStoredAccessToken('replacement-account-token'); account = { ...initial, id: 8, fullName: 'Next Person' };
    vi.mocked(useAuth).mockReturnValue({ user: { id: 8 }, sessionId: getAuthSessionId(), bootstrapSession: bootstrap, logout: vi.fn() } as unknown as ReturnType<typeof useAuth>);
    rendered.rerender(view());
    await screen.findByDisplayValue('Next Person');
    await act(async () => write.resolve({ data: {} }));
    expect(bootstrap).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: 'Display Name' })).toHaveValue('Next Person');
    expect(screen.queryByText('Profile saved.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Profile' })).not.toBeDisabled();
});

it('keeps the confirmed save distinct from an unresolved authentication metadata refresh', async () => {
    bootstrap.mockResolvedValueOnce(null);
    mount(); await screen.findByRole('textbox', { name: 'Bio' });
    fireEvent.click(screen.getByRole('button', { name: 'Save Profile' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Profile saved. Account details couldn’t refresh.');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh account details' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/^Profile saved\.$/));
    expect(apiClient.put).toHaveBeenCalledTimes(1);
    expect(bootstrap).toHaveBeenCalledTimes(2);
});

it('keeps the profile draft when a verification email refreshes account metadata', async () => {
    mount();
    fireEvent.change(await screen.findByRole('textbox', { name: 'Bio' }), { target: { value: 'Unsent personal bio' } });
    fireEvent.click(screen.getByRole('button', { name: 'Security' }));
    fireEvent.click(screen.getByRole('button', { name: 'Resend Email' }));
    await waitFor(() => expect(bootstrap).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Profile' }));
    expect(screen.getByRole('textbox', { name: 'Bio' })).toHaveValue('Unsent personal bio');
    expect(apiClient.put).not.toHaveBeenCalled();
});
