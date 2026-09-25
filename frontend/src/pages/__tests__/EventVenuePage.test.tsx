import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import '../../i18n';
import { EventVenuePage } from '../EventVenuePage';
import * as api from '../../features/eventVenues/api';
import * as venues from '../../features/venues/api';
vi.mock('../../features/eventVenues/api', async () => ({ ...await vi.importActual('../../features/eventVenues/api'), fetchEventVenue: vi.fn(), reserveEventVenue: vi.fn(), attachEventVenue: vi.fn(), cancelEventVenue: vi.fn() }));
vi.mock('../../features/venues/api', () => ({ fetchVenues: vi.fn(), fetchMyBookings: vi.fn(), fetchAvailability: vi.fn() }));
const detail: api.EventVenueDetail = { source: { type: 'TOURNAMENT_FIXTURE', id: 5, title: 'Academy final', occurrenceKey: 'single', localStart: '2027-05-01T10:00', localEnd: '2027-05-01T11:30', timezone: 'UTC', startsAt: '2027-05-01T10:00Z', endsAt: '2027-05-01T11:30Z', canBook: true, returnPath: '/tournaments/1/workspace' }, reservations: [] };
const stadium = { id: 1, displayName: 'City Stadium', city: 'Cardiff', timezone: 'UTC', currency: 'GBP', bookingMode: 'REQUEST', cancellationHours: 24, minBookingMinutes: 60, maxBookingMinutes: 180, slotMinutes: 30, pitches: [{ id: 2, name: 'Pitch A' }] } as venues.Venue;
const reservation: api.EventReservation = { id: 10, bookingId: 20, venueId: 1, venueName: 'City Stadium', pitchName: 'Pitch A', startsAt: detail.source.startsAt!, endsAt: detail.source.endsAt!, bookingStatus: 'PENDING', state: 'LINKED', reason: null, canCancel: true, venuePhone: '123456', cancellationDeadline: '2027-04-30T10:00Z' };
const mount = () => render(<MemoryRouter initialEntries={['/event-venues?type=TOURNAMENT_FIXTURE&id=5&timezone=UTC']}><EventVenuePage/></MemoryRouter>);
describe('Event venue reservation', () => {
    beforeEach(() => {
        vi.resetAllMocks(); vi.mocked(api.fetchEventVenue).mockResolvedValue(detail);
        vi.mocked(venues.fetchVenues).mockResolvedValue({ content: [stadium], totalElements: 1, totalPages: 1 });
        vi.mocked(venues.fetchMyBookings).mockResolvedValue([]);
        vi.mocked(venues.fetchAvailability).mockResolvedValue({ venueId: 1, timezone: 'UTC', fromDate: '2027-05-01', toDate: '2027-05-01', days: [{ date: '2027-05-01', pitches: [{ pitchId: 2, blocks: [], slots: [{ startsAt: '2027-05-01T10:00Z', endsAt: '2027-05-01T11:30Z', available: true, price: 120 }, { startsAt: '2027-05-01T11:00Z', endsAt: '2027-05-01T12:30Z', available: true, price: 120 }] }] }] });
    });
    it('books only a slot covering the full event and displays pending explicitly', async () => {
        vi.mocked(api.reserveEventVenue).mockResolvedValue({ ...detail, reservations: [reservation] });
        const user = userEvent.setup(); mount();
        await user.click(await screen.findByRole('button', { name: 'City Stadium · Cardiff' }));
        const options = await screen.findAllByRole('button', { name: /Pitch A/ });
        expect(options).toHaveLength(1);
        await user.click(options[0]);
        await user.type(screen.getByLabelText('Contact name'), 'Coach Jane');
        await user.type(screen.getByLabelText('Phone'), '12345');
        await user.click(screen.getByRole('button', { name: 'Request this pitch for event' }));
        expect(api.reserveEventVenue).toHaveBeenCalledWith(expect.objectContaining({ type: 'TOURNAMENT_FIXTURE', id: 5, timezone: 'UTC' }), 1, expect.objectContaining({ pitchId: 2, startsAt: '2027-05-01T10:00Z', expectedTotalPrice: 120, currency: 'GBP' }));
        expect(await screen.findByText('Awaiting stadium confirmation')).toBeVisible();
        expect(screen.queryByRole('heading', { name: 'Choose a stadium' })).not.toBeInTheDocument();
    });
    it('requires timezone confirmation before loading stadiums for naive kickoff', async () => {
        vi.mocked(api.fetchEventVenue).mockResolvedValueOnce({ ...detail, source: { ...detail.source, timezone: null, startsAt: null, endsAt: null } }).mockResolvedValueOnce(detail);
        const user = userEvent.setup(); mount();
        await screen.findByRole('heading', { name: 'Academy final' });
        expect(venues.fetchVenues).not.toHaveBeenCalled();
        fireEvent.change(screen.getByLabelText('Event timezone'), { target: { value: 'Europe/London' } });
        await user.click(screen.getByRole('button', { name: 'Confirm event time' }));
        expect(api.fetchEventVenue).toHaveBeenLastCalledWith(expect.objectContaining({ timezone: 'Europe/London' }));
    });
    it('keeps late-cancellation action required distinct from confirmed', async () => {
        vi.mocked(api.fetchEventVenue).mockResolvedValue({ ...detail, source: { ...detail.source, canBook: false }, reservations: [{ ...reservation, state: 'NEEDS_ATTENTION', bookingStatus: 'CONFIRMED', canCancel: false, reason: 'Contact stadium to resolve.' }] });
        mount();
        expect(await screen.findByText('Action required — previous rental still active')).toBeVisible();
        expect(screen.queryByText('Confirmed', { exact: true })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Cancel reservation' })).not.toBeInTheDocument();
    });
    it('shows cancellation failure without hiding the active rental', async () => {
        vi.mocked(api.fetchEventVenue).mockResolvedValue({ ...detail, reservations: [reservation] });
        vi.mocked(api.cancelEventVenue).mockRejectedValue(new Error('offline'));
        const user = userEvent.setup(); mount();
        await user.click(await screen.findByRole('button', { name: 'Cancel reservation' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Could not update the reservation.');
        expect(screen.getByText('Awaiting stadium confirmation')).toBeVisible();
    });
    it('links an existing covering rental using the same resolved event context', async () => {
        vi.mocked(venues.fetchMyBookings).mockResolvedValue([{ id: 50, venueId: 1, venueName: 'City Stadium', pitchName: 'Pitch A', startsAt: '2027-05-01T11:00:00+01:00', endsAt: '2027-05-01T12:30:00+01:00', status: 'CONFIRMED' }, { id: 51, venueId: 1, venueName: 'Other pitch', startsAt: '2027-05-01T10:00:00Z', endsAt: '2027-05-01T11:00:00Z', status: 'CONFIRMED' }] as venues.Booking[]);
        vi.mocked(api.attachEventVenue).mockResolvedValue({ ...detail, reservations: [{ ...reservation, bookingId: 50, bookingStatus: 'CONFIRMED' }] });
        const user = userEvent.setup(); mount();
        await user.click(await screen.findByRole('button', { name: 'Link reservation #50' }));
        expect(screen.queryByRole('button', { name: 'Link reservation #51' })).not.toBeInTheDocument();
        expect(api.attachEventVenue).toHaveBeenCalledWith(expect.objectContaining({ type: 'TOURNAMENT_FIXTURE', id: 5, timezone: 'UTC' }), 50);
        expect(await screen.findByText('Confirmed', { exact: true })).toBeVisible();
    });
});
