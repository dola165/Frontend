import '../../../i18n';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Appointment, Match } from '../../matchExchange/api';
import type { HistoryMatch } from '../../matchHistory/api';
import MyCompetitionsPage from '../MyCompetitionsPage';
import MyMatchesPage from '../MyMatchesPage';
import { OfferToReferee } from '../OfferToReferee';
import { WhoPlayed } from '../WhoPlayed';
import { FixtureBand } from '../../matchExchange/detail/FixtureBand';
import { MatchDayPlan } from '../../matchExchange/detail/MatchDayPlan';
import { matchGates } from '../../matchExchange/detail/matchState';

const http = vi.hoisted(() => ({ post: vi.fn() }));
const loaded = vi.hoisted(() => ({} as Record<string, unknown>));
const auth = vi.hoisted(() => ({ user: undefined as unknown }));
const history = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../../matchExchange/api', async original => ({ ...(await original<typeof import('../../matchExchange/api')>()), post: http.post }));
vi.mock('../../matchExchange/hooks', async original => ({ ...(await original<typeof import('../../matchExchange/hooks')>()), useLoad: (path: string) => ({ data: loaded[path], error: '', reload: vi.fn() }) }));
vi.mock('../../../context/AuthContext', async original => ({ ...(await original<typeof import('../../../context/AuthContext')>()), useAuth: () => ({ user: auth.user, sessionId: undefined }) }));
vi.mock('../../matchHistory/api', async original => ({ ...(await original<typeof import('../../matchHistory/api')>()), getMatchHistory: history.get }));

afterEach(() => { cleanup(); vi.clearAllMocks(); for (const key of Object.keys(loaded)) delete loaded[key]; });
const match = (patch: Partial<Match> = {}) => ({ event_id: 12, revision: 3, club_id: 4, club_name: 'Saburtalo Youth', squad_name: 'U14', listing_status: 'ARRANGED', event_status: 'SCHEDULED',
    starts_at: '2099-10-31T11:00:00', ends_at: '2099-10-31T12:20:00', starts_at_iso: '2099-10-31T07:00:00Z', ends_at_iso: '2099-10-31T08:20:00Z', timezone: 'Asia/Tbilisi', ...patch } as Match);
const workspaces = (id: string, context: { type: string; id: number; label: string }) => ({ id: 5, navigationCapabilities: { version: 1, workspaces: [{ id, context }] } });
const referee = workspaces('referee.workspace', { type: 'user', id: 5, label: 'Referee' });

