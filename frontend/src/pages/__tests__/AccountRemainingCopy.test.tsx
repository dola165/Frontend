import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../../i18n';
import { AccountPage } from '../AccountPage';
import { apiClient } from '../../api/axiosConfig';
import { useAuth } from '../../context/AuthContext';
import { clearStoredAuth, getAuthSessionId, setStoredAccessToken } from '../../utils/authStorage';

vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), put: vi.fn(), post: vi.fn() }, DEPLOYMENT_URLS: { mediaBaseUrl: '' } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../features/clubs/api', () => ({ fetchMyPlayerCards: () => Promise.resolve([]), activatePlayerCard: vi.fn() }));
vi.mock('../../features/journey/components/ClubJourneyPanel', () => ({ ClubJourneyPanel: () => null }));
const account = { id: 7, username: 'synthetic', email: 'synthetic@example.test', displayName: 'Synthetic Person', role: 'FAN',
    emailVerified: true, passwordLoginEnabled: true, linkedAccounts: [{ provider: 'google' }, { provider: 'example' }],
    sessionsSupported: true, sessionRevocationSupported: true, accountDeletionSupported: false };
const sessions = { activeCount: 1, revokedCount: 1, expiredCount: 1, sessions: [
    { id: 71, current: true, status: 'ACTIVE', expiresAt: '2026-10-20T00:00:00Z' },
    { id: 72, current: false, status: 'REVOKED' }, { id: 73, current: false, status: 'EXPIRED' },
] };
const dataFor = (path: string) => path === '/users/me/account' ? account : path === '/auth/sessions' ? sessions : [];
const mount = (tab = 'sessions') => render(<MemoryRouter initialEntries={[`/account?tab=${tab}`]}><AccountPage /></MemoryRouter>);
const language = (value: string) => act(async () => { await i18n.changeLanguage(value); });

beforeEach(async () => {
    vi.resetAllMocks(); localStorage.clear(); clearStoredAuth(); setStoredAccessToken('account-remaining-copy'); await i18n.changeLanguage('en');
    vi.stubEnv('DEV', false); vi.stubEnv('VITE_ACCOUNT_SECURITY_EXTENSIONS', 'false');
    vi.mocked(useAuth).mockReturnValue({ user: { id: 7 }, sessionId: getAuthSessionId(), bootstrapSession: vi.fn(), logout: vi.fn() } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(apiClient.get).mockImplementation(async path => ({ data: dataFor(path) }));
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
});
afterEach(async () => { cleanup(); clearStoredAuth(); vi.unstubAllEnvs(); await i18n.changeLanguage('en'); });

it.each([false, true])('does not advertise deletion without a usable control when server support is %s', async supported => {
    vi.mocked(apiClient.get).mockImplementation(async path => ({ data: path === '/users/me/account' ? { ...account, accountDeletionSupported: supported } : dataFor(path) }));
    mount('danger'); await screen.findByRole('heading', { name: 'Danger Zone' });
    expect(screen.queryByText('Account deletion is available for this account.')).not.toBeInTheDocument();
    expect(screen.getByText('Account deletion is not available on this page.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete|deletion/i })).not.toBeInTheDocument();
    await language('ka');
    expect(screen.getByText('ამ გვერდიდან ანგარიშს ვერ წაშლით.')).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
});

it('keeps the current browser, session identities, counts and states when switching language without reads or revocation', async () => {
    mount(); await screen.findByText('Current Browser Session');
    const reads = vi.mocked(apiClient.get).mock.calls.length;
    await language('ka');
    const rows = screen.getAllByRole('article');
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText('ამ ბრაუზერის სესია')).toBeInTheDocument();
    expect(within(rows[0]).getByText('აქტიური')).toBeInTheDocument();
    expect(within(rows[0]).getByText('მიმდინარე')).toBeInTheDocument();
    expect(within(rows[0]).getByText(/^სესიის ვადა იწურება:/)).toBeInTheDocument();
    expect(rows[1]).toHaveTextContent('შენახული სესია #72'); expect(rows[1]).toHaveTextContent('გაუქმებული');
    expect(rows[2]).toHaveTextContent('შენახული სესია #73'); expect(rows[2]).toHaveTextContent('ვადაგასული');
    expect(within(rows[1]).queryByText('მიმდინარე')).not.toBeInTheDocument();
    expect(screen.getAllByText('1')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'სხვა სესიებიდან გამოსვლა' })).toBeEnabled();
    expect(apiClient.get).toHaveBeenCalledTimes(reads); expect(apiClient.post).not.toHaveBeenCalled();
});

