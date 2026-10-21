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
const account = { id: 7, username: 'synthetic', email: 'synthetic@example.test', displayName: 'Synthetic Person', role: 'PLAYER',
    fullName: 'Synthetic Person', bio: 'Stored bio', emailVerified: false, passwordLoginEnabled: true, linkedAccounts: [],
    sessionsSupported: true, sessionRevocationSupported: true, accountDeletionSupported: false,
    playerProfile: { primaryPosition: 'Centre-Back', preferredFoot: 'RIGHT', heightCm: 175, weightKg: 70, availabilityStatus: 'AVAILABLE' } };
const dataFor = (path: string) => path === '/users/me/account' ? account : path === '/auth/sessions'
    ? { sessions: [], activeCount: 1, revokedCount: 0, expiredCount: 0 } : path.includes('two-factor')
        ? { available: true, enabled: true, recoveryCodesRemaining: 2 } : [];
const bootstrap = vi.fn();
const logout = vi.fn();
const mount = () => render(<MemoryRouter initialEntries={['/account?tab=profile']}><AccountPage /></MemoryRouter>);
const language = (value: string) => act(async () => { await i18n.changeLanguage(value); });
const section = (title: string) => screen.getByRole('heading', { name: title }).closest('section')!;

beforeEach(async () => {
    vi.resetAllMocks(); localStorage.clear(); clearStoredAuth(); setStoredAccessToken('account-copy-token'); await i18n.changeLanguage('en');
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected fixture transport'); }));
    vi.stubGlobal('XMLHttpRequest', vi.fn(() => { throw new Error('Unexpected fixture transport'); }));
    bootstrap.mockResolvedValue({ id: 7 });
    vi.mocked(useAuth).mockReturnValue({ user: { id: 7 }, sessionId: getAuthSessionId(), bootstrapSession: bootstrap, logout } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(apiClient.get).mockImplementation(async path => ({ data: dataFor(path) }));
    vi.mocked(apiClient.put).mockResolvedValue({ data: {} }); vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
});
afterEach(async () => {
    cleanup(); clearStoredAuth(); await i18n.changeLanguage('en');
    expect(fetch).not.toHaveBeenCalled(); expect(XMLHttpRequest).not.toHaveBeenCalled(); vi.unstubAllGlobals();
});

describe('account error origin', () => {
    it.each([
        ['account', 'detail', 'Profile'],
        ['account', 'message', 'Failed to load your account center.'],
        ['sessions', 'detail', 'Security'],
        ['sessions', 'message', 'Failed to load remembered sessions.'],
    ])('keeps raw %s %s literal under Georgian, including owned-copy collision %s', async (target, field, literal) => {
        await language('ka');
        const path = target === 'account' ? '/users/me/account' : '/auth/sessions';
        vi.mocked(apiClient.get).mockImplementation(async requested => {
            if (requested === path) throw { response: { status: 400, data: { [field]: literal } } };
            return { data: dataFor(requested) };
        });
        mount();
        let explanation: Node;
        if (target === 'account') {
            const heading = await screen.findByRole('heading', { name: 'ანგარიშის მონაცემები ვერ ჩაიტვირთა' });
            explanation = heading.parentElement!.querySelector('p')!;
        } else {
            fireEvent.click(await screen.findByRole('button', { name: 'სესიები' }));
            explanation = (await screen.findByRole('alert')).firstChild!;
        }
        expect(explanation.textContent).toBe(literal);
        const reads = vi.mocked(apiClient.get).mock.calls.length;
        await language('en');
        expect(explanation.textContent).toBe(literal);
        expect(apiClient.get).toHaveBeenCalledTimes(reads);
        expect(apiClient.post).not.toHaveBeenCalled(); expect(apiClient.put).not.toHaveBeenCalled();
    });

    it('localizes the owned session-load fallback and retries only the failed read', async () => {
        vi.mocked(apiClient.get).mockImplementation(async path => {
            if (path === '/auth/sessions') throw new Error('offline');
            return { data: dataFor(path) };
        });
        mount(); fireEvent.click(await screen.findByRole('button', { name: 'Sessions' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load remembered sessions.');
        const reads = vi.mocked(apiClient.get).mock.calls.length;
        await language('ka');
        expect(screen.getByRole('alert')).toHaveTextContent('შენახული სესიები ვერ ჩაიტვირთა.');
        expect(apiClient.get).toHaveBeenCalledTimes(reads);
        vi.mocked(apiClient.get).mockImplementation(async path => ({ data: dataFor(path) }));
        fireEvent.click(screen.getByRole('button', { name: 'სესიების ხელახლა ჩატვირთვა' }));
        await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
        expect(vi.mocked(apiClient.get).mock.calls.filter(([path]) => path === '/auth/sessions')).toHaveLength(2);
        expect(vi.mocked(apiClient.get).mock.calls.filter(([path]) => path === '/users/me/account')).toHaveLength(1);
        expect(apiClient.post).not.toHaveBeenCalled(); expect(apiClient.put).not.toHaveBeenCalled();
    });

    const operations = [
        ['verification', 'Failed to send verification email.', 'დადასტურების წერილი ვერ გაიგზავნა.'],
        ['password', 'Failed to change password.', 'პაროლი ვერ შეიცვალა.'],
        ['revoke', 'Failed to sign out other remembered sessions.', 'სხვა შენახული სესიებიდან გამოსვლა ვერ მოხერხდა.'],
    ] as const;
    const failOperation = async (operation: typeof operations[number][0], failure: unknown, georgian = false) => {
        vi.mocked(apiClient.post).mockRejectedValue(failure);
        mount(); await screen.findByRole('textbox', { name: georgian ? 'ჩემ შესახებ' : 'Bio' });
        fireEvent.click(screen.getByRole('button', { name: operation === 'revoke' ? (georgian ? 'სესიები' : 'Sessions') : (georgian ? 'უსაფრთხოება' : 'Security') }));
        if (operation !== 'revoke') {
            const passwords = within(section(georgian ? 'ელფოსტა და პაროლი' : 'Email And Password'));
            fireEvent.change(passwords.getByLabelText(georgian ? 'მიმდინარე პაროლი' : 'Current Password'), { target: { value: 'SyntheticCurrent1' } });
            fireEvent.change(passwords.getByLabelText(georgian ? 'ახალი პაროლი' : 'New Password'), { target: { value: 'SyntheticNew123' } });
            fireEvent.change(passwords.getByLabelText(georgian ? 'გაიმეორეთ პაროლი' : 'Confirm Password'), { target: { value: 'SyntheticNew123' } });
        }
        const action = operation === 'verification' ? (georgian ? 'წერილის ხელახლა გაგზავნა' : 'Resend Email')
            : operation === 'password' ? (georgian ? 'პაროლის შეცვლა' : 'Change Password') : (georgian ? 'სხვა სესიებიდან გამოსვლა' : 'Sign Out Others');
        fireEvent.click(screen.getByRole('button', { name: action }));
        await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(1));
        if (operation === 'verification') expect(apiClient.post).toHaveBeenCalledWith('/auth/send-verification');
        else expect(apiClient.post).toHaveBeenCalledWith(operation === 'password' ? '/auth/change-password' : '/auth/sessions/revoke-others',
            operation === 'password' ? { currentPassword: 'SyntheticCurrent1', newPassword: 'SyntheticNew123' } : {}, expect.objectContaining({ signal: expect.any(AbortSignal), _skipAuthRefresh: true }));
    };
    const unchangedAfterLanguage = async (reads: number) => {
        await language('ka');
        expect(apiClient.get).toHaveBeenCalledTimes(reads); expect(apiClient.post).toHaveBeenCalledTimes(1);
        expect(apiClient.put).not.toHaveBeenCalled(); expect(bootstrap).not.toHaveBeenCalled(); expect(logout).not.toHaveBeenCalled();
    };

    it.each(operations)('keeps the %s server error literal when it equals the owned fallback', async (operation, literal) => {
        await language('ka');
        await failOperation(operation, { response: { status: 400, data: { message: literal } } }, true);
        expect(await screen.findByText(literal, { exact: true })).toBeInTheDocument();
        const reads = vi.mocked(apiClient.get).mock.calls.length;
        await language('en');
        await unchangedAfterLanguage(reads);
        expect(screen.getByText(literal, { exact: true })).toBeInTheDocument();
    });

    it.each(operations)('localizes the owned %s fallback without repeating the failed request or losing drafts', async (operation, english, georgian) => {
        await failOperation(operation, new Error('offline'));
        await screen.findByText(english, { exact: true });
        const reads = vi.mocked(apiClient.get).mock.calls.length;
        await unchangedAfterLanguage(reads);
        expect(screen.getByText(georgian, { exact: true })).toBeInTheDocument();
        if (operation !== 'revoke') {
            const passwords = within(section('ელფოსტა და პაროლი'));
            expect(passwords.getByLabelText('მიმდინარე პაროლი')).toHaveValue('SyntheticCurrent1');
            expect(passwords.getByLabelText('ახალი პაროლი')).toHaveValue('SyntheticNew123');
            expect(passwords.getByLabelText('გაიმეორეთ პაროლი')).toHaveValue('SyntheticNew123');
        }
    });

    it('localizes its own password mismatch while keeping validation local and retaining the draft', async () => {
        mount(); await screen.findByRole('textbox', { name: 'Bio' });
        fireEvent.click(screen.getByRole('button', { name: 'Security' }));
        const passwords = within(section('Email And Password'));
        fireEvent.change(passwords.getByLabelText('Current Password'), { target: { value: 'SyntheticCurrent1' } });
        fireEvent.change(passwords.getByLabelText('New Password'), { target: { value: 'SyntheticNew123' } });
        fireEvent.change(passwords.getByLabelText('Confirm Password'), { target: { value: 'DifferentSynthetic123' } });
        fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));
        expect(screen.getByText('New password and confirmation do not match.')).toBeInTheDocument();
        const reads = vi.mocked(apiClient.get).mock.calls.length;
        await language('ka');
        expect(screen.getByText('ახალი პაროლი და განმეორებული პაროლი არ ემთხვევა.')).toBeInTheDocument();
        expect(passwords.getByLabelText('გაიმეორეთ პაროლი')).toHaveValue('DifferentSynthetic123');
        expect(apiClient.get).toHaveBeenCalledTimes(reads); expect(apiClient.post).not.toHaveBeenCalled(); expect(apiClient.put).not.toHaveBeenCalled();
    });
});

it('changes the profile labels and option text while retaining its saved receipt, newer draft and API values', async () => {
    mount(); fireEvent.change(await screen.findByRole('textbox', { name: 'Display Name' }), { target: { value: 'Saved name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Profile' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/^Profile saved\.$/));
    fireEvent.change(screen.getByRole('textbox', { name: 'Bio' }), { target: { value: 'Newer unsaved bio' } });
    const reads = vi.mocked(apiClient.get).mock.calls.length;
    await language('ka');
    expect(screen.getByRole('heading', { name: 'ანგარიშის პარამეტრები' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'სახელი' })).toHaveValue('Saved name');
    expect(screen.getByRole('textbox', { name: 'ჩემ შესახებ' })).toHaveValue('Newer unsaved bio');
    expect(screen.getByRole('combobox', { name: 'წამყვანი ფეხი' })).toHaveValue('RIGHT');
    expect(screen.getByRole('option', { name: 'მარჯვენა' })).toHaveValue('RIGHT');
    expect(screen.getByRole('combobox', { name: 'მთავარი პოზიცია' })).toHaveValue('Centre-Back');
    expect(screen.getByLabelText('წონა (კგ)')).toHaveValue(70);
    expect(screen.getByRole('status')).toHaveTextContent('პროფილი შენახულია.');
    expect(screen.getByRole('status')).toHaveTextContent('თქვენი ახალი ცვლილებები აქ არის და ჯერ არ შენახულა.');
    expect(apiClient.get).toHaveBeenCalledTimes(reads); expect(apiClient.put).toHaveBeenCalledTimes(1);
    expect(apiClient.put).toHaveBeenCalledWith('/users/me', expect.objectContaining({ fullName: 'Saved name', position: 'Centre-Back', preferredFoot: 'RIGHT', weightKg: 70 }), expect.anything());
});

it('retains both password-form drafts and authenticator proof when the security UI switches language', async () => {
    mount(); await screen.findByRole('textbox', { name: 'Bio' }); fireEvent.click(screen.getByRole('button', { name: 'Security' }));
    const passwords = within(section('Email And Password'));
    fireEvent.change(passwords.getByLabelText('Current Password'), { target: { value: 'SyntheticCurrent1' } });
    fireEvent.change(passwords.getByLabelText('New Password'), { target: { value: 'SyntheticNew123' } });
    fireEvent.change(passwords.getByLabelText('Confirm Password'), { target: { value: 'SyntheticNew123' } });
    const authenticator = within(section('Authenticator Security'));
    fireEvent.change(await authenticator.findByLabelText('Authenticator or unused recovery code'), { target: { value: '123456' } });
    fireEvent.change(authenticator.getByLabelText('Current password'), { target: { value: 'SyntheticProof1' } });
    const reads = vi.mocked(apiClient.get).mock.calls.length;
    await language('ka');
    expect(passwords.getByLabelText('მიმდინარე პაროლი')).toHaveValue('SyntheticCurrent1');
    expect(passwords.getByLabelText('ახალი პაროლი')).toHaveValue('SyntheticNew123');
    expect(passwords.getByLabelText('გაიმეორეთ პაროლი')).toHaveValue('SyntheticNew123');
    expect(authenticator.getByLabelText('მიმდინარე პაროლი')).toHaveValue('SyntheticProof1');
    expect(authenticator.getByLabelText('ავთენტიფიკატორის ან გამოუყენებელი აღდგენის კოდი')).toHaveValue('123456');
    expect(authenticator.getByText('2 გამოუყენებელი აღდგენის კოდი დარჩა.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'პაროლის შეცვლა' })).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledTimes(reads); expect(apiClient.post).not.toHaveBeenCalled();
});

it('renders the Georgian offline/retry state and recovers the same account read', async () => {
    await i18n.changeLanguage('ka'); let attempts = 0;
    vi.mocked(apiClient.get).mockImplementation(async path => {
        if (path === '/users/me/account' && ++attempts === 1) throw new Error('offline');
        return { data: dataFor(path) };
    });
    mount();
    expect(await screen.findByRole('heading', { name: 'ანგარიშის მონაცემები ვერ ჩაიტვირთა' })).toBeInTheDocument();
    expect(screen.getByText('ანგარიშის მონაცემები ვერ ჩაიტვირთა.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ხელახლა ცდა' }));
    expect(await screen.findByRole('textbox', { name: 'სახელი' })).toHaveValue('Synthetic Person');
    expect(attempts).toBe(2); expect(apiClient.put).not.toHaveBeenCalled(); expect(apiClient.post).not.toHaveBeenCalled();
});

it('translates an existing verification error without retrying delivery or clearing a password draft', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('offline'));
    mount(); await screen.findByRole('textbox', { name: 'Bio' }); fireEvent.click(screen.getByRole('button', { name: 'Security' }));
    const passwords = within(section('Email And Password'));
    fireEvent.change(passwords.getByLabelText('New Password'), { target: { value: 'UnsentSynthetic123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Resend Email' }));
    await screen.findByText('Failed to send verification email.');
    const reads = vi.mocked(apiClient.get).mock.calls.length;
    await language('ka');
    expect(screen.getByText('დადასტურების წერილი ვერ გაიგზავნა.')).toBeInTheDocument();
    expect(passwords.getByLabelText('ახალი პაროლი')).toHaveValue('UnsentSynthetic123');
    expect(apiClient.post).toHaveBeenCalledTimes(1); expect(apiClient.get).toHaveBeenCalledTimes(reads);
});