describe('who played', () => {
    it('is the call-ups saved at kick-off: staff take off a no-show, add a player, and confirm the other side’s', async () => {
        loaded['/match-arrangements/12/who-played'] = { lockedAt: '2026-10-29T10:00:00Z', changeUntil: '2099-01-01T00:00:00Z', revision: 5, teams: [{ squadId: 7, squadName: 'U14 Boys', canChange: true,
            players: [{ id: 1, name: 'Luka Beridze', played: true, added: false }, { id: 2, name: 'Saba Kapanadze', played: false, added: false }], others: [{ id: 3, name: 'Gio Lomidze' }] }],
        additions: [{ id: 40, squadId: 9, squadName: 'U14', clubName: 'Rival academy', playerName: 'Nika T.', shirt: 9, status: 'PENDING', canDecide: true, confirmer: 'OTHER_CLUB' }] };
        render(<MemoryRouter><WhoPlayed match={match()} /></MemoryRouter>);
        expect(screen.getAllByText('1 played · saved at kick-off').length).toBeGreaterThan(0);
        expect(screen.queryByRole('checkbox')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Didn’t play' }));
        await waitFor(() => expect(http.post).toHaveBeenCalledWith('/match-arrangements/12/squads/7/who-played', { playerId: 1, played: false, revision: 5, requestId: expect.any(String) }));
        fireEvent.change(screen.getByLabelText('Add a player who wasn’t called up'), { target: { value: '3' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add' }));
        await waitFor(() => expect(http.post).toHaveBeenCalledWith('/match-arrangements/12/squads/7/who-played/additions', { playerId: 3, requestId: expect.any(String) }));
        expect(screen.getByText('Added by Rival academy')).toBeTruthy();
        // The other club's player, child-safe: first name, last initial and shirt (fix round 1).
        expect(screen.getByText('Nika T.')).toBeTruthy();
        expect(screen.getByText('· #9')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
        await waitFor(() => expect(http.post).toHaveBeenCalledWith('/match-arrangements/12/who-played/additions/40', { action: 'CONFIRM' }));
    });

    it('retries a change whose reply was lost with the same request id, and a change on a fresh list with a new one', async () => {
        const list = (revision: number) => ({ lockedAt: '2026-10-29T10:00:00Z', changeUntil: '2099-01-01T00:00:00Z', revision, teams: [{ squadId: 7, squadName: 'U14 Boys', canChange: true,
            players: [{ id: 1, name: 'Luka Beridze', played: true, added: false }], others: [] }], additions: [] });
        loaded['/match-arrangements/12/who-played'] = list(5);
        http.post.mockRejectedValueOnce(new Error('Network Error'));
        const { rerender } = render(<MemoryRouter><WhoPlayed match={match()} /></MemoryRouter>);
        fireEvent.click(screen.getByRole('button', { name: 'Didn’t play' }));
        await waitFor(() => expect(http.post).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Didn’t play' })).not.toBeDisabled());
        fireEvent.click(screen.getByRole('button', { name: 'Didn’t play' }));
        await waitFor(() => expect(http.post).toHaveBeenCalledTimes(2));
        const [first, second] = http.post.mock.calls.map(call => call[1] as { requestId: string; revision: number });
        expect(second.requestId).toBe(first.requestId);
        expect(second.revision).toBe(5);
        // Someone changed the list since: the next change is made on the fresh list, as a new request.
        loaded['/match-arrangements/12/who-played'] = list(7);
        rerender(<MemoryRouter><WhoPlayed match={match()} /></MemoryRouter>);
        await waitFor(() => expect(screen.getByRole('button', { name: 'Didn’t play' })).not.toBeDisabled());
        fireEvent.click(screen.getByRole('button', { name: 'Didn’t play' }));
        await waitFor(() => expect(http.post).toHaveBeenCalledTimes(3));
        const third = http.post.mock.calls[2][1] as { requestId: string; revision: number };
        expect(third.revision).toBe(7);
        expect(third.requestId).not.toBe(first.requestId);
    });

    it('says who confirms a player added afterwards, and why it waits when nobody can', () => {
        loaded['/match-arrangements/12/who-played'] = { lockedAt: '2026-10-29T10:00:00Z', changeUntil: '2099-01-01T00:00:00Z', revision: 2, teams: [{ squadId: 7, squadName: 'U14 Boys', canChange: true,
            players: [], others: [] }], additions: [
            { id: 41, squadId: 7, squadName: 'U14 Boys', clubName: 'Our academy', playerName: 'Gio Lomidze', status: 'PENDING', canDecide: false, confirmer: 'NOBODY' },
            { id: 42, squadId: 7, squadName: 'U14 Boys', clubName: 'Our academy', playerName: 'Saba Kapanadze', status: 'PENDING', canDecide: false, confirmer: 'REFEREE' }] };
        render(<MemoryRouter><WhoPlayed match={match()} /></MemoryRouter>);
        expect(screen.getByText('Gio Lomidze: waiting. Nobody can confirm it yet: the other club isn’t in GrassKickZ and no referee accepted.')).toBeTruthy();
        expect(screen.getByText('Saba Kapanadze: waiting for the referee to confirm')).toBeTruthy();
    });

    it('closes 48 hours after kick-off, and lists nobody when nobody was called up', () => {
        loaded['/match-arrangements/12/who-played'] = { lockedAt: '2026-10-01T10:00:00Z', changeUntil: '2026-10-03T10:00:00Z', teams: [{ squadId: 7, squadName: 'U14 Boys', canChange: true,
            players: [], others: [{ id: 3, name: 'Gio Lomidze' }] }], additions: [] };
        render(<MemoryRouter><WhoPlayed match={match()} /></MemoryRouter>);
        expect(screen.getByText('Nobody was called up, so nobody is listed')).toBeTruthy();
        expect(screen.queryByRole('button')).toBeNull();
        expect(screen.queryByRole('combobox')).toBeNull();
    });
});

describe('offer to referee', () => {
    it('lets a referee offer for a match that needs one, on its own terms', async () => {
        auth.user = referee;
        loaded['/match-arrangements/12/official-request'] = { status: 'OPEN', volunteer: false, fee: 80, currency: 'GEL', revision: 4, applications: [] };
        render(<MemoryRouter><OfferToReferee match={match({ referee_required: true, referee_status: 'NEEDED' })} /></MemoryRouter>);
        expect(screen.getByText('80 GEL')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Offer to referee' }));
        await waitFor(() => expect(http.post).toHaveBeenCalledWith('/match-arrangements/12/official-request/apply', { revision: 4 }));
    });

    it('stays off for someone who isn’t a referee and for a match that has its referee; an offer can be withdrawn', () => {
        loaded['/match-arrangements/12/official-request'] = { status: 'OPEN', volunteer: true, fee: 0, currency: 'GEL', revision: 4, applications: [{ referee_id: 5, status: 'PENDING' }] };
        auth.user = workspaces('squad.workspace', { type: 'squad', id: 7, label: 'U14' });
        const { container, rerender } = render(<MemoryRouter><OfferToReferee match={match({ referee_required: true, referee_status: 'NEEDED' })} /></MemoryRouter>);
        expect(container.textContent).toBe('');
        auth.user = referee;
        rerender(<MemoryRouter><OfferToReferee match={match({ referee_required: true, referee_status: 'ACCEPTED' })} /></MemoryRouter>);
        expect(container.textContent).toBe('');
        rerender(<MemoryRouter><OfferToReferee match={match({ referee_required: true, referee_status: 'NEEDED' })} /></MemoryRouter>);
        expect(screen.getByText('Your offer is with the club. It chooses one referee.')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Withdraw' })).toBeTruthy();
    });

    it('stays off a competition match: its referees are the competition’s', () => {
        auth.user = referee;
        loaded['/match-arrangements/12/official-request'] = { status: 'OPEN', volunteer: true, fee: 0, currency: 'GEL', revision: 4, applications: [] };
        const { container } = render(<MemoryRouter><OfferToReferee match={match({ origin: 'COMPETITION', referee_required: true, referee_status: 'NEEDED' })} /></MemoryRouter>);
        expect(container.textContent).toBe('');
    });
});

describe('my matches', () => {
    const appointment = (id: number, status: string, start: string, patch: Partial<Appointment> = {}) => ({ id, event_id: 100 + id, referee_id: 5, duty: 'REFEREE', status, volunteer: false, fee: 60,
        currency: 'GEL', report: null, report_submitted_at: null, title: 'Friendly', starts_at: '', ends_at: '', starts_at_iso: start, ends_at_iso: new Date(Date.parse(start) + 90 * 60e3).toISOString(),
        event_status: 'SCHEDULED', club_name: 'Saburtalo', opponent_name: 'Didube', location_name: 'Saburtalo ground', ...patch } as Appointment);

    it('puts a referee’s invitations, reports, matches coming up, matches nearby and what they refereed in one place', async () => {
        loaded['/referees/me'] = { profile: null, availability: [], appointments: [appointment(1, 'INVITED', '2099-01-02T10:00:00Z'), appointment(2, 'ACCEPTED', '2099-01-05T10:00:00Z'),
            appointment(3, 'ACCEPTED', '2000-01-01T10:00:00Z'), appointment(4, 'ACCEPTED', '2000-01-01T10:00:00Z', { report_submitted_at: '2000-01-01T12:00:00Z' })] };
        loaded['/match-arrangements/official-requests'] = [{ event_id: 300, title: 'Vake v Gldani', location_name: 'Vake', starts_at_iso: '2099-01-03T10:00:00Z', ends_at_iso: '2099-01-03T11:30:00Z',
            volunteer: true, fee: 0, currency: 'GEL', revision: 2, application_status: null }];
        const { container } = render(<MemoryRouter><MyMatchesPage /></MemoryRouter>);
        for (const title of ['To answer', 'Reports to write', 'Coming up', 'Matches that need a referee', 'Refereed']) expect(screen.getAllByText(title).length).toBeGreaterThan(0);
        // Each opens the one match page as theirs; an invitation at its answer.
        expect(container.querySelector('a[href="/matches/101?from=referee#appointment-1"]')).toBeTruthy();
        expect(container.querySelector('a[href="/matches/102?from=referee"]')).toBeTruthy();
        expect(container.querySelector('a[href="/matches/300?from=referee"]')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Offer to referee' }));
        await waitFor(() => expect(http.post).toHaveBeenCalledWith('/match-arrangements/300/official-request/apply', { revision: 2 }));
    });
});

describe('my competitions', () => {
    const fixture = (id: number, detailPath: string) => ({ id: `TOURNAMENT:${id}`, source: 'TOURNAMENT', sourceId: id, title: 'Tbilisi Community League', startsAt: '2099-01-03T15:00:00',
        homeClubName: 'FC Dinamo Tbilisi Academy', awayClubName: 'Riverside Academy', locationName: null, detailPath } as unknown as HistoryMatch);

    it('shows each competition’s fixtures as the matches both squads have in their week, and the results to add', async () => {
        auth.user = workspaces('tournament.workspace', { type: 'tournament', id: 301, label: 'Tbilisi Community League' });
        history.get.mockImplementation((query: string) => Promise.resolve({ items: query.includes('period=UPCOMING') ? [fixture(1, '/matches/5863')] : [fixture(2, '/tournaments/301?fixtureId=2')], total: 1, page: 0, pageSize: 20 }));
        const { container } = render(<MemoryRouter><MyCompetitionsPage /></MemoryRouter>);
        expect(await screen.findByText('Result to add')).toBeTruthy();
        expect(history.get).toHaveBeenCalledWith('tournamentId=301&period=UPCOMING&size=20', expect.anything(), undefined);
        // A fixture that is a match opens the one match page in this competition; one that isn't yet, the workspace.
        const links = [...container.querySelectorAll('a')].map(a => a.getAttribute('href'));
        expect(links).toContain('/matches/5863?from=competition%3A301');
        expect(links).toContain('/tournaments/301/workspace?view=schedule&fixtureId=2');
    });
});

describe('an open challenge for someone who may not know its hours', () => {
    const before = Date.parse('2099-11-01T00:00:00Z');
    const hidden = (patch: Partial<Match> = {}) => match({ listing_status: 'OPEN', squad_id: 7, time_hidden: true, place_hidden: true, city: 'Tbilisi', location_name: 'Tbilisi', window_from: null, window_to: null, match_minutes: 60,
        starts_at: '2099-11-14T12:00:00', ends_at: '2099-11-15T12:00:00', starts_at_iso: '2099-11-14T08:00:00Z', ends_at_iso: '2099-11-15T08:00:00Z', ...patch });
    const coachOf = { id: 9, club_id: 5, name: 'U12', category: 'U12', club_name: 'Other club' };

    it('shows its days, no hours, and whose the kick-off and the ground are', () => {
        render(<MemoryRouter><FixtureBand match={hidden()} now={before} /><MatchDayPlan match={hidden()} active reload={vi.fn()} onReserve={vi.fn()} /></MemoryRouter>);
        expect(screen.getAllByText(/14.*Nov.*–.*15.*Nov/)).toHaveLength(2);
        expect(screen.getByText('The kick-off is for the clubs and families playing')).toBeTruthy();
        expect(screen.getByText('The ground is for the clubs and families playing')).toBeTruthy();
        expect(screen.queryByText(/\d\d:\d\d/)).toBeNull();
        expect(screen.queryByText(/once the match is agreed/)).toBeNull();
    });

    it('tells a coach who can take it that the ground comes once it is agreed', () => {
        const coach = hidden({ time_hidden: false, window_from: '10:00:00', window_to: '13:00:00', starts_at: '2099-11-14T10:00:00', ends_at: '2099-11-15T13:00:00' });
        render(<MemoryRouter><MatchDayPlan match={coach} active reload={vi.fn()} onReserve={vi.fn()} /></MemoryRouter>);
        expect(screen.getByText('10:00–13:00')).toBeTruthy();
        expect(screen.getByText('The ground shows once the match is agreed')).toBeTruthy();
    });

    it('offers the answer form only to someone given the hours', () => {
        expect(matchGates(hidden(), before, [coachOf]).canPropose).toBe(false);
        expect(matchGates(hidden({ time_hidden: false }), before, [coachOf]).canPropose).toBe(true);
    });
});

describe('a past match added afterwards', () => {
    it('says on the fixture whose record it is', () => {
        render(<MemoryRouter><FixtureBand match={match({ origin: 'PAST', outside_opponent: 'Old Town FC', event_status: 'COMPLETED', starts_at_iso: '2026-10-20T07:00:00Z', ends_at_iso: '2026-10-20T08:20:00Z' })} now={Date.now()} /></MemoryRouter>);
        expect(screen.getByText('Added by Saburtalo Youth')).toBeTruthy();
    });
});
