import i18n from '../../i18n';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/axiosConfig';
import * as api from './api';
import { SquadEventEditComposer } from './SquadEventEditComposer';
import { SquadVenueReservationPanel } from './SquadVenueReservationPanel';

vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));
vi.mock('./api', async original => ({ ...(await original<typeof import('./api')>()), overview: vi.fn(), previewSession: vi.fn(), editSession: vi.fn(), changeSeries: vi.fn() }));
vi.mock('../../components/MiniMap', () => ({ MiniMap: () => null }));

const squad = { id: 11, name: 'U14', club_id: 1, can_manage: true };
const session: api.SquadSession = {
    id: 81, title: 'Retained training', starts_at: '2099-11-01T12:00:00Z', ends_at: '2099-11-01T13:00:00Z',
    location: 'East field', status: 'SCHEDULED', revision: 4, response_requested: true, cancellation_reason: null,
    attendance: [{ id: 61, name: 'Nika', active: true, response: 'NOT_GOING', reason: 'School trip' }],
};
const preview: api.SessionConsequence = {
    revision: 4, material: true, responsePolicy: 'RECONFIRM', affectedParticipants: 1, affectedResponses: 1,
    addedParticipants: 0, removedParticipants: 0, notificationRecipients: 2, canCommit: true, conflicts: [],
};
const languages = [
    { language: 'en', next: 'Continue', location: 'Location', confirm: 'Confirm changes',
        expected: 'Everyone invited remains expected unless they say they can’t come.',
        retained: 'Previous can’t-come answers stay in place unless the family updates them.',
        optional: 'Only update availability if plans change.',
        changed: 'events will change. Past events remain unchanged.',
        remove: 'Remove reservation link', notify: 'Confirm & notify families', open: 'Open venue booking',
        clears: 'This clears the meeting point.',
        ownership: 'Personal bookings remain with their booker; club reservations remain with current authorized staff for their recorded squad.',
        booking: 'Confirm removing this session’s link. This does not cancel or refund the venue booking.',
        reservation: 'Confirmed reservation', reviewLink: 'Review reservation link',
        becomes: 'The meeting point will become this venue and pitch.',
        noCharge: 'No new booking or charge is created.', notified: 'Invited families will be notified.',
    },
    { language: 'ka', next: 'გაგრძელება', location: 'ლოკაცია', confirm: 'ცვლილებების დადასტურება',
        expected: 'ყველა მოწვეული მოსალოდნელია, თუ არ ამბობს, რომ ვერ მოვა.',
        retained: 'წინა პასუხი „ვერ მოვალ“ ძალაში რჩება, სანამ ოჯახი მას არ შეცვლის.',
        optional: 'ხელმისაწვდომობა მხოლოდ გეგმების შეცვლისას განაახლეთ.',
        changed: 'ღონისძიება შეიცვლება. წარსული ღონისძიებები უცვლელია.',
        remove: 'ჯავშნის მიბმის მოხსნა', notify: 'დადასტურება და ოჯახების შეტყობინება', open: 'ჯავშნის გახსნა',
        clears: 'ეს შლის შეხვედრის ადგილს.',
        ownership: 'პირადი ჯავშანი მის ავტორს რჩება; კლუბის ჯავშანი შესაბამისი გუნდის მოქმედ უფლებამოსილ თანამშრომლებს რჩებათ.',
        booking: 'დაადასტურეთ სესიის მიბმის მოხსნა. ეს არ აუქმებს ჯავშანს და არ აბრუნებს თანხას.',
        reservation: 'დადასტურებული ჯავშანი', reviewLink: 'ჯავშნის მიბმის გადახედვა',
        becomes: 'შეხვედრის ადგილი გახდება ეს სტადიონი და მოედანი.',
        noCharge: 'ახალი ჯავშანი ან გადასახადი არ იქმნება.', notified: 'მოწვეული ოჯახები მიიღებენ შეტყობინებას.',
    },
];
const mandatory = /require a new confirmation|asks families to confirm again|asked to confirm availability again|ახალ დასტურს მოითხოვს|ხელახლა დადასტურებას სთხოვს|ხელახლა დაადასტურებენ ხელმისაწვდომობას/i;
const onSaved = vi.fn();

beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(api.overview).mockResolvedValue({ ...squad, academy_name: 'Synthetic academy', category: 'U14', unread_count: 0,
        viewer_id: 20, member_count: 1, notify_chat: false, head_coach_id: 20, can_assign_coach: false,
        available_coaches: [], coaches: [], players: session.attendance, threads: [] });
    vi.mocked(apiClient.get).mockImplementation(async url => {
        if (url === '/squad-communication/11/sessions/81/reservation/options') return { data: { revision: 4, linked: true, options: [], manageBookingPath: '/stadiums/5?bookingId=99&squadId=11&sessionId=81' } };
        if (url === '/squad-communication/11/training-bookings/81') return { data: { revision: 4, linked: true, canCoordinate: false, series: false, startsAt: session.starts_at, endsAt: session.ends_at, timezone: 'Asia/Tbilisi' } };
        return { data: [] };
    });
});
afterEach(async () => { cleanup(); await i18n.changeLanguage('en'); });

