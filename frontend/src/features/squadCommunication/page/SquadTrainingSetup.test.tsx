import '../../../i18n';
import { act, cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SquadTrainingSetup } from './SquadTrainingSetup';
import { SquadScheduleTab } from './SquadScheduleTab';
import * as api from '../api';
import { fetchPage, type Ground, type PageView } from '../../pages/api';
import * as bookings from '../trainingBookings/api';
import { fetchVenues } from '../../venues/api';

const auth = vi.hoisted(() => ({ user: { id: 7 }, sessionId: 'training-session' }));
configure({ asyncUtilTimeout: 5000 });
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../../utils/authStorage', () => ({ getAuthSessionId: () => auth.sessionId, isCurrentAuthSession: (id: string) => id === auth.sessionId }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../api', () => ({ sessions: vi.fn(), previewSquadEvent: vi.fn(), createSquadEvent: vi.fn() }));
vi.mock('../../pages/api', () => ({ fetchPage: vi.fn() }));
vi.mock('../trainingBookings/api', async original => ({ ...await original<typeof bookings>(), previewTraining: vi.fn(), createTraining: vi.fn() }));
vi.mock('../../venues/api', () => ({ fetchVenues: vi.fn() }));
vi.mock('../../parents/FamilySchedule', () => ({ FamilySchedule: ({ initialDate, initialSessionId }: { initialDate?: Date; initialSessionId?: number }) =>
    <output data-testid="calendar-context">{initialDate?.toISOString().slice(0, 10)}|{initialSessionId}</output> }));
vi.mock('../../pages/guide/useGuidePlacement', () => ({ useGuidePlacement: () => ({ host: document.body, inline: false, left: 12, top: 12, maxHeight: 800 }) }));
vi.mock('../../pages/guide/PetSprite', () => ({ PetSprite: () => null }));
const space = { id: 11, name: 'U12', club_id: 1, can_manage: true, players: [{ id: 41, name: 'Alex' }, { id: 42, name: 'Nika' }] } as api.SquadOverview;
const ground = (id: number, name: string): Ground => ({ id, name, address: 'Isani, Tbilisi', town: 'Tbilisi', latitude: 41.7, longitude: 44.8, surface: 'INDOOR', size: '5v5', indoor: true, pitchId: null, venueId: null });
const savedPage = (grounds: Ground[] = [], groundId: number | null = null, clubId = 1) => ({ ref: { type: 'club', id: clubId }, clubId,
    boxes: { grounds: { version: 1, items: grounds }, squads: { version: 1, items: [{ id: space.id, groundId }] } } }) as PageView;
