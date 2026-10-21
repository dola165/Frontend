import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Squad } from '../../matchExchange/api';
import { requestEntry } from '../../tournaments/api';
import type { TournamentDetail, TournamentEntryDto } from '../../tournaments/domain';
import { TournamentAction } from '../peek/tournament/TournamentAction';
import type { TournamentPaneData } from '../peek/tournament/tournamentPane';
import { useTournamentGate } from '../peek/tournament/useTournamentGate';
import { useTournamentChoiceBoundary } from '../peek/tournament/tournamentChoice';

// Confirmed-session fixtures remain inside this jsdom process; every entry request is mocked.
const fixture = vi.hoisted(() => ({ session: '', squads: [] as Squad[], listeners: new Set<() => void>() }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ status: 'authenticated', sessionId: fixture.session, user: { id: 1 } }) }));
vi.mock('../../../utils/authStorage', () => ({
    getAuthSessionId: () => fixture.session, getStoredUserId: () => '1', getStoredAccessToken: () => 'fixture-token',
    subscribeAuthSession: (listener: () => void) => { fixture.listeners.add(listener); return () => fixture.listeners.delete(listener); },
}));
vi.mock('../../tournaments/api', () => ({ requestEntry: vi.fn(), acceptInvitation: vi.fn(), declineInvitation: vi.fn(), registerPlayer: vi.fn(), withdrawEntry: vi.fn() }));
vi.mock('../../competitions/usePlayerEntryEligibility', () => ({ usePlayerEntryEligibility: () => ({ eligible: false, status: 'inactive', retry: vi.fn() }) }));
vi.mock('../compose/useArrangeableSquads', () => ({ useArrangeableSquadsState: () => ({ squads: fixture.squads, error: '', retry: vi.fn() }) }));

