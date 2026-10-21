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

// Process-local confirmed-session/read fixtures. No login route, browser session or server mutation is used.
const fixture = vi.hoisted(() => ({
    epoch: 0, session: '', storedUser: '1', token: 'fixture-token',
    auth: { status: 'authenticated' as 'authenticated' | 'anonymous', sessionId: '' as string | null, user: { id: 1 } as { id: number } | null },
    squads: undefined as Squad[] | undefined,
    listeners: new Set<() => void>(),
}));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => fixture.auth }));
vi.mock('../../../utils/authStorage', () => ({
    getAuthSessionId: () => fixture.session,
    getStoredUserId: () => fixture.storedUser,
    getStoredAccessToken: (session = fixture.session) => session === fixture.session ? fixture.token : null,
    subscribeAuthSession: (listener: () => void) => { fixture.listeners.add(listener); return () => fixture.listeners.delete(listener); },
}));
vi.mock('../../tournaments/api', () => ({ requestEntry: vi.fn(), acceptInvitation: vi.fn(), declineInvitation: vi.fn(), registerPlayer: vi.fn(), withdrawEntry: vi.fn() }));
vi.mock('../../competitions/usePlayerEntryEligibility', () => ({ usePlayerEntryEligibility: () => ({ eligible: false, status: 'inactive', retry: vi.fn() }) }));
vi.mock('../compose/useArrangeableSquads', () => ({ useArrangeableSquadsState: () => ({ squads: fixture.squads, error: fixture.squads === undefined ? 'Permission read failed' : '', retry: vi.fn() }) }));

