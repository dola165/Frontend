import '../../../i18n';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../../api/axiosConfig';
import { refreshAccess } from '../../../hooks/useCan';
import { ActionButton } from '../ActionButton';
import { ActionHost } from '../ActionHost';
import { ActionMenu } from '../ActionMenu';
import { FollowButton } from '../FollowButton';
import { NeedsResultCard } from '../NeedsResultCard';
import { SquadDoors } from '../SquadDoors';
import { joinTarget } from '../flows/joinTarget';
import { actionHref, withoutAction } from '../registry';
import { refreshResultsWaiting } from '../useResultsWaiting';

const auth = vi.hoisted(() => ({ status: 'authenticated', sessionId: 'f5', user: { id: 1, dob: '1985-04-02', navigationCapabilities: undefined as unknown } as { id: number; dob: string; navigationCapabilities: unknown } | null }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../../api/axiosConfig', () => ({ DEPLOYMENT_URLS: { mediaBaseUrl: '' }, apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
/** Arranging falls back to the squads the person may arrange for; the rule-checker answers first in these tests. */
vi.mock('../../world/compose/useArrangeableSquads', () => ({ useArrangeableSquads: () => [] }));

/** What the server answers: the rule-checker for the person, a club and a squad, and the scores still owed. */
const server = vi.hoisted(() => ({ me: null as null | { allowed: string[]; refused: object[] }, squads: {} as Record<number, { allowed: string[]; refused: object[] }>, waiting: [] as object[] }));
const refusal = (action: string, reason: string, message: string) => ({ action, allowed: false, reason, message, because: null });
const owed = { kind: 'MATCH_EXCHANGE', id: 5820, title: 'U18 friendly', startsAt: new Date(Date.now() - 2 * 86_400_000).toISOString(), squadId: 107, squadName: 'U18 Boys', opponentName: 'Didube Stars' };

function Where() {
    const location = useLocation();
    const navigate = useNavigate();
    return <><output data-testid="where">{location.pathname}{location.search}</output><button type="button" onClick={() => navigate(-1)}>Browser back</button></>;
}
const show = (node: React.ReactNode, at = '/home') => render(<MemoryRouter initialEntries={[at]}><Routes><Route path="*" element={<>{node}<ActionHost /><Where /></>} /></Routes></MemoryRouter>);
const where = () => screen.getByTestId('where').textContent;

beforeEach(() => {
    localStorage.setItem('gk-session-id', 'f5');
    server.me = { allowed: ['add_child', 'join_squad', 'follow', 'arrange_match', 'report_score'], refused: [refusal('start_club', 'STAFF_OF_ANOTHER_CLUB', 'One club at a time.')] };
    server.squads = {};
    server.waiting = [];
    auth.status = 'authenticated';
    auth.user = { id: 1, dob: '1985-04-02', navigationCapabilities: undefined };
    vi.mocked(apiClient.get).mockClear();
    vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
        if (url === '/access/me') return server.me ? { data: server.me } : Promise.reject({ isAxiosError: true, response: { status: 404 } });
        const squad = url.match(/^\/access\/squads\/(\d+)$/);
        if (squad) return { data: server.squads[Number(squad[1])] ?? { allowed: [], refused: [] } };
        if (url.startsWith('/access/clubs/')) return { data: { allowed: ['follow'], refused: [] } };
        if (url === '/me/results-waiting') return { data: server.waiting };
        if (url.startsWith('/clubs/')) return { data: { logoUrl: null, isFollowedByMe: false } };
        return { data: null };
    });
    refreshAccess();
    refreshResultsWaiting();
});
afterEach(cleanup);

describe('the registry', () => {
    it('opens a flow over the page with its likely answers, and closing drops only its own keys', () => {
        const href = actionHref({ pathname: '/squads/105', search: '?tab=players' }, 'invite_staff', { kind: 'squad', id: 105, clubId: 1 });
        expect(href).toBe('/squads/105?tab=players&do=invite_staff&do-club=1&do-squad=105&do-job=ASSISTANT_COACH');
        expect(withoutAction('?tab=players&do=invite_staff&do-club=1&do-squad=105')).toBe('?tab=players');
        expect(actionHref({ pathname: '/home', search: '' }, 'follow')).toBeNull();
    });

    it('decides allowed and refused from the rule-checker’s answer', async () => {
        show(<><ActionButton action="add_child" /><ActionButton action="start_club" /></>);
        expect(await screen.findByRole('link', { name: 'Add my child' })).toHaveAttribute('href', '/home?do=add_child');
        // Refused by the checker: never shown, even though the old age flag would have allowed it.
        await waitFor(() => expect(screen.getByRole('link', { name: 'Add my child' })).not.toHaveAttribute('aria-disabled'));
        expect(screen.queryByRole('link', { name: 'Start a club' })).not.toBeInTheDocument();
    });

    it('keeps the screen’s old flag when the server has no checker yet', async () => {
        server.me = null;
        show(<><ActionButton action="add_child" /><ActionButton action="start_club" /><ActionButton action="invite_staff" /></>);
        expect(await screen.findByRole('link', { name: 'Start a club' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Add my child' })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Invite staff' })).not.toBeInTheDocument();
    });
});