const squads: Squad[] = [
    { id: 103, club_id: 1, name: 'U14 Boys', category: 'U14', club_name: 'Dinamo' },
    { id: 104, club_id: 1, name: 'U12 Boys', category: 'U12', club_name: 'Dinamo' },
    { id: 205, club_id: 2, name: 'United U14', category: 'U14', club_name: 'United' },
];
const pane = (detail: Partial<TournamentDetail> = {}): TournamentPaneData => ({
    detail: { id: 303, name: 'Festival', status: 'PLANNING', participantScope: 'SQUAD', visibility: 'PUBLIC', registrationPolicy: 'OPEN',
        registrationOpensAt: '2020-01-01T00:00:00', registrationClosesAt: '2099-10-28T00:00:00', entryCap: 1,
        entries: [], staffAssignments: [], stages: [], fixtures: [], ...detail } as TournamentDetail,
    rules: { ageGroup: 'U14', eligibilityCategory: 'open' } as TournamentPaneData['rules'],
    draw: null, shape: null, host: null, mine: new Set(), canManage: false, invitation: null,
});
const entry = (id: number, status: TournamentEntryDto['status'] = 'WAITLISTED', clubId = 1, squadId = 104) => ({
    id, status, clubId, squadId, squadName: clubId === 1 ? 'U12 Boys' : 'United U14',
}) as TournamentEntryDto;
const withdrawn = (row: TournamentEntryDto): TournamentEntryDto => ({ ...row, status: 'WITHDRAWN' });
function Form({ data, reload }: { data: TournamentPaneData; reload: () => void }) {
    useTournamentChoiceBoundary(data.detail.id);
    const gate = useTournamentGate(data);
    return <MemoryRouter><TournamentAction data={data} reload={reload} entry={gate} /></MemoryRouter>;
}
function show(data = pane()) {
    const reload = vi.fn(), view = render(<Form data={data} reload={reload} />);
    return { ...view, reload, update: (next: TournamentPaneData) => view.rerender(<Form data={next} reload={reload} />) };
}
const submit104 = () => {
    fireEvent.change(screen.getByRole('combobox', { name: 'Another squad' }), { target: { value: '104' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enter U12 Boys' }));
};
const expectLocked = () => expect(screen.queryByRole('button', { name: /^Enter/ })).not.toBeInTheDocument();
let epoch = 0;
beforeEach(() => {
    vi.clearAllMocks(); fixture.squads = squads; fixture.session = `receipt-fixture-${++epoch}`;
    for (const notify of fixture.listeners) notify();
});
afterEach(() => cleanup());

it.each(['SQUAD', 'CLUB'] as const)('tracks the submitted %s entry independently of a concurrent permitted club and row order', async participantScope => {
    const concurrent = entry(819, 'ACTIVE', 2, 205), submitted = entry(820);
    let resolve!: (detail: TournamentDetail) => void;
    vi.mocked(requestEntry).mockReturnValueOnce(new Promise<TournamentDetail>(done => { resolve = done; }));
    const view = show(pane({ participantScope }));
    submit104();
    fireEvent.click(screen.getByRole('button', { name: 'Sending…' }));
    expect(requestEntry).toHaveBeenCalledExactlyOnceWith(303, { clubId: 1, squadId: 104 }, { _authSessionId: fixture.session });
    await act(async () => resolve(pane({ participantScope, entries: [concurrent, submitted] }).detail));
    view.update(pane({ participantScope, entries: [withdrawn(submitted), concurrent] }));
    expectLocked(); // The other club's canonical live entry still owns the action surface.
    view.update(pane({ participantScope, entries: [withdrawn(concurrent), withdrawn(submitted)] }));
    expect(screen.getByRole('button', { name: 'Enter U14 Boys' })).toBeEnabled();
    expect(requestEntry).toHaveBeenCalledOnce();
});

it.each(['other-club-only', 'empty'] as const)('reconciles an unresolved %s acknowledgement with its own later row even when another club still sorts first', async response => {
    const concurrent = entry(831, 'ACTIVE', 2, 205), submitted = entry(832);
    vi.mocked(requestEntry).mockResolvedValueOnce(response === 'empty' ? {} as TournamentDetail : pane({ entries: [concurrent] }).detail);
    const view = show();
    await act(async () => submit104());
    view.update(pane({ entries: [withdrawn(concurrent)] }));
    expectLocked();
    view.update(pane({ entries: [concurrent, submitted] }));
    view.update(pane({ entries: [withdrawn(concurrent), withdrawn(submitted)] }));
    expect(screen.getByRole('button', { name: 'Enter U14 Boys' })).toBeEnabled();
    expect(requestEntry).toHaveBeenCalledOnce();
});

it('refuses a different squad at the submitted club as the receipt and waits for the actual submitted squad', async () => {
    const wrong = entry(841, 'ACTIVE', 1, 103), submitted = entry(842);
    vi.mocked(requestEntry).mockResolvedValueOnce(pane({ entries: [wrong] }).detail);
    const view = show();
    await act(async () => submit104());
    view.update(pane({ entries: [wrong] }));
    view.update(pane({ entries: [withdrawn(wrong)] }));
    expectLocked();
    view.update(pane({ entries: [withdrawn(wrong), submitted] }));
    view.update(pane({ entries: [withdrawn(wrong), withdrawn(submitted)] }));
    expect(screen.getByRole('button', { name: 'Enter U14 Boys' })).toBeEnabled();
    expect(requestEntry).toHaveBeenCalledOnce();
});

it('leaves multiple matching live rows unresolved until a later read identifies one unique live entry', async () => {
    const first = entry(851), second = entry(852), identified = entry(853);
    vi.mocked(requestEntry).mockResolvedValueOnce(pane({ entries: [first, second] }).detail);
    const view = show();
    await act(async () => submit104());
    view.update(pane({ entries: [withdrawn(first), withdrawn(second)] }));
    expectLocked();
    view.update(pane({ entries: [withdrawn(first), withdrawn(second), identified] }));
    view.update(pane({ entries: [withdrawn(first), withdrawn(second), withdrawn(identified)] }));
    expect(screen.getByRole('button', { name: 'Enter U14 Boys' })).toBeEnabled();
    expect(requestEntry).toHaveBeenCalledOnce();
});

it('does not acknowledge an otherwise matching row from a different tournament', async () => {
    const submitted = entry(861);
    vi.mocked(requestEntry).mockResolvedValueOnce(pane({ id: 404, entries: [submitted] }).detail);
    const view = show();
    await act(async () => submit104());
    view.update(pane({ entries: [withdrawn(submitted)] }));
    expectLocked();
    view.update(pane({ entries: [submitted] }));
    view.update(pane({ entries: [withdrawn(submitted)] }));
    expect(screen.getByRole('button', { name: 'Enter U14 Boys' })).toBeEnabled();
    expect(requestEntry).toHaveBeenCalledOnce();
});
