import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import '../../../../i18n';
import { apiClient } from '../../../../api/axiosConfig';
import { useAuth } from '../../../../context/AuthContext';
import { clearStoredAuth, getAuthSessionId, setStoredAccessToken } from '../../../../utils/authStorage';
import { AccountDangerTab } from '../AccountDangerTab';
import { AccountClosureReceipt } from '../AccountClosureReceipt';
import { AccountExitOption } from '../AccountExitOption';
import type { CloseAccount, ClosurePreview } from '../accountClosureApi';

vi.mock('../../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../../../../context/AuthContext', () => ({ useAuth: vi.fn() }));
const logout = vi.fn();
const preview: ClosurePreview = { accountId: 7, version: 'a'.repeat(64), passwordRequired: true, blockers: [], consequences: ['Shared club work and messages remain. There is no undo.'] };
const PublicReceipt = () => <AccountClosureReceipt receipt={useLocation().state.accountClosureReceipt} />;
const show = (element = <AccountDangerTab />) => render(<MemoryRouter initialEntries={['/account?tab=danger']}><Routes><Route path="/account" element={element} /><Route path="/login" element={<PublicReceipt />} /></Routes></MemoryRouter>);
const latch = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
const acknowledge = async () => {
    fireEvent.change(await screen.findByLabelText('Current password'), { target: { value: 'Synthetic1!' } });
    fireEvent.click(screen.getByRole('checkbox'));
};
const submit = () => fireEvent.submit(screen.getByLabelText('Current password').closest('form')!);

beforeEach(() => {
    vi.resetAllMocks(); localStorage.clear(); clearStoredAuth(); setStoredAccessToken('synthetic-account');
    vi.mocked(useAuth).mockReturnValue({ user: { id: 7 }, sessionId: getAuthSessionId(), logout } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(apiClient.get).mockResolvedValue({ data: preview });
    vi.mocked(apiClient.post).mockImplementation(async (_path, body) => ({ data: { accountId: 7, requestId: (body as CloseAccount).requestId, closedAt: '2026-10-30T00:00:00Z', outcome: 'CLOSED' } }));
});
afterEach(() => { cleanup(); clearStoredAuth(); });

it('requires a loaded preview, current password and explicit acknowledgement', async () => {
    const read = latch<{ data: ClosurePreview }>(); vi.mocked(apiClient.get).mockReturnValue(read.promise);
    show(); expect(screen.getByRole('status')).toHaveTextContent('Checking');
    expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument();
    await act(async () => read.resolve({ data: preview }));
    expect(screen.getByRole('button', { name: 'Permanently close account' })).toBeDisabled();
    expect(screen.getByText(/Shared club work/)).toBeVisible();
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'Synthetic1!' } });
    expect(screen.getByRole('button', { name: 'Permanently close account' })).toBeDisabled();
    expect(apiClient.post).not.toHaveBeenCalled();
});

it('records one confirmation and shows only the matching server receipt after signing out', async () => {
    const write = latch<{ data: unknown }>(); vi.mocked(apiClient.post).mockReturnValue(write.promise);
    show(); await acknowledge(); submit(); submit();
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(1));
    const [path, body, config] = vi.mocked(apiClient.post).mock.calls[0];
    expect(path).toBe('/auth/account-closure'); expect(body).toMatchObject({ version: preview.version, currentPassword: 'Synthetic1!', acknowledged: true });
    expect(config).toMatchObject({ _authSessionId: getAuthSessionId(), _skipAuthRefresh: true });
    await act(async () => write.resolve({ data: { accountId: 7, requestId: (body as CloseAccount).requestId, closedAt: '2026-10-30T00:00:00Z', outcome: 'CLOSED' } }));
    expect(await screen.findByText('Your account is closed.')).toBeVisible(); expect(logout).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Receipt/)).toHaveTextContent((body as CloseAccount).requestId);
});

it.each([
    ['CLUB_OWNER', '/clubs/5/office?tab=settings', 'Hand over the club first.'],
    ['SOLE_GUARDIAN', '/parent?tab=connections&player=8', 'Transfer guardianship or end your access.'],
])('offers the supported recovery door for %s and no close control', async (code, recoveryPath, action) => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { ...preview, blockers: [{ code, recoveryPath, action, name: 'Synthetic responsibility' }] } });
    show(); expect(await screen.findByRole('link', { name: 'Review responsibility' })).toHaveAttribute('href', recoveryPath);
    expect(screen.getByText(action)).toBeVisible(); expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
});

it('keeps a provider-only account connected and offers existing password recovery', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { ...preview, passwordRequired: false } });
    show(); expect(await screen.findByText(/Your account uses a linked sign-in provider/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Password recovery' })).toHaveAttribute('href', '/forgot-password?next=%2Faccount%3Ftab%3Ddanger');
    expect(screen.queryByRole('button', { name: /Permanently close/ })).not.toBeInTheDocument(); expect(apiClient.post).not.toHaveBeenCalled();
});