const show = (squad = space) => {
    const onSaved = vi.fn(), onClose = vi.fn();
    return { ...render(<MemoryRouter><SquadTrainingSetup space={squad} onSaved={onSaved} onClose={onClose} /></MemoryRouter>), onSaved, onClose };
};
function ScheduleRoute() {
    const location = useLocation();
    return <><SquadScheduleTab space={space} /><output data-testid="calendar-route">{location.pathname}{location.search}</output></>;
}
const currentRoute = () => new URL(screen.getByTestId('calendar-route').textContent!, 'https://grasskickz.test');
beforeEach(() => {
    vi.clearAllMocks(); sessionStorage.clear(); localStorage.clear(); auth.sessionId = 'training-session';
    vi.mocked(api.sessions).mockResolvedValue([]);
    vi.mocked(fetchPage).mockResolvedValue(savedPage());
    vi.mocked(api.previewSquadEvent).mockImplementation(async (_id, plan) => ({ occurrences: [{ startsAt: plan.startsAt, endsAt: plan.endsAt }], participantCount: plan.playerIds.length, notificationRecipients: 3, conflictingOccurrences: 0, requestResponses: plan.requestResponses }));
    vi.mocked(api.createSquadEvent).mockResolvedValue({ planId: 'training', sessionIds: [81, 82] });
    vi.mocked(fetchVenues).mockResolvedValue({ content: [{ id: 71, displayName: 'Fixture stadium', city: 'Tbilisi', timezone: 'Asia/Tbilisi', currency: 'GEL', minBookingMinutes: 60, maxBookingMinutes: 180, slotMinutes: 30, pitches: [{ id: 1, name: 'Fixture pitch', active: true, pricePerHour: 0 }] }], totalPages: 1, totalElements: 1 } as Awaited<ReturnType<typeof fetchVenues>>);
    vi.mocked(bookings.previewTraining).mockImplementation(async (_id, plan) => ({ quoteToken: 'reviewed-fixture', canCommit: true, paymentPolicy: 'No automatic payment.', occurrences: [{ startsAt: plan.startsAt, endsAt: plan.endsAt, quote: { venueId: 71, pitchId: 1, venueName: 'Fixture stadium', pitchName: 'Fixture pitch', timezone: 'Asia/Tbilisi', currency: 'GEL', totalPrice: 0, status: 'PENDING', cancellationHours: 24, available: true } }] }));
    vi.mocked(bookings.createTraining).mockResolvedValue({ planId: 'booked-training', sessionIds: [91] });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const next = async () => { await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Next' })); }); };
async function review(firstWeek = '2099-09-21') {
    await next();
    fireEvent.change(await screen.findByLabelText('First week'), { target: { value: firstWeek } });
    fireEvent.change(screen.getByLabelText('Plan until'), { target: { value: '2099-10-31' } });
    await next();
    fireEvent.change(await screen.findByLabelText('Training ground and address'), { target: { value: 'School ground, Tbilisi' } });
    await next();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save & send invitations' })).toBeEnabled());
}
it('serves days, time and ground, then creates only a reviewed private training plan', async () => {
    const view = show(); await review();
    expect(api.createSquadEvent).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save & send invitations' }));
    await waitFor(() => expect(view.onSaved).toHaveBeenCalledTimes(1));
    expect(api.createSquadEvent).toHaveBeenCalledWith(11, expect.objectContaining({ title: 'Training', eventType: 'TRAINING', location: 'School ground, Tbilisi', playerIds: [41, 42], requestResponses: false, repeat: expect.objectContaining({ endDate: '2099-10-31', intervalWeeks: 1 }) }), 'training-session');
    expect(Object.keys(sessionStorage).filter(key => key.includes('squad-training'))).toHaveLength(0);
});
it('keeps an uncertain save across reload and retries the exact request and original audience', async () => {
    vi.mocked(api.createSquadEvent).mockRejectedValueOnce(new Error('Connection interrupted'));
    const first = show(); await review(); fireEvent.click(screen.getByRole('button', { name: 'Save & send invitations' }));
    await screen.findByText('The save could not be confirmed. Retry this saved plan before making another.'); expect(first.onSaved).not.toHaveBeenCalled();
    const original = vi.mocked(api.createSquadEvent).mock.calls[0][1]; first.unmount();
    vi.mocked(fetchPage).mockResolvedValue(savedPage([ground(99, 'Later saved ground')]));
    const reopened = show({ ...space, players: [{ id: 99, name: 'Later squad member' }] });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Retry saved plan' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Retry saved plan' }));
    await waitFor(() => expect(reopened.onSaved).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.createSquadEvent).mock.calls[1][1]).toEqual(original);
    expect(fetchPage).toHaveBeenCalledTimes(1);
});
it('blocks a failed preview and retries without losing the training ground', async () => {
    vi.mocked(api.previewSquadEvent).mockRejectedValueOnce(new Error('Preview unavailable'));
    show(); await next();
    await screen.findByLabelText('First week'); await next();
    fireEvent.change(await screen.findByLabelText('Training ground and address'), { target: { value: 'Keep this ground' } }); await next();
    await screen.findByText('The invitation preview could not load. Try again.');
    expect(screen.getByRole('button', { name: 'Save & send invitations' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save & send invitations' })).toBeEnabled());
    expect(screen.getByText(/Keep this ground/)).toBeInTheDocument(); expect(api.createSquadEvent).not.toHaveBeenCalled();
});
it('requires an existing-schedule check before committing another plan', async () => {
    vi.mocked(api.sessions).mockRejectedValueOnce(new Error('Schedule unavailable'));
    show(); await next(); await screen.findByLabelText('First week'); await next();
    fireEvent.change(await screen.findByLabelText('Training ground and address'), { target: { value: 'Pitch 1' } }); await next();
    await screen.findByText('Current training could not load.');
    expect(screen.getByRole('button', { name: 'Save & send invitations' })).toBeDisabled();
    expect(api.createSquadEvent).not.toHaveBeenCalled();
});
it('does not expose setup or fetch a roster to a parent without squad authority', () => {
    show({ ...space, can_manage: false }); expect(screen.queryByText('Which days do you train?')).not.toBeInTheDocument(); expect(api.sessions).not.toHaveBeenCalled(); expect(fetchPage).not.toHaveBeenCalled();
});
it('closing does not save, complete or discard the draft', async () => {
    const view = show(); await next(); await screen.findByLabelText('First week');
    fireEvent.click(screen.getByRole('button', { name: 'Close setup' }));
    expect(view.onClose).toHaveBeenCalledTimes(1); expect(view.onSaved).not.toHaveBeenCalled(); expect(api.createSquadEvent).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('admission-form:7:training-session:squad-training:11')).toBeTruthy();
});
it.each([
    '/squads/11?tab=schedule&at=2026-10-19&session=81&player=41&setup=training',
    '/my-squads?tab=squads&view=schedule&squad=11&at=2026-10-19&sessionId=81&setup=training',
])('closing the actual setup button preserves the calendar route in %s', async entry => {
    render(<MemoryRouter initialEntries={[entry]}><ScheduleRoute /></MemoryRouter>);
    await screen.findByText('Choose the days, times and ground with Dola.');
    const expected = new URL(entry, 'https://grasskickz.test'); expected.searchParams.delete('setup');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Close setup' })); });
    expect(currentRoute().pathname).toBe(expected.pathname);
    expect([...currentRoute().searchParams]).toEqual([...expected.searchParams]);
    expect(screen.getByTestId('calendar-context')).toHaveTextContent('2026-10-19|81');
    expect(screen.queryByRole('region', { name: 'Training setup' })).not.toBeInTheDocument();
    expect(api.createSquadEvent).not.toHaveBeenCalled(); expect(api.previewSquadEvent).not.toHaveBeenCalled();
});
it('an acknowledged save moves the calendar route to its first saved occurrence', async () => {
    render(<MemoryRouter initialEntries={['/my-squads?tab=squads&view=schedule&squad=11&at=2026-10-19&session=81&sessionId=82&setup=training']}><ScheduleRoute /></MemoryRouter>);
    for (const name of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']) {
        const checkbox = screen.getByRole('checkbox', { name }) as HTMLInputElement;
        if (checkbox.checked !== (name === 'Monday')) fireEvent.click(checkbox);
    }
    await review('2099-09-20'); // Sunday anchor; the first invited Monday is the 21st.
    fireEvent.click(screen.getByRole('button', { name: 'Save & send invitations' }));
    await screen.findByText('Training saved. Family invitations are in the schedule.');
    expect([...currentRoute().searchParams]).toEqual([['tab', 'squads'], ['view', 'schedule'], ['squad', '11'], ['at', '2099-09-21']]);
    expect(screen.getByTestId('calendar-context')).toHaveTextContent('2099-09-21|');
    expect(api.createSquadEvent).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.createSquadEvent).mock.calls[0][1].repeat?.daysOfWeek).toEqual(['MONDAY']);
});
it('keeps acknowledged success when draft cleanup fails afterward', async () => {
    const view = show(); await review();
    const remove = Storage.prototype.removeItem;
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (this: Storage, key: string) {
        if (key.startsWith('admission-form:')) throw new Error('Storage unavailable');
        return remove.call(this, key);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save & send invitations' }));
    await waitFor(() => expect(view.onSaved).toHaveBeenCalledTimes(1)); expect(api.createSquadEvent).toHaveBeenCalledTimes(1);
});

async function groundStep() {
    await next(); await screen.findByLabelText('First week'); await next();
    return screen.findByLabelText('Training ground and address');
}
it('suggests the one saved club ground as a changeable answer without creating a plan', async () => {
    vi.mocked(fetchPage).mockResolvedValue(savedPage([ground(1, 'Isani Futsal Hall')]));
    show(); const input = await groundStep();
    expect(input).toHaveValue('Isani Futsal Hall, Isani, Tbilisi');
    expect(fetchPage).toHaveBeenCalledWith({ type: 'club', id: space.club_id }, expect.any(AbortSignal));
    fireEvent.change(input, { target: { value: 'Another school ground' } });
    await next(); await waitFor(() => expect(screen.getByRole('button', { name: 'Save & send invitations' })).toBeEnabled());
    expect(screen.getByText(/Another school ground/)).toBeInTheDocument(); expect(api.createSquadEvent).not.toHaveBeenCalled();
});
it('prefers the squad’s assigned ground when its club has several', async () => {
    vi.mocked(fetchPage).mockResolvedValue(savedPage([ground(1, 'First field'), ground(2, 'Assigned field')], 2));
    show(); expect(await groundStep()).toHaveValue('Assigned field, Isani, Tbilisi');
    expect(screen.getByLabelText('Saved club grounds')).toHaveValue('Assigned field, Isani, Tbilisi');
});
it('offers multiple saved grounds without choosing an ambiguous one and retains manual entry', async () => {
    vi.mocked(fetchPage).mockResolvedValue(savedPage([ground(1, 'First field'), ground(2, 'Second field')]));
    show(); const input = await groundStep(); expect(input).toHaveValue('');
    fireEvent.change(screen.getByLabelText('Saved club grounds'), { target: { value: 'Second field, Isani, Tbilisi' } });
    expect(input).toHaveValue('Second field, Isani, Tbilisi');
    fireEvent.change(screen.getByLabelText('Saved club grounds'), { target: { value: '' } });
    expect(input).toHaveValue(''); fireEvent.change(input, { target: { value: 'Our manual field' } });
    expect(input).toHaveValue('Our manual field');
});
it.each(['Restored school ground', ''])('preserves a restored ground answer, including a deliberate empty value (%s)', async locationName => {
    sessionStorage.setItem('admission-form:7:training-session:squad-training:11', JSON.stringify({ locationName }));
    vi.mocked(fetchPage).mockResolvedValue(savedPage([ground(1, 'Saved field')]));
    show(); expect(await groundStep()).toHaveValue(locationName);
    expect(screen.getByRole('option', { name: 'Saved field, Isani, Tbilisi' })).toBeInTheDocument();
});
it('does not replace a typed answer when saved grounds arrive late', async () => {
    let resolvePage!: (page: PageView) => void;
    vi.mocked(fetchPage).mockReturnValue(new Promise(resolve => { resolvePage = resolve; }));
    show(); const input = await groundStep(); fireEvent.change(input, { target: { value: 'Typed before the reply' } });
    await act(async () => { resolvePage(savedPage([ground(1, 'Late saved field')])); });
    expect(input).toHaveValue('Typed before the reply'); expect(api.createSquadEvent).not.toHaveBeenCalled();
});
it('keeps manual entry usable if the optional source fails and preserves it across a refresh', async () => {
    vi.mocked(fetchPage).mockRejectedValueOnce(new Error('Page unavailable')).mockResolvedValue(savedPage([ground(1, 'Recovered field')]));
    show(); const input = await groundStep(); await screen.findByText('Saved grounds could not load. Enter the ground, or try again.');
    fireEvent.change(input, { target: { value: 'Manual recovery ground' } });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh saved grounds' }));
    await screen.findByRole('option', { name: 'Recovered field, Isani, Tbilisi' });
    expect(input).toHaveValue('Manual recovery ground'); expect(api.createSquadEvent).not.toHaveBeenCalled();
});
it('refuses a ground response for a different club', async () => {
    vi.mocked(fetchPage).mockResolvedValue(savedPage([ground(1, 'Another club field')], null, 99));
    show(); expect(await groundStep()).toHaveValue('');
    await screen.findByText('Saved grounds could not load. Enter the ground, or try again.');
    expect(screen.queryByRole('option', { name: /Another club field/ })).not.toBeInTheDocument();
    expect(api.createSquadEvent).not.toHaveBeenCalled();
});

async function chooseBooking() {
    fireEvent.click(screen.getByLabelText('Reserve a real venue for these dates'));
    await screen.findByRole('option', { name: 'Fixture stadium · Tbilisi' });
    fireEvent.change(screen.getByLabelText('Venue'), { target: { value: '71' } });
    fireEvent.change(screen.getByLabelText('Pitch'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Booking contact name'), { target: { value: 'Fixture contact' } });
    fireEvent.change(screen.getByLabelText('Booking contact phone'), { target: { value: '+995555000000' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save training & reservations' })).toBeEnabled());
}
it('reviews the real pitch terms and saves through the atomic training-and-booking command in the captured login', async () => {
    const view = show(); await review(); await chooseBooking();
    expect(screen.getByText(/Venue approval required/)).toBeVisible();
    expect(bookings.createTraining).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save training & reservations' }));
    await waitFor(() => expect(view.onSaved).toHaveBeenCalledOnce());
    expect(bookings.createTraining).toHaveBeenCalledWith(11, expect.objectContaining({ playerIds: [41, 42], requestResponses: false }), { venueId: 71, pitchId: 1, contactName: 'Fixture contact', contactPhone: '+995555000000', note: '' }, 'reviewed-fixture', 'training-session');
    expect(api.createSquadEvent).not.toHaveBeenCalled();
    expect(Object.keys(sessionStorage).filter(key => key.includes('squad-training'))).toHaveLength(0);
});
it('retries an uncertain atomic booking after reopening, keeping the exact reviewed command even if its slots now appear occupied', async () => {
    vi.mocked(bookings.createTraining).mockRejectedValueOnce(new Error('Acknowledgement lost'));
    const first = show(); await review(); await chooseBooking();
    fireEvent.click(screen.getByRole('button', { name: 'Save training & reservations' }));
    await screen.findByText('The save could not be confirmed. Retry this saved plan before making another.');
    const original = vi.mocked(bookings.createTraining).mock.calls[0]; first.unmount();
    vi.mocked(bookings.previewTraining).mockRejectedValue(new Error('Existing saved booking occupies these slots'));
    vi.mocked(api.previewSquadEvent).mockRejectedValue(new Error('Existing saved sessions overlap'));
    const reopened = show({ ...space, players: [{ id: 99, name: 'Later player' }] });
    fireEvent.click(await screen.findByRole('button', { name: 'Retry saved plan' }));
    await waitFor(() => expect(reopened.onSaved).toHaveBeenCalledOnce());
    expect(vi.mocked(bookings.createTraining).mock.calls[1]).toEqual(original);
    expect(screen.queryByLabelText('Reserve a real venue for these dates')).not.toBeInTheDocument();
    expect(api.createSquadEvent).not.toHaveBeenCalled();
});
it('keeps conflicting pitch dates from becoming an unreserved training save', async () => {
    const original = vi.mocked(bookings.previewTraining).getMockImplementation()!;
    vi.mocked(bookings.previewTraining).mockImplementation(async (...args) => ({ ...await original(...args), canCommit: false }));
    show(); await review();
    fireEvent.click(screen.getByLabelText('Reserve a real venue for these dates'));
    await screen.findByRole('option', { name: 'Fixture stadium · Tbilisi' });
    fireEvent.change(screen.getByLabelText('Venue'), { target: { value: '71' } });
    fireEvent.change(screen.getByLabelText('Pitch'), { target: { value: '1' } });
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Save training & reservations' })).toBeDisabled();
    expect(bookings.createTraining).not.toHaveBeenCalled(); expect(api.createSquadEvent).not.toHaveBeenCalled();
});
it('does not send a reviewed reservation after its login retires', async () => {
    show(); await review(); await chooseBooking(); auth.sessionId = 'replacement-login';
    fireEvent.click(screen.getByRole('button', { name: 'Save training & reservations' }));
    await screen.findByText('Your account changed. Reopen the squad.');
    expect(bookings.createTraining).not.toHaveBeenCalled(); expect(api.createSquadEvent).not.toHaveBeenCalled();
});
