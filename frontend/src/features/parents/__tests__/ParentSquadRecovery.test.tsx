import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ChildClub, JoiningChild } from '../../joining-contract/types';
import * as api from '../../squadCommunication/api';
import type { AuthSessionId } from '../../../utils/authStorage';
import { useChildSquads } from '../hub/useChildSquads';
import { ChildPage } from '../hub/ChildPage';

vi.mock('../../squadCommunication/api', () => ({ spaces: vi.fn(), overview: vi.fn(), sessions: vi.fn(), messages: vi.fn(), attendance: vi.fn(), editSession: vi.fn(), createSession: vi.fn(), cancelSession: vi.fn() }));
vi.mock('../../squadCommunication/journeyCopy', () => ({ useJourneyCopy: () => ((en: string) => en) }));
vi.mock('../hub/ThisWeek', () => ({ ThisWeek: ({ squads }: { squads: api.SquadOverview[] }) => <section aria-label="This week">{squads.map(squad => squad.name).join(', ')}</section> }));
vi.mock('../hub/CoachUpdates', () => ({ CoachUpdates: () => null }));
vi.mock('../hub/ChildChats', () => ({ ChildChats: () => null }));
// Squad recovery is independent of the separately tested money reader.
vi.mock('../hub/ChildMoney', () => ({ ChildMoney: () => null }));

const club = (id: number): ChildClub => ({ clubId: id, clubName: 'Fixture club ' + id, cardId: 500 + id, affiliationStatus: 'ACTIVE', consentStatus: 'CONFIRMED', squadNames: [] });
const child = (id: number, name: string, clubs = [club(1)]) => ({ playerId: id, identity: { playerId: id, version: 1, fullName: name, dateOfBirth: '2015-01-01', gender: null, photoUrl: null, positions: [], dominantFoot: null, heightCm: null, weightKg: null, canEdit: false, minor: true }, clubs, cases: [], inquiries: [], guardians: [] }) as JoiningChild;
const rows: api.SquadSpace[] = [{ id: 10, club_id: 1, name: 'Fixture A', academy_name: 'Fixture club 1', category: 'U12', can_manage: false, unread_count: 0 }, { id: 20, club_id: 2, name: 'Fixture B', academy_name: 'Fixture club 2', category: 'U12', can_manage: false, unread_count: 0 }];
const overview = (id: number, players = [61, 62]): api.SquadOverview => ({ ...rows.find(row => row.id === id)!, can_manage: false, viewer_id: 7, member_count: players.length, notify_chat: true, head_coach_id: null, can_assign_coach: false, available_coaches: [], players: players.map(id => ({ id, name: String(id) })), coaches: [], threads: [] });
function deferred<T>() { let finish!: (value: T) => void; return { promise: new Promise<T>(resolve => { finish = resolve; }), resolve: (value: T) => finish(value) }; }

/** The hook as the child's page uses it: one child, their clubs, the login it belongs to. */
function Squads({ who, session = 'login-1' }: { who: JoiningChild; session?: string }) {
    const state = useChildSquads(who, 0, session as AuthSessionId);
    return <div>
        <output data-testid="squads">{state.loading ? 'loading' : state.squads.map(squad => squad.name).join(',') || 'none'}</output>
        <output data-testid="failed">{state.failedSquads.join(',')}</output>
        <output data-testid="error">{state.error}</output>
        <button onClick={state.retry}>Retry</button>
    </div>;
}
const squads = () => screen.getByTestId('squads');

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.spaces).mockReset().mockResolvedValue(rows);
    vi.mocked(api.overview).mockReset().mockImplementation(async id => overview(id));
});
afterEach(() => {
    cleanup();
    for (const method of [api.attendance, api.editSession, api.createSession, api.cancelSession]) expect(method).not.toHaveBeenCalled();
});