describe('ActionHost', () => {
    it('opens a flow from the address and closes it back to the page', async () => {
        show(null, '/parent?tab=overview&do=join_squad&do-player=7');
        const dialog = await screen.findByRole('dialog', { name: 'Join with a code' });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
        await waitFor(() => expect(where()).toBe('/parent?tab=overview'));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('opens the coach’s link it was given, carrying the child from Parent Hub', async () => {
        show(null, '/parent?do=join_squad&do-player=7');
        fireEvent.change(await screen.findByLabelText('The coach’s link or code'), { target: { value: 'https://app.grasskickz.com/join/abcdEFGH_12?utm=wa' } });
        fireEvent.click(screen.getByRole('button', { name: 'Open' }));
        await waitFor(() => expect(where()).toBe('/join/abcdEFGH_12?who=child&player=7'));
    });

    it('says why when the person may not, instead of opening the flow', async () => {
        server.me = { allowed: [], refused: [refusal('add_child', 'ADULTS_ONLY', 'Only a parent or guardian who is 18 or older can add a child.')] };
        show(null, '/home?do=add_child');
        expect(await screen.findByText('Only a parent or guardian who is 18 or older can add a child.')).toBeInTheDocument();
    });

    it('ignores an address that names no action, such as an object’s own keys', async () => {
        for (const key of ['constructor', 'toString', 'hasOwnProperty', '__proto__']) {
            const view = show(<p>Page</p>, `/home?do=${key}`);
            expect(await screen.findByText('Page')).toBeInTheDocument();
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            view.unmount();
        }
    });

    it('never comes back on Back: closing returns to the page, and a finished flow replaces its own address', async () => {
        show(<ActionButton action="join_squad" />);
        fireEvent.click(await screen.findByRole('link', { name: 'Join with a code' }));
        fireEvent.click(within(await screen.findByRole('dialog', { name: 'Join with a code' })).getByRole('button', { name: 'Close' }));
        await waitFor(() => expect(where()).toBe('/home'));
        fireEvent.click(screen.getByRole('link', { name: 'Join with a code' }));
        fireEvent.change(await screen.findByLabelText('The coach’s link or code'), { target: { value: 'k7Gm2xPq' } });
        fireEvent.click(screen.getByRole('button', { name: 'Open' }));
        await waitFor(() => expect(where()).toBe('/join/k7Gm2xPq'));
        fireEvent.click(screen.getByRole('button', { name: 'Browser back' }));
        await waitFor(() => expect(where()).toBe('/home'));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('keeps a form the person is typing in when a refusal arrives late', async () => {
        let answer: (value: unknown) => void = () => undefined;
        vi.mocked(apiClient.get).mockImplementation((url: string) => url === '/access/me' ? new Promise(resolve => { answer = resolve; }) : Promise.resolve({ data: [] }));
        show(null, '/home?do=join_squad');
        fireEvent.input(await screen.findByLabelText('The coach’s link or code'), { target: { value: 'k7Gm' } });
        answer({ data: { allowed: [], refused: [refusal('join_squad', 'ACCOUNT_SETUP_NEEDED', 'Finish setting up your account.')] } });
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(screen.getByLabelText('The coach’s link or code')).toHaveValue('k7Gm');
    });

    it('sends someone signed out to sign in and back', async () => {
        auth.status = 'anonymous';
        show(null, '/home?do=add_child');
        await waitFor(() => expect(where()).toMatch(/^\/login\?next=/));
    });
});

describe('the header "+"', () => {
    it('lists only what the person may do, a waiting score first', async () => {
        server.waiting = [owed];
        server.squads[107] = { allowed: ['report_score'], refused: [] };
        show(<ActionMenu />);
        fireEvent.click(await screen.findByRole('button', { name: 'Start something, a score is waiting' }));
        await screen.findByRole('menuitem', { name: /Report a score/ });
        const items = (await screen.findAllByRole('menuitem')).map(item => item.textContent);
        expect(items[0]).toMatch(/^Report a scoreU18 Boys v Didube Stars/);
        expect(items).toEqual(expect.arrayContaining([expect.stringMatching(/^Arrange a match/), expect.stringMatching(/^Add my child/), expect.stringMatching(/^Join with a code/)]));
        expect(items.some(item => item?.startsWith('Start a club'))).toBe(false);
        expect(screen.getByRole('menuitem', { name: /Report a score/ })).toHaveAttribute('href', '/home?do=report_score&do-source=MATCH_EXCHANGE&do-event=5820');
    });

    it('offers no score when none is owed, and hides itself when nothing is allowed', async () => {
        const view = show(<ActionMenu />);
        fireEvent.click(await screen.findByRole('button', { name: 'Start something' }));
        expect(screen.queryByRole('menuitem', { name: /Report a score/ })).not.toBeInTheDocument();
        view.unmount();
        server.me = { allowed: [], refused: [] };
        refreshAccess();
        show(<ActionMenu />);
        await waitFor(() => expect(screen.queryByRole('button', { name: /Start something/ })).not.toBeInTheDocument());
    });
});

describe('asking the rule-checker', () => {
    it('asks about following once for the person, never per club', async () => {
        show(<>{[4, 5, 6].map(id => <FollowButton key={id} subject={{ kind: 'club', id }} following={false} onChange={() => undefined} />)}</>);
        await waitFor(() => expect(screen.getAllByRole('button', { name: 'Follow' })[0]).not.toBeDisabled());
        const asked = vi.mocked(apiClient.get).mock.calls.map(([url]) => url);
        expect(asked.filter(url => url.startsWith('/access/clubs/'))).toEqual([]);
        expect(asked.filter(url => url === '/access/me')).toHaveLength(1);
    });

    it('asks nothing while signed out', async () => {
        auth.status = 'anonymous';
        auth.user = null;
        show(<><FollowButton subject={{ kind: 'club', id: 4 }} following={false} onChange={() => undefined} /><ActionButton action="arrange_match" subject={{ kind: 'squad', id: 105 }} /></>);
        expect(await screen.findByRole('link', { name: /Follow/ })).toHaveAttribute('href', expect.stringMatching(/^\/login/));
        expect(vi.mocked(apiClient.get).mock.calls.filter(([url]) => url.startsWith('/access/'))).toEqual([]);
    });
});

describe('the doors', () => {
    it('Home asks for the newest score owed, with one action', async () => {
        server.waiting = [owed, { ...owed, id: 5821 }];
        server.squads[107] = { allowed: ['report_score'], refused: [] };
        show(<NeedsResultCard />);
        expect(await screen.findByText('U18 Boys v Didube Stars')).toBeInTheDocument();
        expect(screen.getByText('1 more', { exact: false })).toBeInTheDocument();
        expect(await screen.findByRole('link', { name: 'Add the score' })).toHaveAttribute('href', '/home?do=report_score&do-source=MATCH_EXCHANGE&do-event=5820');
    });

    it('a squad page offers what this squad allows: its score, a match, staff, and following the club', async () => {
        server.waiting = [owed];
        server.squads[107] = { allowed: ['arrange_match', 'report_score', 'invite_staff', 'follow'], refused: [refusal('suggest_assistant', 'ONLY_HEAD_COACHES', 'Only a head coach.'), refusal('join_squad', 'ALREADY_IN_SQUAD', 'Already in.')] };
        show(<SquadDoors squadId={107} clubId={1} clubName="FC Dinamo Tbilisi Academy" />, '/squads/107');
        expect(await screen.findByRole('link', { name: 'Arrange a match' })).toHaveAttribute('href', '/squads/107?do=arrange_match&do-squad=107');
        expect(await screen.findByRole('link', { name: 'Invite staff' })).toHaveAttribute('href', '/squads/107?do=invite_staff&do-club=1&do-squad=107&do-job=ASSISTANT_COACH');
        expect(screen.getByRole('link', { name: 'Score v Didube Stars' })).toBeInTheDocument();
        expect(await screen.findByRole('button', { name: 'Follow FC Dinamo Tbilisi Academy' })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Suggest an assistant' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Join' })).not.toBeInTheDocument();
    });

    it('a squad page offers its own club’s people neither Join nor Follow', async () => {
        auth.user = { id: 1, dob: '1985-04-02', navigationCapabilities: { workspaces: [{ id: 'club.workspace', context: { type: 'club', id: 1, label: 'FC Dinamo Tbilisi Academy' } }] } };
        server.squads[107] = { allowed: ['arrange_match', 'join_squad', 'follow'], refused: [] };
        show(<SquadDoors squadId={107} clubId={1} clubName="FC Dinamo Tbilisi Academy" />, '/squads/107');
        expect(await screen.findByRole('link', { name: 'Arrange a match' })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Join' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Follow/ })).not.toBeInTheDocument();
    });
});

it('reads a coach’s link or code, and nothing else', () => {
    expect(joinTarget(' https://app.grasskickz.com/join/k7Gm2xPq ')).toBe('/join/k7Gm2xPq');
    expect(joinTarget('grasskickz.com/staff-invite/AbCd1234')).toBe('/staff-invite/AbCd1234');
    expect(joinTarget('k7Gm2xPq')).toBe('/join/k7Gm2xPq');
    expect(joinTarget('hello there')).toBeNull();
});
