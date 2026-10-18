import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { HistoryMatch } from '../../matchHistory/api';
import type { Squad } from '../../matchExchange/api';
import type { SquadSpace } from '../../squadCommunication/api';
import { forget } from '../cache';
import MatchPeek from '../peek/MatchPeek';
import { DrawerPlaceContext } from '../peek/drawerContext';
import { usePeek } from '../peek/usePeek';
import { loadMyTeams } from '../scoreboard/myTeams';
import { rememberMatches } from '../scoreboard/matchRegistry';

// API reads and authenticated context are process-local; no login/storage/network or domain action.
const fixture = vi.hoisted(() => ({ session: '', userId: 1 }));
const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: http }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ status: 'authenticated', sessionId: fixture.session, user: { id: fixture.userId } }) }));
// The drawer, registry, fixture loader, team aggregate, permission hook and cache are real.
// Unrelated result/offer/journey/form bodies do not run commands or additional detail reads here.
vi.mock('../peek/match/MatchAction', () => ({ MatchAction: () => null }));
vi.mock('../peek/match/MatchForm', () => ({ MatchForm: () => null }));
vi.mock('../peek/match/MatchHead', () => ({ MatchHead: ({ match }: { match: HistoryMatch }) => <p>{`Fixture ${match.sourceId} loaded for ${match.homeClubId}`}</p> }));
vi.mock('../peek/match/MatchTable', () => ({ StageTable: () => null }));

const squads: Squad[] = [{ id: 4201, club_id: 42, name: 'Our U14', category: 'U14', club_name: 'Club 42' }];
const spaces: SquadSpace[] = [{ id: 4201, club_id: 42, name: 'Our U14', category: 'U14', academy_name: 'Club 42', can_manage: false, unread_count: 0 }];
let squadRead = async () => ({ data: squads }), spaceRead = async () => ({ data: spaces }), epoch = 0;
const match = (event = 71, club = 42): HistoryMatch => ({ id: `SCHEDULE:${event}`, source: 'SCHEDULE', sourceId: event, title: 'Club fixture',
    startsAt: '2099-10-19T12:00:00Z', endsAt: '2099-10-19T14:00:00Z', timezone: 'Asia/Tbilisi', homeClubId: club, homeClubName: `Club ${club}`,
    homeSquadId: club * 100 + 1, homeSquadName: 'U14', awayClubId: 77, awayClubName: 'Visitors', awaySquadId: 7701, awaySquadName: 'U14',
    homeScore: null, awayScore: null, resultStatus: 'NONE', fixtureStatus: 'SCHEDULED', legacy: false, locationName: 'Our ground', tournamentId: null,
    tournamentName: null, detailPath: `/calendar?eventId=${event}`, canRecordResult: false });
const list = '/world/matches?tab=fixtures&clubId=42&q=academy';
function Scene() {
    const location = useLocation(), navigate = useNavigate(), peek = usePeek();
    return <>
        <p aria-label="Fixture route">{location.pathname + location.search}</p>
        <button type="button" onClick={() => peek.open('match-s72')}>Other fixture</button>
        <button type="button" onClick={() => navigate(-1)}>Fixture router Back</button>
        {peek.right?.kind === 'match' && <DrawerPlaceContext.Provider value={{ side: 'right', place: 'drawer', close: peek.closeAll }}><MatchPeek id={peek.right.id} /></DrawerPlaceContext.Provider>}
    </>;
}
function App({ code = 's71' }: { code?: string }) {
    return <MemoryRouter initialEntries={[list, { pathname: '/world/matches', search: `?tab=fixtures&clubId=42&q=academy&peek=match-${code}`, state: { drawers: true } }]} initialIndex={1}>
        <Routes><Route path="/world/matches" element={<Scene />} /><Route path="/calendar" element={<p>Calendar destination</p>} /></Routes>
    </MemoryRouter>;
}
const loaded = (event = 71, club = 42) => screen.findByText(`Fixture ${event} loaded for ${club}`);
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
beforeEach(() => {
    vi.clearAllMocks(); forget(''); fixture.session = `calendar-fixture-${++epoch}`; fixture.userId = 1;
    squadRead = async () => ({ data: squads }); spaceRead = async () => ({ data: spaces });
    http.get.mockImplementation((url: string) => {
        if (url === '/match-exchange/squads') return squadRead();
        if (url === '/squad-communication') return spaceRead();
        throw new Error(`Unexpected read: ${url}`);
    });
    rememberMatches(fixture.session, [match(), match(72, 99)]);
});
afterEach(() => { cleanup(); for (const command of [http.post, http.put, http.patch, http.delete]) expect(command).not.toHaveBeenCalled(); });

