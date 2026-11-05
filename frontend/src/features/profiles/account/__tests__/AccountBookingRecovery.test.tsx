import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import '../../../../i18n';
import { apiClient } from '../../../../api/axiosConfig';
import { useAuth } from '../../../../context/AuthContext';
import { clearStoredAuth, getAuthSessionId, setStoredAccessToken } from '../../../../utils/authStorage';
import { AccountBookingsPage } from '../../../../pages/AccountBookingsPage';
import { AccountDangerTab } from '../AccountDangerTab';

vi.mock('../../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
vi.mock('../../../../context/AuthContext', () => ({ useAuth: vi.fn() }));
const booking = { id: 71, venueId: 22, venueName: 'Synthetic stadium', pitchName: 'Main pitch', startsAt: '2090-01-01T12:00:00Z', endsAt: '2090-01-01T13:00:00Z', timezone: 'Asia/Tbilisi', status: 'CONFIRMED', kind: 'RENTAL', totalPrice: 100, currency: 'GEL', canCancel: true };
const path = '/account/bookings?booking=71&returnTo=closure';
let cancelled = false, failReview = false;
const RecoveryRoutes = () => <Routes>
    <Route path="/account" element={<AccountDangerTab />} />
    <Route path="/account/bookings" element={<AccountBookingsPage />} />
</Routes>;
const mount = () => render(<MemoryRouter initialEntries={['/account?tab=danger']}><RecoveryRoutes /></MemoryRouter>);
const cancel = async () => {
    fireEvent.click(await screen.findByRole('link', { name: 'Review responsibility' }));
    await screen.findByText('Booking #71');
    expect(screen.getByLabelText('Booking #71')).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel reservation' }));
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(apiClient.patch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel' }));
};

beforeEach(() => {
    vi.resetAllMocks(); localStorage.clear(); clearStoredAuth(); setStoredAccessToken('synthetic-account');
    cancelled = false; failReview = false;
    vi.mocked(useAuth).mockReturnValue({ user: { id: 7 }, isAuthenticated: true, sessionId: getAuthSessionId(), logout: vi.fn() } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(apiClient.get).mockImplementation(async url => {
        if (url === '/auth/account-closure') {
            if (failReview) throw new Error('offline');
            return { data: { accountId: 7, version: (cancelled ? 'b' : 'a').repeat(64), passwordRequired: true, consequences: ['Shared records remain.'], blockers: cancelled ? [] : [{ code: 'VENUE_BOOKING', name: 'Booking #71', recoveryPath: path, action: 'Cancel or finish this booking.' }] } };
        }
        if (url === '/venues/bookings/mine/history') return { data: { content: [{ ...booking, status: cancelled ? 'CANCELLED' : 'CONFIRMED', canCancel: !cancelled }], pageCursor: 'page', nextCursor: null } };
        throw new Error('Unexpected read');
    });
    vi.mocked(apiClient.post).mockImplementation(async url => {
        if (url !== '/auth/account-closure/cancel-booking') throw new Error('Unexpected write');
        cancelled = true; return { data: { ...booking, status: 'CANCELLED', canCancel: false } };
    });
});
afterEach(() => { cleanup(); clearStoredAuth(); });

it('uses one personal history read, existing cancellation and a fresh version on return', async () => {
    mount(); await cancel();
    await screen.findByText('cancelled');
    expect(apiClient.post).toHaveBeenCalledExactlyOnceWith('/auth/account-closure/cancel-booking', { venueId: 22, bookingId: 71 }, { _authSessionId: getAuthSessionId(), _skipAuthRefresh: true });
    expect(apiClient.patch).not.toHaveBeenCalled();
    expect(vi.mocked(apiClient.get).mock.calls.filter(call => call[0] === '/venues/bookings/mine/history')).toHaveLength(2); // initial + mutation refresh
    fireEvent.click(screen.getByRole('link', { name: 'Review account closure again' }));
    fireEvent.change(await screen.findByLabelText('Current password'), { target: { value: 'Synthetic1!' } });
    fireEvent.click(screen.getByRole('checkbox'));
    vi.mocked(apiClient.post).mockRejectedValue({ response: { data: { code: 'CLOSURE_CHANGED', detail: 'Review the account again.' } } });
    fireEvent.submit(screen.getByLabelText('Current password').closest('form')!);
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(2));
    expect(vi.mocked(apiClient.post).mock.calls[1][1]).toMatchObject({ version: 'b'.repeat(64) });
    expect(await screen.findByRole('alert')).toHaveTextContent('Review the account again.');
    expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument();
});

it('keeps cancellation errors visible and a failed return read cannot become permission to close', async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce({ response: { data: { detail: 'The cancellation deadline has passed. Contact the facility.' } } });
    mount(); await cancel();
    expect(await screen.findByRole('alert')).toHaveTextContent('cancellation deadline has passed');
    expect(cancelled).toBe(false);
    failReview = true;
    fireEvent.click(screen.getByRole('link', { name: 'Review account closure again' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not review account closure');
    expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument();
    expect(vi.mocked(apiClient.post).mock.calls.map(call => call[0])).toEqual(['/auth/account-closure/cancel-booking']);
    failReview = false;
    fireEvent.click(screen.getByRole('button', { name: 'Review again' }));
    expect(await screen.findByRole('link', { name: 'Review responsibility' })).toHaveAttribute('href', path);
});

it('retires a pending recovery cancellation when another account replaces the session', async () => {
    let finish!: (value: { data: typeof booking }) => void;
    vi.mocked(apiClient.post).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const view = mount(); await cancel();
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(1));
    const originalSession = getAuthSessionId();
    act(() => { clearStoredAuth(); setStoredAccessToken('replacement-account'); });
    vi.mocked(useAuth).mockReturnValue({ user: { id: 9 }, isAuthenticated: true, sessionId: getAuthSessionId(), logout: vi.fn() } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(apiClient.get).mockResolvedValue({ data: { content: [], pageCursor: 'replacement', nextCursor: null } });
    view.rerender(<MemoryRouter initialEntries={['/account?tab=danger']}><RecoveryRoutes /></MemoryRouter>);
    await screen.findByText(/Booking #71 is not available in your personal/);
    const reads = vi.mocked(apiClient.get).mock.calls.length;
    await act(async () => finish({ data: { ...booking, status: 'CANCELLED', canCancel: false } }));
    expect(apiClient.get).toHaveBeenCalledTimes(reads);
    expect(vi.mocked(apiClient.post).mock.calls[0][2]).toMatchObject({ _authSessionId: originalSession, _skipAuthRefresh: true });
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('cancelled')).not.toBeInTheDocument();
    expect(screen.queryByText('Your account is closed.')).not.toBeInTheDocument();
});
