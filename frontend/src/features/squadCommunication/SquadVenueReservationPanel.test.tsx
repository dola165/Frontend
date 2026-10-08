import '../../i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/axiosConfig';
import { SquadVenueReservationPanel } from './SquadVenueReservationPanel';
vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), put: vi.fn() } }));
const option = { id: 52, venueId: 8, venueName: 'Dinamo park', pitchName: 'Pitch A', startsAt: '2099-10-03T08:00:00Z', endsAt: '2099-10-03T09:00:00Z', timezone: 'Asia/Tbilisi', totalPrice: 90, currency: 'GEL' };
const result = { revision: 4, linked: false, options: [option] };
const endpoint = '/squad-communication/3/sessions/9/reservation';
beforeEach(() => { vi.resetAllMocks(); vi.mocked(apiClient.get).mockResolvedValue({ data: result }); vi.mocked(apiClient.put).mockResolvedValue({ data: { id: 9, revision: 5 } }); });
function mount() { const saved = vi.fn(); render(<MemoryRouter><SquadVenueReservationPanel squadId={3} sessionId={9} revision={4} onSaved={saved}/></MemoryRouter>); return saved; }
async function select() { fireEvent.change(await screen.findByLabelText('Confirmed reservation'), { target: { value: '52' } }); fireEvent.click(screen.getByRole('button', { name: 'Review reservation link' })); }
it('requires review and submits the reviewed reservation and revision, without creating a booking', async () => {
    const saved = mount(); await select();
    expect(apiClient.put).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('No new booking or charge is created');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & notify families' }));
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
    expect(apiClient.put).toHaveBeenCalledExactlyOnceWith(endpoint, { requestId: expect.any(String), revision: 4, bookingId: 52 });
});
it('uses the same request identity when a connection failure is retried', async () => {
    vi.mocked(apiClient.put).mockRejectedValueOnce(new Error('Connection lost')); mount(); await select();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & notify families' })); await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Review reservation link' })); fireEvent.click(screen.getByRole('button', { name: 'Confirm & notify families' }));
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledTimes(2));
    expect(vi.mocked(apiClient.put).mock.calls[0]).toEqual(vi.mocked(apiClient.put).mock.calls[1]);
});
it('clears the reviewed choice after refresh when the booking is no longer available', async () => {
    mount(); await select(); vi.mocked(apiClient.get).mockResolvedValue({ data: { ...result, revision: 5, options: [] } });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh reservations' }));
    await screen.findByText(/No confirmed, unassigned reservation/);
    expect(screen.queryByRole('button', { name: 'Confirm & notify families' })).not.toBeInTheDocument(); expect(apiClient.put).not.toHaveBeenCalled();
});
it('explains that detaching leaves the venue booking active and sends only a link removal', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { revision: 4, linked: true, options: [], manageBookingPath: '/stadiums/8?bookingId=52' } });
    mount(); fireEvent.click(await screen.findByRole('button', { name: 'Remove reservation link' }));
    expect(screen.getByRole('status')).toHaveTextContent('does not cancel or refund');
    expect(screen.getByRole('link', { name: /Open venue booking/ })).toHaveAttribute('href', '/stadiums/8?bookingId=52');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & notify families' }));
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith(endpoint, expect.objectContaining({ bookingId: null, revision: 4 })));
});
it('offers a recoverable error when reservation options fail to load', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('Offline')); mount(); await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh reservations' })); await screen.findByLabelText('Confirmed reservation');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument(); expect(apiClient.put).not.toHaveBeenCalled();
});
it('does not repeatedly load on ordinary selection or review renders', async () => {
    mount(); await select(); fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(apiClient.get).toHaveBeenCalledTimes(1);
});