it('preserves the password draft after failed proof and never reports closure', async () => {
    vi.mocked(apiClient.post).mockRejectedValue({ response: { data: { code: 'REAUTH_FAILED', detail: 'Current password was not accepted.' } } });
    show(); await acknowledge(); submit();
    expect(await screen.findByRole('alert')).toHaveTextContent('Current password was not accepted.');
    expect(screen.getByLabelText('Current password')).toHaveValue('Synthetic1!'); expect(logout).not.toHaveBeenCalled();
    expect(screen.queryByText('Your account is closed.')).not.toBeInTheDocument();
});

it('requires a fresh review on stale responsibilities while keeping the draft', async () => {
    vi.mocked(apiClient.post).mockRejectedValue({ response: { data: { code: 'CLOSURE_CHANGED', detail: 'Review the account again.' } } });
    show(); await acknowledge(); submit(); await screen.findByRole('alert');
    expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Review again' }));
    expect(await screen.findByLabelText('Current password')).toHaveValue('Synthetic1!'); expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(logout).not.toHaveBeenCalled();
});

it('does not treat an interrupted write or revoked session as a closure receipt', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('offline'));
    show(); await acknowledge(); submit();
    expect(await screen.findByRole('alert')).toHaveTextContent('outcome is unknown'); expect(logout).not.toHaveBeenCalled();
    expect(apiClient.post).toHaveBeenCalledTimes(1);
});

it('retires a delayed close response when the account changes', async () => {
    const write = latch<{ data: unknown }>(); vi.mocked(apiClient.post).mockReturnValue(write.promise);
    const view = show(); await acknowledge(); submit(); await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(1));
    const body = vi.mocked(apiClient.post).mock.calls[0][1];
    act(() => { clearStoredAuth(); setStoredAccessToken('replacement'); });
    vi.mocked(useAuth).mockReturnValue({ user: { id: 9 }, sessionId: getAuthSessionId(), logout } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(apiClient.get).mockResolvedValue({ data: { ...preview, accountId: 9 } });
    view.rerender(<MemoryRouter initialEntries={['/account?tab=danger']}><AccountDangerTab /></MemoryRouter>);
    await act(async () => write.resolve({ data: { accountId: 7, requestId: (body as CloseAccount).requestId, closedAt: '2026-10-30T00:00:00Z', outcome: 'CLOSED' } }));
    expect(logout).not.toHaveBeenCalled(); expect(screen.queryByText('Your account is closed.')).not.toBeInTheDocument();
    expect(await screen.findByLabelText('Current password')).toHaveValue('');
});

it('rejects a mismatched receipt and lets a failed preview retry without fabricating an empty account', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('offline'));
    show(); await screen.findByRole('alert'); expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Review again' })); await acknowledge();
    vi.mocked(apiClient.post).mockResolvedValue({ data: { accountId: 9, requestId: 'wrong', closedAt: '2026-10-30T00:00:00Z', outcome: 'CLOSED' } });
    submit(); await screen.findByRole('alert'); expect(logout).not.toHaveBeenCalled();
});

it('waits for the old shell to sign out before displaying its receipt', async () => {
    const signedOut = latch<void>();
    logout.mockImplementation(() => { clearStoredAuth(); return signedOut.promise; });
    show(); await acknowledge(); submit();
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Your account is closed.')).not.toBeInTheDocument();
    await act(async () => signedOut.resolve());
    expect(await screen.findByText('Your account is closed.')).toBeVisible();
});

it('does not redirect a new account when the old logout finishes late', async () => {
    const signedOut = latch<void>();
    logout.mockImplementation(() => { clearStoredAuth(); return signedOut.promise; });
    show(); await acknowledge(); submit();
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    act(() => setStoredAccessToken('another-account'));
    await act(async () => signedOut.resolve());
    expect(screen.queryByText('Your account is closed.')).not.toBeInTheDocument();
});

it('cannot promise to keep an account by collapsing onboarding closure during its write', async () => {
    const write = latch<{ data: unknown }>(); vi.mocked(apiClient.post).mockReturnValue(write.promise);
    show(<AccountExitOption />); fireEvent.click(screen.getByRole('button', { name: 'Review account closure' }));
    await acknowledge(); submit(); await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Keep account' })).toBeDisabled();
    const body = vi.mocked(apiClient.post).mock.calls[0][1] as CloseAccount;
    await act(async () => write.resolve({ data: { accountId: 7, requestId: body.requestId, closedAt: '2026-10-30T00:00:00Z', outcome: 'CLOSED' } }));
    expect(await screen.findByText('Your account is closed.')).toBeVisible();
});