it.each([false, true])('keeps a failed session read distinct from empty sessions, translating known copy only (unknown=%s)', async unknown => {
    let attempts = 0;
    const serverMessage = 'Synthetic session read detail';
    vi.mocked(apiClient.get).mockImplementation(async path => {
        if (path === '/auth/sessions' && ++attempts === 1) throw unknown ? { response: { data: { message: serverMessage } } } : new Error('Offline');
        return { data: dataFor(path) };
    });
    mount(); await screen.findByRole('alert'); await language('ka');
    expect(screen.getByRole('alert')).toHaveTextContent(unknown ? serverMessage : 'შენახული სესიები ვერ ჩაიტვირთა.');
    expect(screen.queryByText('ამ ანგარიშისთვის შენახული სესიები არ არის.')).not.toBeInTheDocument();
    expect(screen.queryByText('აქტიური')).not.toBeInTheDocument(); expect(attempts).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'სესიების ხელახლა ჩატვირთვა' }));
    expect(await screen.findByText('ამ ბრაუზერის სესია')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument(); expect(attempts).toBe(2);
    expect(apiClient.post).not.toHaveBeenCalled();
});

it('translates a pending session read and keeps sign-out disabled until it completes', async () => {
    let resolve!: (value: { data: typeof sessions }) => void;
    const response = new Promise<{ data: typeof sessions }>(done => { resolve = done; });
    vi.mocked(apiClient.get).mockImplementation(async path => path === '/auth/sessions' ? response : { data: dataFor(path) });
    mount(); await screen.findByRole('heading', { name: 'Signed-in devices' });
    await language('ka');
    expect(screen.getByRole('status', { name: 'შენახული სესიები იტვირთება…' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'სხვა სესიებიდან გამოსვლა' })).toBeDisabled();
    await act(async () => resolve({ data: sessions }));
    expect(screen.getByText('ამ ბრაუზერის სესია')).toBeInTheDocument(); expect(apiClient.post).not.toHaveBeenCalled();
});

it('retains a pending revoke and its current-session state when the language changes', async () => {
    let resolve!: (value: { data: object }) => void;
    const response = new Promise<{ data: object }>(done => { resolve = done; });
    vi.mocked(apiClient.post).mockReturnValue(response);
    mount(); await screen.findByText('Current Browser Session');
    fireEvent.click(screen.getByRole('button', { name: 'Sign Out Others' })); await language('ka');
    expect(screen.getByRole('button', { name: 'სხვა სესიებიდან გამოსვლა' })).toBeDisabled();
    expect(screen.getByText('ამ ბრაუზერის სესია')).toBeInTheDocument();
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect(apiClient.post).toHaveBeenCalledWith('/auth/sessions/revoke-others', {}, expect.anything());
    await act(async () => resolve({ data: {} }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'სხვა სესიებიდან გამოსვლა' })).toBeEnabled());
    expect(screen.getByText('სხვა შენახულ სესიებში ანგარიშიდან გამოსვლა შესრულდა.')).toBeInTheDocument();
    expect(screen.getByText('ამ ბრაუზერის სესია')).toBeInTheDocument();
});

it('translates connected-provider summaries without changing provider identities or the production extension gate', async () => {
    mount('accounts'); await screen.findByRole('heading', { name: 'Capability Summary' });
    const reads = vi.mocked(apiClient.get).mock.calls.length;
    await language('ka');
    expect(screen.getByText('პაროლით შესვლა')).toBeInTheDocument(); expect(screen.getByText('ჩართულია')).toBeInTheDocument();
    expect(screen.getByText('2 დაკავშირებულია')).toBeInTheDocument();
    expect(screen.getByText('Google')).toBeInTheDocument(); expect(screen.getByText('Example')).toBeInTheDocument();
    expect(screen.getAllByText('დაკავშირებული ანგარიში')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Google-ის დაკავშირება' })).not.toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledTimes(reads); expect(apiClient.post).not.toHaveBeenCalled();
});

it('shows unsupported session inventory without a sign-out control or false empty counts', async () => {
    vi.mocked(apiClient.get).mockImplementation(async path => ({ data: path === '/users/me/account' ? { ...account, sessionsSupported: false, sessionRevocationSupported: false } : dataFor(path) }));
    await language('ka'); mount();
    expect(await screen.findByText('ამ ანგარიშისთვის სესიების სია მიუწვდომელია.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'სხვა სესიებიდან გამოსვლა' })).not.toBeInTheDocument();
    expect(screen.queryByText('აქტიური')).not.toBeInTheDocument(); expect(apiClient.post).not.toHaveBeenCalled();
});
