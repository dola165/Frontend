import '../../../i18n';
import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { TrainingVenuePicker } from './TrainingVenuePicker';
import { TrainingBookingChanges } from './TrainingBookingChanges';
import * as api from './api';
import { fetchVenues } from '../../venues/api';
import type { SquadEventPlan } from '../api';
import { VenueReservationSummary } from '../../eventVenues/VenueReservationSummary';
vi.mock('./api', async original => ({ ...await original<typeof api>(), previewTraining: vi.fn(), bookingContext: vi.fn(), previewBookingChange: vi.fn(), saveBookingChange: vi.fn() }));
vi.mock('../../venues/api', () => ({ fetchVenues: vi.fn() }));
const plan: SquadEventPlan = { requestId: 'request', title: 'Training', eventType: 'TRAINING', description: null, startsAt: '2099-10-03T08:00:00Z', endsAt: '2099-10-03T09:00:00Z', location: 'Text', timezone: 'Asia/Tbilisi', playerIds: [41], requestResponses: true, repeat: null };
const quote: api.RentalQuote = { venueId: 8, pitchId: 52, venueName: 'Dinamo park', pitchName: 'Pitch A', timezone: 'Asia/Tbilisi', totalPrice: 90, currency: 'GEL', status: 'PENDING', cancellationHours: 24, available: true };
const preview: api.BookingPreview = { occurrences: [{ startsAt: plan.startsAt, endsAt: plan.endsAt, quote }], quoteToken: 'reviewed-token', canCommit: true, paymentPolicy: 'No automatic charge or refund.', affectedResponses: 2 };
beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(fetchVenues).mockResolvedValue({ content: [{ id: 8, displayName: 'Dinamo park', city: 'Tbilisi', timezone: 'Asia/Tbilisi', currency: 'GEL', pitches: [{ id: 52, name: 'Pitch A', active: true, pricePerHour: 90 }] }], totalPages: 1, totalElements: 1 } as Awaited<ReturnType<typeof fetchVenues>>);
    vi.mocked(api.previewTraining).mockResolvedValue(preview);
    vi.mocked(api.bookingContext).mockResolvedValue({ revision: 4, startsAt: plan.startsAt, endsAt: plan.endsAt, timezone: 'Asia/Tbilisi', series: true, linked: true, canCoordinate: true, bookingStatus: 'PENDING', canCancelBooking: true });
    vi.mocked(api.previewBookingChange).mockResolvedValue(preview);vi.mocked(api.saveBookingChange).mockResolvedValue({ eventCount: 1 });
});
it('keeps text meeting points unreserved and previews pending real bookings with price and privacy boundaries', async () => {
    const reviewed = vi.fn();
    function Harness() { const [value, setValue] = useState<api.TrainingSelection | null>(null);return <TrainingVenuePicker squadId={3} plan={plan} selection={value} onChange={setValue} onReviewed={reviewed}/>; }
    render(<MemoryRouter><Harness/></MemoryRouter>);
    expect(screen.getByText(/does not reserve a pitch/)).toBeVisible();expect(api.previewTraining).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('Reserve a real venue for these dates'));
    await screen.findByRole('option', { name: 'Dinamo park · Tbilisi' });
    fireEvent.change(screen.getByLabelText('Venue'), { target: { value: '8' } });fireEvent.change(screen.getByLabelText('Pitch'), { target: { value: '52' } });
    await screen.findByText(/90.00 GEL ·/);expect(screen.getByText(/Venue approval required/)).toBeVisible();expect(screen.getByText(/hidden from players and families/)).toBeVisible();
    await waitFor(() => expect(reviewed).toHaveBeenLastCalledWith(expect.objectContaining({ token: 'reviewed-token' })));
});
it('does not approve a partially unavailable training series', async () => {
    vi.mocked(api.previewTraining).mockResolvedValue({ ...preview, canCommit: false, occurrences: [...preview.occurrences, { startsAt: '2099-10-10T08:00:00Z', endsAt: '2099-10-10T09:00:00Z', quote: { ...quote, available: false, issue: 'Pitch overlaps a closure.' } }] });
    const reviewed = vi.fn();render(<TrainingVenuePicker squadId={3} plan={plan} selection={{ venueId: 8, pitchId: 52, contactName: 'Coach', contactPhone: '+995123', note: '' }} onChange={vi.fn()} onReviewed={reviewed}/>);
    await screen.findByText('Pitch overlaps a closure.');expect(screen.getByRole('alert')).toHaveTextContent('No partial series');expect(reviewed).toHaveBeenCalledWith(null);expect(reviewed).not.toHaveBeenCalledWith(expect.objectContaining({ token: expect.any(String) }));
});
it('submits only a reviewed coordinated change and reuses its exact request on a network retry', async () => {
    vi.mocked(api.saveBookingChange).mockRejectedValueOnce(new Error('Network lost'));
    const saved = vi.fn();render(<TrainingBookingChanges squadId={3} sessionId={9} revision={4} onSaved={saved}/>);
    fireEvent.change(await screen.findByLabelText('Action'), { target: { value: 'CANCEL' } });fireEvent.change(screen.getByLabelText('Dates to change'), { target: { value: 'ALL_FUTURE' } });fireEvent.change(screen.getByLabelText('Reason for the change'), { target: { value: 'Weather' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview every affected date' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm cancellation & notify families' }));await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation & notify families' }));
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());expect(vi.mocked(api.saveBookingChange).mock.calls[0]).toEqual(vi.mocked(api.saveBookingChange).mock.calls[1]);expect(api.saveBookingChange).toHaveBeenCalledWith(3, 9, expect.objectContaining({ quoteToken: 'reviewed-token', scope: 'ALL_FUTURE', revision: 4, action: 'CANCEL' }));
});
it('invalidates the preview when the affected scope changes', async () => {
    render(<TrainingBookingChanges squadId={3} sessionId={9} revision={4} onSaved={vi.fn()}/>);
    fireEvent.change(await screen.findByLabelText('Action'), { target: { value: 'CANCEL' } });fireEvent.change(screen.getByLabelText('Reason for the change'), { target: { value: 'Weather' } });fireEvent.click(screen.getByRole('button', { name: 'Preview every affected date' }));
    await screen.findByRole('button', { name: 'Confirm cancellation & notify families' });fireEvent.change(screen.getByLabelText('Dates to change'), { target: { value: 'FOLLOWING' } });
    expect(screen.queryByRole('button', { name: 'Confirm cancellation & notify families' })).not.toBeInTheDocument();expect(api.saveBookingChange).not.toHaveBeenCalled();
});
it('keeps an unrelated personal reservation with its booker', async () => {
    vi.mocked(api.bookingContext).mockResolvedValue({ revision: 4, startsAt: plan.startsAt, endsAt: plan.endsAt, timezone: 'UTC', series: true, linked: true, canCoordinate: false });
    render(<TrainingBookingChanges squadId={3} sessionId={9} revision={4} onSaved={vi.fn()}/>);
    await screen.findByText(/A personal reservation stays with its booker/);expect(screen.queryByLabelText('Action')).not.toBeInTheDocument();expect(api.previewBookingChange).not.toHaveBeenCalled();
});
it.each([
    ['DECLINED', 'The venue declined this pitch request.'],
    ['CANCELLED', 'The pitch reservation was cancelled.'],
    ['EXPIRED', 'The pitch request expired without confirmation.'],
] as const)('explains %s to families without exposing customer booking details', (unavailableReason, message) => {
    render(<MemoryRouter><VenueReservationSummary value={{ ...quote, startsAt: plan.startsAt, endsAt: plan.endsAt, status: 'UNAVAILABLE', unavailableReason }}/></MemoryRouter>);
    expect(screen.getByText(message)).toBeVisible();expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
