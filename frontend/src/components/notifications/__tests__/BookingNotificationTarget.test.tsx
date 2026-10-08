import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingNotificationTarget } from '../BookingNotificationTarget';
const get = vi.hoisted(() => vi.fn());
vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get } }));
const booking = (id = 81) => ({ id, venueId: 7, venueName: `Stadium ${id}`, pitchName: 'Pitch A', status: 'CONFIRMED', startsAt: '2026-01-01T10:00:00Z', endsAt: '2026-01-01T11:00:00Z', timezone: 'Asia/Tbilisi', totalPrice: 100, currency: 'GEL' });
const panel = (id = '81', venue = '7') => <MemoryRouter><BookingNotificationTarget venueId={venue} bookingId={id} onClose={vi.fn()} /></MemoryRouter>;

describe('exact reservation notification target', () => {
    beforeEach(() => { get.mockReset(); });
    it('loads the authorized exact reservation outside calendar windows', async () => {
        get.mockResolvedValue({ data: booking() }); render(panel());
        expect(await screen.findByText('Reservation #81 · Stadium 81')).toBeInTheDocument();
        expect(get).toHaveBeenCalledWith('/venues/7/bookings/81', expect.objectContaining({ signal: expect.any(AbortSignal) }));
        expect(screen.getByText('CONFIRMED · Pitch A')).toBeInTheDocument();
    });
    it.each([403, 404, 410])('does not treat a notification as resource permission (%s)', async status => {
        get.mockRejectedValue({ response: { status } }); render(panel());
        expect(await screen.findByRole('alert')).toHaveTextContent('unavailable or you no longer have access');
        expect(screen.queryByText('Pitch A')).not.toBeInTheDocument();
    });
    it.each([['0', '7'], ['81', ''], ['../81', '7'], ['9007199254740992', '7']])('rejects invalid identity %s / %s without a request', (id, venue) => {
        render(panel(id, venue)); expect(screen.getByRole('alert')).toHaveTextContent('unavailable'); expect(get).not.toHaveBeenCalled();
    });
    it('retries server failures', async () => {
        get.mockRejectedValueOnce({ response: { status: 500 } }).mockResolvedValueOnce({ data: booking() }); render(panel());
        fireEvent.click(await screen.findByText('Try again')); expect(await screen.findByText('Reservation #81 · Stadium 81')).toBeInTheDocument();
    });
    it('rejects a response for another reservation', async () => {
        get.mockResolvedValue({ data: booking(82) }); render(panel());
        expect(await screen.findByRole('alert')).toHaveTextContent('unavailable');
    });
    it('ignores stale responses after changing destinations', async () => {
        let resolve: (value: unknown) => void = () => undefined;
        get.mockImplementationOnce(() => new Promise(r => { resolve = r; })).mockResolvedValueOnce({ data: booking(82) });
        const view = render(panel()); view.rerender(panel('82'));
        expect(await screen.findByText('Reservation #82 · Stadium 82')).toBeInTheDocument();
        await act(async () => resolve({ data: booking() }));
        expect(screen.queryByText('Reservation #81 · Stadium 81')).not.toBeInTheDocument();
    });
});
