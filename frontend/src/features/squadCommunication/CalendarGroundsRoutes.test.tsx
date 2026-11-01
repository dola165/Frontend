import '../../i18n';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi, type MockInstance } from 'vitest';
import { apiClient } from '../../api/axiosConfig';
import { setStoredAccessToken, setStoredUserId } from '../../utils/authStorage';
import { SquadGroundsTab } from './page/SquadGroundsTab';
import { SquadScheduleTab } from './page/SquadScheduleTab';
import { TrainingBookingChanges } from './trainingBookings/TrainingBookingChanges';
import { StadiumProfilePage } from '../../pages/StadiumProfilePage';
import type { SquadOverview, SquadSession } from './api';
import type { ScheduleEventOccurrence } from '../schedule/api';

const auth = vi.hoisted(() => ({ user: { id: 20 } as { id: number } | null, sessionId: 'synthetic-a', isBootstrapping: false }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../mapPlanning/journeyScheduleData', () => ({ useJourneyEntries: () => ({ entries: [], error: '', loading: false }), mergeJourneyEntries: (events: unknown[]) => events }));

const tomorrow = new Date(Date.now() + 86400000); tomorrow.setHours(18, 0, 0, 0);
const start = tomorrow.toISOString(), end = new Date(tomorrow.getTime() + 3600000).toISOString();
const space = { id: 11, name: 'FC Dinamo Tbilisi Academy · U14', club_id: 1, can_manage: false } as SquadOverview;
const session: SquadSession = { id: 90, title: 'Same-numbered squad session', starts_at: start, ends_at: end, location: 'Session field', status: 'SCHEDULED', revision: 4, cancellation_reason: null, response_requested: false, attendance: [{ id: 61, name: 'Nika', active: true, response: 'NOT_REQUESTED' }] };
const event = { eventId: 90, occurrenceId: `90@${start}`, origin: 'CLUB_CALENDAR', clubId: 1, clubName: 'FC Dinamo Tbilisi Academy', userId: null, eventType: 'TRAINING', title: 'Club calendar training', description: 'Club occurrence, not the same-numbered session', startsAt: start, endsAt: end, locationName: 'Club field · Gate 2', locationLat: null, locationLng: null, visibility: 'PRIVATE', publishAt: null, publicNow: false, recurring: false, recurrence: null, status: 'SCHEDULED', challengerSquadId: 11, conflictingEventIds: [] } as unknown as ScheduleEventOccurrence;
const booking = { id: 81, venueId: 7, venueName: 'Academy ground', pitchName: 'East pitch', status: 'PENDING', startsAt: start, endsAt: end, timezone: 'Asia/Tbilisi', totalPrice: 100, currency: 'GEL' };
const path = '/stadiums/7?bookingId=81&squadId=11&sessionId=90';
let bookingResult: typeof booking, bookingDenied: number | undefined, denyClub: boolean;
let get: MockInstance<typeof apiClient.get>;

beforeEach(() => {
    localStorage.clear(); setStoredUserId(20); setStoredAccessToken('synthetic-a');
    auth.user = { id: 20 }; auth.sessionId = 'synthetic-a'; auth.isBootstrapping = false;
    bookingResult = { ...booking }; bookingDenied = undefined; denyClub = false;
    get = vi.spyOn(apiClient, 'get').mockImplementation(async raw => {
        const url = String(raw);
        if (url === '/squad-communication/11/sessions') {
            const otherChild = { ...session, id: 91, title: 'Other child private session', attendance: [{ id: 62, name: 'Other child', active: true }] };
            return { data: auth.user?.id === 21 ? [otherChild] : [session, otherChild] };
        }
        if (url === '/schedule/clubs/1/events') { if (denyClub) throw { response: { status: 403 } }; return { data: { events: [event] } }; }
        if (url === '/match-arrangements/squads/11/fixtures') return { data: [] };
        if (url === '/match-arrangements/squads/11/sessions/90') throw { response: { status: 404 } };
        if (url === '/squad-communication/11/events/90') return { data: { session, history: [] } };
        if (url === '/squad-communication/11/training-bookings/90') return { data: { revision: 4, startsAt: start, endsAt: end, timezone: 'Asia/Tbilisi', series: false, linked: true, canCoordinate: true, bookingStatus: 'PENDING', bookingPath: path } };
        if (url === '/venues/7/bookings/81') { if (bookingDenied) throw { response: { status: bookingDenied } }; return { data: bookingResult }; }
        throw new Error(`Unexpected API request: ${url}`);
    });
    vi.spyOn(apiClient, 'post').mockRejectedValue(new Error('No mutation expected'));
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function Location() { const location = useLocation(); return <output aria-label="Current route">{location.pathname + location.search}</output>; }
function SquadRoute({ reservation = false }: { reservation?: boolean }) {
    const [params] = useSearchParams();
    return params.has('sessionId') ? <SquadScheduleTab space={space} childId={61}/>
        : reservation ? <TrainingBookingChanges squadId={11} sessionId={90} revision={4} onSaved={vi.fn()}/>
        : <SquadGroundsTab space={space} childId={61}/>;
}
function show(url = '/squads/11?tab=grounds', reservation = false) {
    return render(<MemoryRouter initialEntries={[url]}><Routes>
        <Route path="/squads/:id" element={<SquadRoute reservation={reservation}/>}/>
        <Route path="/stadiums/:organizationId" element={<StadiumProfilePage/>}/>
        <Route path="/requests" element={<p>Updates return destination</p>}/>
    </Routes><Location/></MemoryRouter>);
}

it('opens the actual club-calendar occurrence from Grounds even when a squad session has the same numeric ID', async () => {
    show();
    fireEvent.click(await screen.findByRole('button', { name: /Club calendar training/ }));
    const dialog = screen.getByRole('dialog', { name: 'Club calendar training' });
    expect(within(dialog).getByText(event.description!)).toBeInTheDocument();
    expect(within(dialog).getByText(event.locationName!)).toBeInTheDocument();
    expect(within(dialog).queryByText(session.title)).not.toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => String(url).includes('/sessions/90') || String(url).includes('/events/90'))).toBe(false);
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/squads/11?tab=grounds');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close event details' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText(/Other child private session/)).not.toBeInTheDocument();
});

it('retains the session namespace and current child when following a real session from Grounds', async () => {
    show();
    fireEvent.click(await screen.findByRole('link', { name: /Same-numbered squad session/ }));
    expect(await screen.findByRole('dialog', { name: session.title })).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/squad-communication/11/events/90', expect.objectContaining({ params: { playerId: 61 } }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('sessionId=90');
    expect(screen.getByLabelText('Current route')).toHaveTextContent('player=61');
});

it('retires open club details and private child data on an account switch', async () => {
    show();
    fireEvent.click(await screen.findByRole('button', { name: /Club calendar training/ }));
    denyClub = true;
    act(() => { auth.user = { id: 21 }; setStoredUserId(21); setStoredAccessToken('synthetic-b'); });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await screen.findByText('No grounds planned in the next four weeks.');
    expect(screen.queryByText(/Same-numbered squad session/)).not.toBeInTheDocument();
});

it('follows Open reservation into the routed exact booking reader without a public venue or operator check, then returns to the current session', async () => {
    show('/squads/11?tab=sessions', true);
    fireEvent.click(await screen.findByRole('link', { name: 'Open reservation' }));
    expect(await screen.findByRole('heading', { name: 'Reservation #81 · Academy ground' })).toBeInTheDocument();
    expect(screen.getByText('PENDING · East pitch')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/venues/7/bookings/81', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(get.mock.calls.some(([url]) => String(url) === '/venues/7' || String(url).includes('/manage'))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Close details' }));
    expect(await screen.findByRole('dialog', { name: session.title })).toBeInTheDocument();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/squads/11?tab=sessions&sessionId=90');
    expect(apiClient.post).not.toHaveBeenCalled();
});