const squads: Squad[] = [
    { id: 103, club_id: 1, name: 'U14 Boys', category: 'U14', club_name: 'Dinamo' },
    { id: 104, club_id: 1, name: 'U12 Boys', category: 'U12', club_name: 'Dinamo' },
];
const other: Squad = { id: 205, club_id: 2, name: 'United U14', category: 'U14', club_name: 'United' };
const pane = (id = 303, detail: Partial<TournamentDetail> = {}): TournamentPaneData => ({
    detail: { id, name: `Festival ${id}`, status: 'PLANNING', participantScope: 'SQUAD', visibility: 'PUBLIC', registrationPolicy: 'OPEN',
        registrationOpensAt: '2020-01-01T00:00:00', registrationClosesAt: '2099-10-28T00:00:00', entryCap: 12,
        entries: [], staffAssignments: [], stages: [], fixtures: [], ...detail } as TournamentDetail,
    rules: { ageGroup: 'U14', eligibilityCategory: 'open' } as TournamentPaneData['rules'],
    draw: null, shape: null, host: null, mine: new Set(), canManage: false, invitation: null,
});
const entry = (id: number, status: TournamentEntryDto['status'] = 'ACTIVE') => ({ id, clubId: 1, squadId: 104, squadName: 'U12 Boys', status }) as TournamentEntryDto;
function Form({ data, reload }: { data: TournamentPaneData; reload: () => void }) {
    useTournamentChoiceBoundary(data.detail.id);
    const gate = useTournamentGate(data);
    return <MemoryRouter><TournamentAction data={data} reload={reload} entry={gate} /></MemoryRouter>;
}
const show = (data = pane(), reload = vi.fn()) => {
    const view = render(<Form data={data} reload={reload} />);
    return { ...view, reload, update: (next = data) => view.rerender(<Form data={next} reload={reload} />) };
};
const pick104 = () => fireEvent.change(screen.getByRole('combobox', { name: 'Another squad' }), { target: { value: '104' } });
const enter = () => fireEvent.click(screen.getByRole('button', { name: 'Enter U12 Boys' }));
const emitAuth = () => { for (const listener of fixture.listeners) listener(); };
function login(user = 1) {
    fixture.session = `fixture-${++fixture.epoch}`;
    fixture.storedUser = String(user);
    fixture.token = 'fixture-token';
    fixture.auth = { status: 'authenticated', sessionId: fixture.session, user: { id: user } };
    emitAuth();
}
function deferred<T>() {
    let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

beforeEach(() => {
    vi.clearAllMocks();
    fixture.squads = squads;
    login();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('retains a deliberate choice through same-tournament unmount and permission-error retry', () => {
    const data = pane(), view = show(data);
    pick104();
    view.unmount();
    const next = show(data);
    expect(screen.getByRole('button', { name: 'Enter U12 Boys' })).toBeEnabled();
    fixture.squads = undefined;
    next.update();
    expect(screen.getByRole('alert')).toHaveTextContent('Whether you can enter could not be checked.');
    expect(screen.queryByRole('button', { name: /^Enter/ })).not.toBeInTheDocument();
    fixture.squads = squads;
    next.update();
    expect(screen.getByRole('button', { name: 'Enter U12 Boys' })).toBeEnabled();
    expect(requestEntry).not.toHaveBeenCalled();
});

it('keeps an invalidated choice empty and offers the sole permitted squad explicitly without losing focus', async () => {
    const view = show();
    fireEvent.click(screen.getByRole('button', { name: 'U14 Boys' }));
    fixture.squads = [squads[1]];
    view.update();
    const sole = screen.getByRole('button', { name: 'U12 Boys' });
    expect(sole).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Enter' })).toBeDisabled();
    sole.focus();
    fireEvent.click(sole);
    expect(sole).toHaveFocus();
    expect(sole).toHaveAttribute('aria-pressed', 'true');
    const pending = deferred<TournamentDetail>();
    vi.mocked(requestEntry).mockReturnValueOnce(pending.promise);
    enter();
    expect(requestEntry).toHaveBeenCalledExactlyOnceWith(303, { clubId: 1, squadId: 104 }, { _authSessionId: fixture.session });
    await act(async () => pending.resolve(pane(303, { entries: [entry(70)] }).detail));
});

it('does not restore a revoked squad when permissions return and recovers an invalidated sole club explicitly', () => {
    fixture.squads = [...squads, other];
    const view = show();
    pick104();
    fixture.squads = [squads[0], other];
    view.update();
    fixture.squads = [...squads, other];
    view.update();
    expect(screen.getByRole('button', { name: 'Enter' })).toBeDisabled();
    fixture.squads = [other];
    view.update();
    const club = screen.getByRole('button', { name: 'United' });
    expect(club).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(club);
    expect(screen.getByRole('button', { name: 'Enter United U14' })).toBeEnabled();
    expect(requestEntry).not.toHaveBeenCalled();
});

it('refuses empty and unknown permission reads without turning them into an automatic submission', () => {
    const view = show();
    pick104();
    fixture.squads = [];
    view.update();
    expect(screen.queryByRole('button', { name: /^Enter/ })).not.toBeInTheDocument();
    fixture.squads = undefined;
    view.update();
    expect(screen.queryByRole('button', { name: /^Enter/ })).not.toBeInTheDocument();
    fixture.squads = squads;
    view.update();
    expect(screen.getByRole('button', { name: 'Enter' })).toBeDisabled();
    expect(requestEntry).not.toHaveBeenCalled();
});

it('keeps the genuine untouched age default and retires unsent choices on a tournament change', () => {
    const view = show();
    expect(screen.getByRole('button', { name: 'Enter U14 Boys' })).toBeEnabled();
    pick104();
    view.update(pane(404));
    expect(screen.getByRole('button', { name: 'Enter U14 Boys' })).toBeEnabled();
    view.update(pane());
    expect(screen.getByRole('button', { name: 'Enter U14 Boys' })).toBeEnabled();
    expect(requestEntry).not.toHaveBeenCalled();
});

it('preserves the choice on token refresh but retires it on logout and a fresh login to the same account while unmounted', () => {
    const data = pane(), view = show(data);
    pick104();
    act(() => { fixture.token = 'refreshed-fixture-token'; emitAuth(); });
    view.update();
    expect(screen.getByRole('button', { name: 'Enter U12 Boys' })).toBeEnabled();
    view.unmount();
    act(() => {
        fixture.token = ''; fixture.auth = { status: 'anonymous', sessionId: fixture.session, user: null }; emitAuth();
        login();
    });
    show(data);
    expect(screen.getByRole('button', { name: 'Enter U14 Boys' })).toBeEnabled();
    expect(requestEntry).not.toHaveBeenCalled();
});

it('locks the retired context immediately when storage changes before React auth catches up', () => {
    const view = show();
    pick104();
    act(() => { fixture.session = `fixture-${++fixture.epoch}`; fixture.storedUser = '2'; emitAuth(); });
    view.update();
    const button = screen.getByRole('button', { name: 'Enter U14 Boys' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(requestEntry).not.toHaveBeenCalled();
    fixture.auth = { status: 'authenticated', sessionId: fixture.session, user: { id: 2 } };
    view.update();
    expect(screen.getByRole('button', { name: 'Enter U14 Boys' })).toBeEnabled();
});

it('shares a pending command across views and shows the actual submitted squad after visiting another tournament', async () => {
    const pending = deferred<TournamentDetail>();
    vi.mocked(requestEntry).mockReturnValueOnce(pending.promise);
    const data = pane(), view = show(data);
    pick104(); enter();
    const oldSession = fixture.session;
    expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled();
    view.unmount();
    const next = show(data);
    expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled();
    next.update(pane(404));
    next.update(data);
    expect(screen.getByText('Enters U12 Boys. They are in at once.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sending…' }));
    expect(requestEntry).toHaveBeenCalledExactlyOnceWith(303, { clubId: 1, squadId: 104 }, { _authSessionId: oldSession });
    await act(async () => pending.resolve(pane(303, { entries: [entry(71)] }).detail));
    expect(next.reload).toHaveBeenCalledOnce();
    expect(screen.getByText('Entry sent for U12 Boys.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Enter/ })).not.toBeInTheDocument();
});

it.each(['WITHDRAWN', 'REJECTED'] as const)('requires the exact confirmed entry to resolve before a fresh request (%s)', async status => {
    vi.mocked(requestEntry).mockResolvedValueOnce(pane(303, { entries: [entry(72)] }).detail);
    const view = show();
    pick104();
    await act(async () => enter());
    view.update(pane()); // Older empty GET cannot turn a confirmed command into a new form.
    expect(screen.queryByRole('button', { name: /^Enter/ })).not.toBeInTheDocument();
    view.update(pane(303, { entries: [entry(12, status)] }));
    expect(screen.queryByRole('button', { name: /^Enter/ })).not.toBeInTheDocument();
    view.update(pane(303, { entries: [entry(72, status)] }));
    expect(screen.getByRole('button', { name: 'Enter U14 Boys' })).toBeEnabled();
    expect(requestEntry).toHaveBeenCalledOnce();
});

it('retains an entry observed before this form existed across stale empty reads', () => {
    const view = show(pane(303, { entries: [entry(73)] }));
    expect(screen.getByText('U12 Boys in')).toBeInTheDocument();
    view.update(pane());
    expect(screen.queryByRole('button', { name: /^Enter/ })).not.toBeInTheDocument();
    view.update(pane(303, { entries: [entry(73, 'WITHDRAWN')] }));
    expect(screen.getByRole('button', { name: 'Enter U14 Boys' })).toBeEnabled();
    expect(requestEntry).not.toHaveBeenCalled();
});

it('also remembers a confirmed club entry when a pending invitation owns the action surface', () => {
    const data = pane(303, { entries: [entry(78)] });
    data.invitation = { clubId: 1 } as NonNullable<TournamentPaneData['invitation']>;
    function Observe() {
        useTournamentChoiceBoundary(303);
        const { gate } = useTournamentGate(data);
        return <p>{gate.kind}</p>;
    }
    const observation = render(<Observe />);
    expect(screen.getByText('answer')).toBeInTheDocument();
    observation.unmount();
    show(pane());
    expect(screen.queryByRole('button', { name: /^Enter/ })).not.toBeInTheDocument();
    expect(requestEntry).not.toHaveBeenCalled();
});

it('keeps an ambiguous acknowledgement locked until its new live entry is identified and then resolved', async () => {
    vi.mocked(requestEntry).mockResolvedValueOnce({} as TournamentDetail);
    const view = show(pane(303, { entries: [entry(11, 'WITHDRAWN')] }));
    pick104();
    await act(async () => enter());
    view.update(pane(303, { entries: [entry(13, 'WITHDRAWN')] }));
    expect(screen.queryByRole('button', { name: /^Enter/ })).not.toBeInTheDocument();
    view.update(pane(303, { entries: [entry(74)] }));
    view.update(pane(303, { entries: [entry(74, 'WITHDRAWN')] }));
    expect(screen.getByRole('button', { name: 'Enter U14 Boys' })).toBeEnabled();
    expect(requestEntry).toHaveBeenCalledOnce();
});

it.each(['success', 'failure'] as const)('ignores an old-login %s without replacing the new login choice or pending lock', async outcome => {
    const old = deferred<TournamentDetail>(), current = deferred<TournamentDetail>();
    vi.mocked(requestEntry).mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    const view = show();
    pick104(); enter();
    act(() => login(2));
    view.update();
    expect(screen.getByRole('button', { name: 'Enter U14 Boys' })).toBeEnabled();
    pick104(); enter();
    await act(async () => { if (outcome === 'success') old.resolve(pane(303, { entries: [entry(75)] }).detail); else old.reject(new Error('Old account error')); });
    expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled();
    expect(screen.queryByText(/Old account error|Entry sent/)).not.toBeInTheDocument();
    expect(view.reload).not.toHaveBeenCalled();
    expect(requestEntry).toHaveBeenCalledTimes(2);
    await act(async () => current.resolve(pane(303, { entries: [entry(76)] }).detail));
    expect(view.reload).toHaveBeenCalledOnce();
});

it('keeps an old-tournament completion away from the current choice and blocks duplicate entry on return', async () => {
    const pending = deferred<TournamentDetail>(), next = deferred<TournamentDetail>();
    vi.mocked(requestEntry).mockReturnValueOnce(pending.promise).mockReturnValueOnce(next.promise);
    const view = show();
    pick104(); enter();
    view.update(pane(404));
    pick104();
    enter();
    await act(async () => pending.resolve(pane(303, { entries: [entry(77)] }).detail));
    expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled();
    expect(screen.queryByText('Entry sent for U12 Boys.')).not.toBeInTheDocument();
    expect(view.reload).not.toHaveBeenCalled();
    view.update(pane());
    expect(screen.queryByRole('button', { name: /^Enter/ })).not.toBeInTheDocument();
    expect(requestEntry).toHaveBeenCalledTimes(2);
    view.update(pane(404));
    expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled();
    await act(async () => next.resolve(pane(404, { entries: [entry(79)] }).detail));
    expect(view.reload).toHaveBeenCalledOnce();
});

it('retains the choice after an ordinary failure and requires a fresh read after a 409', async () => {
    const conflict = { isAxiosError: true, response: { status: 409 } };
    vi.mocked(requestEntry).mockRejectedValueOnce(new Error('Offline')).mockRejectedValueOnce(conflict);
    const view = show();
    pick104();
    await act(async () => enter());
    expect(screen.getByRole('button', { name: 'Enter U12 Boys' })).toBeEnabled();
    await act(async () => enter());
    expect(screen.getByRole('button', { name: 'Enter U12 Boys' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(view.reload).toHaveBeenCalledOnce();
    expect(requestEntry).toHaveBeenCalledTimes(2);
    view.update(pane());
    expect(screen.getByRole('button', { name: 'Enter U12 Boys' })).toBeEnabled();
    expect(requestEntry).toHaveBeenCalledTimes(2);
});

it('rechecks the registration deadline when the displayed Enter button is pressed', () => {
    const view = show();
    pick104();
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2100-01-01T00:00:00Z'));
    enter();
    expect(requestEntry).not.toHaveBeenCalled();
    view.update(pane(303, { registrationPolicy: 'INVITE_ONLY' }));
    expect(screen.queryByRole('button', { name: /^Enter/ })).not.toBeInTheDocument();
});