it('recovers the calendar entrance from a failed permission read even while the best-effort aggregate remains cached empty', async () => {
    squadRead = async () => { throw new Error('Permission read unavailable'); };
    const aggregate = await loadMyTeams(fixture.session);
    expect(aggregate.arrangeClubIds.size).toBe(0); expect(aggregate.squadIds.has(4201)).toBe(true);
    render(<App />); await loaded();
    expect(await screen.findByRole('alert')).toHaveTextContent('Your squads could not load.');
    expect(screen.queryByRole('link', { name: 'Open in calendar' })).not.toBeInTheDocument();
    const before = http.get.mock.calls.length;
    squadRead = async () => ({ data: squads });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('link', { name: 'Open in calendar' })).toHaveAttribute('href', '/calendar?eventId=71');
    expect(http.get).toHaveBeenCalledTimes(before + 1);
    expect(await loadMyTeams(fixture.session)).toBe(aggregate);
    expect(screen.getByLabelText('Fixture route')).toHaveTextContent(`${list}&peek=match-s71`);
    fireEvent.click(screen.getByRole('button', { name: /Close/ }));
    expect(screen.getByLabelText('Fixture route')).toHaveTextContent(list);
    expect(screen.queryByText('Fixture 71 loaded for 42')).not.toBeInTheDocument();
});

it('keeps a loaded fixture readable while squad authority is still unknown', async () => {
    const pending = deferred<{ data: Squad[] }>(); squadRead = () => pending.promise;
    render(<App />); await loaded();
    expect(screen.queryByRole('link', { name: 'Open in calendar' })).not.toBeInTheDocument();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    await act(async () => pending.resolve({ data: squads }));
    expect(await screen.findByRole('link', { name: 'Open in calendar' })).toHaveAttribute('href', '/calendar?eventId=71');
});

it('keeps genuine confirmed-empty authority hidden even when squad spaces identify the same club', async () => {
    squadRead = async () => ({ data: [] });
    render(<App />); await loaded(); await waitFor(() => expect(http.get).toHaveBeenCalledWith('/squad-communication', expect.anything()));
    expect((await loadMyTeams(fixture.session)).clubIds.has(42)).toBe(true);
    expect(screen.queryByRole('link', { name: 'Open in calendar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
});

it('retains successful arrangeable authority when only squad spaces fail', async () => {
    spaceRead = async () => { throw new Error('Spaces unavailable'); };
    render(<App />); await loaded();
    expect(await screen.findByRole('link', { name: 'Open in calendar' })).toHaveAttribute('href', '/calendar?eventId=71');
    expect((await loadMyTeams(fixture.session)).arrangeClubIds.has(42)).toBe(true);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('clears a read error after retry returns a genuine empty permission list without inferring authority', async () => {
    squadRead = async () => { throw new Error('Permission read unavailable'); };
    render(<App />); await loaded(); await screen.findByRole('alert');
    squadRead = async () => ({ data: [] }); fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(screen.queryByRole('link', { name: 'Open in calendar' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Fixture route')).toHaveTextContent(`${list}&peek=match-s71`);
});

it('checks the actual fixture club rather than trusting the selected club in the URL', async () => {
    render(<App code="s72" />); await loaded(72, 99); await loadMyTeams(fixture.session);
    expect(screen.getByLabelText('Fixture route')).toHaveTextContent('clubId=42');
    expect(screen.queryByRole('link', { name: 'Open in calendar' })).not.toBeInTheDocument();
});

it('keeps a pending previous-login permission reply away from the current login calendar entrance', async () => {
    const pending = deferred<{ data: Squad[] }>(), oldSession = fixture.session;
    squadRead = () => fixture.session === oldSession ? pending.promise : Promise.resolve({ data: [{ ...squads[0], club_id: 99 }] });
    const view = render(<App />); await loaded();
    fixture.session = `calendar-fixture-${++epoch}`; fixture.userId = 2; rememberMatches(fixture.session, [match()]);
    view.rerender(<App />); await loaded();
    await waitFor(() => expect(http.get.mock.calls.filter(([url]) => url === '/match-exchange/squads').length).toBeGreaterThanOrEqual(2));
    await act(async () => pending.resolve({ data: squads }));
    expect(screen.queryByRole('link', { name: 'Open in calendar' })).not.toBeInTheDocument();
});

it('applies retry to the current fixture without restoring the previous drawer or changing list context', async () => {
    squadRead = async () => { throw new Error('Permission read unavailable'); };
    render(<App />); await loaded(); await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Other fixture' })); await loaded(72, 99);
    squadRead = async () => ({ data: squads }); fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(screen.queryByRole('link', { name: 'Open in calendar' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Fixture route')).toHaveTextContent(`${list}&peek=match-s72`);
});