it('loads a confirmed training enrolment, keeping to the squads whose roster holds the child', async () => {
    vi.mocked(api.spaces).mockResolvedValue([rows[0], { ...rows[0], id: 11, name: 'Sibling only' }]);
    vi.mocked(api.overview).mockImplementation(async id => id === 10 ? overview(10, [61]) : { ...overview(10, [62]), id: 11, name: 'Sibling only' });
    render(<Squads who={child(61, 'Nika', [{ ...club(1), cardId: null, affiliationStatus: 'ENROLLED' }])} />);
    await waitFor(() => expect(squads()).toHaveTextContent('Fixture A'));
    expect(squads()).not.toHaveTextContent('Sibling only');
});

it('does not turn an unaccepted enquiry into squad access', async () => {
    render(<Squads who={child(61, 'Nika', [{ ...club(1), affiliationStatus: 'APPLICANT' }])} />);
    expect(squads()).toHaveTextContent('none');
    expect(api.spaces).not.toHaveBeenCalled();
});

it('says a failed read, and Try again reads again (reads only)', async () => {
    vi.mocked(api.spaces).mockRejectedValueOnce(new Error('Fixture read failure'));
    render(<MemoryRouter><ChildPage child={child(61, 'Nika')} sessionId={'login-1' as AuthSessionId} revision={0} onChanged={vi.fn()} /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t load the squads.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('region', { name: 'This week' })).toHaveTextContent('Fixture A');
    expect(api.spaces).toHaveBeenCalledTimes(2);
});

it('keeps fresh authorised squads on a partial read, names the one that failed, and restores it on retry', async () => {
    let failing = true;
    vi.mocked(api.overview).mockImplementation(async id => { if (id === 20 && failing) throw new Error('Fixture B read failed'); return overview(id); });
    render(<MemoryRouter><ChildPage child={child(61, 'Nika', [club(1), club(2)])} sessionId={'login-1' as AuthSessionId} revision={0} onChanged={vi.fn()} /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Some squads couldn’t load: Fixture B');
    expect(screen.getByRole('region', { name: 'This week' })).toHaveTextContent('Fixture A');
    failing = false; fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByRole('region', { name: 'This week' })).toHaveTextContent('Fixture A, Fixture B'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('does not keep a fresh roster that no longer includes the child', async () => {
    vi.mocked(api.overview).mockImplementation(async id => overview(id, [62]));
    render(<Squads who={child(61, 'Nika', [club(1), club(2)])} />);
    await waitFor(() => expect(squads()).toHaveTextContent('none'));
});

it('refuses a retired child’s answer after switching to a sibling', async () => {
    const old = deferred<api.SquadOverview>(); let first = true;
    vi.mocked(api.overview).mockImplementation(async id => { if (id === 10 && first) { first = false; return old.promise; } return overview(id, [62]); });
    const view = render(<Squads who={child(61, 'Nika')} />);
    await waitFor(() => expect(api.overview).toHaveBeenCalledTimes(1));
    view.rerender(<Squads who={child(62, 'Saba')} />);
    await waitFor(() => expect(squads()).toHaveTextContent('Fixture A'));
    await act(async () => old.resolve(overview(10, [61])));
    expect(squads()).toHaveTextContent('Fixture A');
    expect(api.overview).toHaveBeenCalledTimes(2);
});

it('refuses a retired login’s answer before it can fill the next family', async () => {
    const old = deferred<api.SquadOverview>(); let first = true;
    vi.mocked(api.overview).mockImplementation(async id => { if (id === 10 && first) { first = false; return old.promise; } return overview(id, [63]); });
    const view = render(<Squads who={child(61, 'Nika')} />);
    await waitFor(() => expect(api.overview).toHaveBeenCalledTimes(1));
    view.rerender(<Squads who={child(63, 'Own child')} session="login-2" />);
    await waitFor(() => expect(squads()).toHaveTextContent('Fixture A'));
    await act(async () => old.resolve(overview(10, [61])));
    expect(squads()).toHaveTextContent('Fixture A');
    expect(screen.getByTestId('error')).toBeEmptyDOMElement();
});