it.each(languages)('reviews a legacy requested event in $language without promising a family confirmation', async copy => {
    await i18n.changeLanguage(copy.language);
    let resolve!: (value: api.SessionConsequence) => void;
    vi.mocked(api.previewSession).mockImplementation(() => new Promise(done => { resolve = done; }));
    render(<MemoryRouter><SquadEventEditComposer squad={squad} session={session} onClose={vi.fn()} onSaved={onSaved} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: copy.next }));
    fireEvent.change(screen.getByLabelText(copy.location), { target: { value: 'West field' } });
    fireEvent.click(screen.getByRole('button', { name: copy.next }));
    await waitFor(() => expect(api.previewSession).toHaveBeenCalledOnce());
    const confirm = screen.getByRole('button', { name: copy.confirm });
    expect(confirm).toBeDisabled();
    expect(api.previewSession).toHaveBeenCalledWith(11, 81, expect.objectContaining({ revision: 4, requestResponses: true, location: 'West field', playerIds: null, requestId: expect.stringMatching(/^[0-9a-f-]{36}$/i) }));
    await act(async () => resolve(preview));
    await waitFor(() => expect(confirm).toBeEnabled());
    const review = screen.getByText((_, node) => node?.tagName === 'P' && !!node.textContent?.includes(copy.changed)).closest('[role="status"]')!;
    expect(review).not.toHaveTextContent(mandatory);
    expect(review).toHaveTextContent(copy.expected);
    expect(review).toHaveTextContent(copy.retained);
    expect(review).toHaveTextContent(copy.optional);
    expect(api.editSession).not.toHaveBeenCalled();
    expect(api.changeSeries).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
});

it.each(languages)('reviews a linked detach in $language while retaining the real guarded confirmation and booking', async copy => {
    await i18n.changeLanguage(copy.language);
    render(<MemoryRouter><SquadVenueReservationPanel squadId={11} sessionId={81} revision={4} onSaved={onSaved} /></MemoryRouter>);
    const remove = await screen.findByRole('button', { name: copy.remove });
    const panel = remove.closest('section')!;
    expect(within(panel).getByRole('link', { name: new RegExp(copy.open) })).toHaveAttribute('href', '/stadiums/5?bookingId=99&squadId=11&sessionId=81');
    expect(within(panel).queryByRole('button', { name: copy.notify })).not.toBeInTheDocument();
    fireEvent.click(remove);
    expect(within(panel).getByRole('status')).toHaveTextContent(copy.booking);
    expect(within(panel).getByRole('button', { name: copy.notify })).toBeEnabled();
    expect(panel).not.toHaveTextContent(mandatory);
    expect(panel).toHaveTextContent(copy.clears);
    expect(panel).toHaveTextContent(copy.ownership);
    expect(panel).toHaveTextContent(copy.expected);
    expect(panel).toHaveTextContent(copy.retained);
    expect(panel).toHaveTextContent(copy.optional);
    expect(apiClient.put).not.toHaveBeenCalled();
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
});

it.each(languages)('reviews a selected unlinked reservation in $language without requiring a family reply', async copy => {
    await i18n.changeLanguage(copy.language);
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { revision: 4, linked: false, options: [{
        id: 99, venueId: 5, venueName: 'Synthetic arena', pitchName: 'Pitch A', startsAt: session.starts_at,
        endsAt: session.ends_at, timezone: 'Asia/Tbilisi', totalPrice: 75, currency: 'GEL',
    }] } });
    render(<MemoryRouter><SquadVenueReservationPanel squadId={11} sessionId={81} revision={4} onSaved={onSaved} /></MemoryRouter>);
    const select = await screen.findByLabelText(copy.reservation);
    expect(screen.queryByRole('button', { name: copy.notify })).not.toBeInTheDocument();
    fireEvent.change(select, { target: { value: '99' } });
    expect(screen.getByRole('option', { selected: true })).toHaveTextContent('Synthetic arena · Pitch A');
    expect(screen.getByRole('option', { selected: true })).toHaveTextContent('75 GEL');
    fireEvent.click(screen.getByRole('button', { name: copy.reviewLink }));
    expect(screen.getByRole('button', { name: copy.notify })).toBeEnabled();
    const review = screen.getByRole('status');
    expect(review).toHaveTextContent(copy.becomes);
    expect(review).toHaveTextContent(copy.noCharge);
    expect(review).not.toHaveTextContent(mandatory);
    expect(review).toHaveTextContent(copy.notified);
    expect(review).toHaveTextContent(copy.expected);
    expect(review).toHaveTextContent(copy.retained);
    expect(review).toHaveTextContent(copy.optional);
    expect(apiClient.put).not.toHaveBeenCalled();
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
});