it.each([403, 404])('shows unavailable for another actor or wrong venue/booking route (%s), with the session return intact', async status => {
    bookingDenied = status; show(path);
    expect(await screen.findByRole('alert')).toHaveTextContent('unavailable or you no longer have access');
    expect(screen.queryByText('PENDING · East pitch')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Back to squad event' }));
    expect(await screen.findByRole('dialog', { name: session.title })).toBeInTheDocument();
});

it.each([{ id: 82, venueId: 7 }, { id: 81, venueId: 8 }])('rejects a successful response for the wrong reservation or venue %#', async identity => {
    bookingResult = { ...booking, ...identity }; show(path);
    expect(await screen.findByRole('alert')).toHaveTextContent('This reservation is unavailable.');
    expect(screen.queryByText('PENDING · East pitch')).not.toBeInTheDocument();
});

it('keeps transient booking failures retryable and never invents a reservation outcome', async () => {
    bookingDenied = 503; show(path);
    expect(await screen.findByRole('alert')).toHaveTextContent('Please try again');
    bookingDenied = undefined; fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('PENDING · East pitch')).toBeInTheDocument();
});

it('does not read a private reservation while signed out or bootstrapping', () => {
    auth.user = null; show(path);
    expect(screen.getByRole('alert')).toHaveTextContent('Sign in'); expect(get).not.toHaveBeenCalled();
    cleanup(); auth.isBootstrapping = true; show(path);
    expect(screen.getByText('Checking account access…')).toBeInTheDocument(); expect(get).not.toHaveBeenCalled();
});

it('rejects a late prior-account booking response and rereads current authority on the same routed ID', async () => {
    let resolve!: (value: unknown) => void;
    get.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    show(path);
    await waitFor(() => expect(get).toHaveBeenCalledOnce());
    const previousSignal = get.mock.calls[0][1]?.signal;
    bookingDenied = 403;
    act(() => { auth.user = { id: 21 }; setStoredUserId(21); setStoredAccessToken('synthetic-b'); });
    expect(await screen.findByRole('alert')).toHaveTextContent('unavailable or you no longer have access');
    await act(async () => resolve({ data: booking }));
    expect(screen.queryByText('PENDING · East pitch')).not.toBeInTheDocument();
    expect(previousSignal?.aborted).toBe(true);
});

it('rejects an invalid booking ID before reading and uses a bounded internal fallback for invalid return IDs', async () => {
    show('/stadiums/7?bookingId=0&squadId=https%3A%2F%2Fexample.com&sessionId=90');
    expect(screen.getByRole('alert')).toHaveTextContent('unavailable'); expect(get).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('link', { name: 'Back to updates' }));
    expect(await screen.findByText('Updates return destination')).toBeInTheDocument();
});
