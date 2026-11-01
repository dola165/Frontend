import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JoiningChild } from '../../joining-contract/types';
import type * as squadApi from '../../squadCommunication/api';
import type { SquadCalendarEvent } from '../../squadCommunication/useSquadSchedule';
import type { AuthSessionId } from '../../../utils/authStorage';

/** Step 5, fix round 1 (Codex's review): Parent Hub's findings, each failing without its fix. */
const state = vi.hoisted(() => ({
    events: [] as unknown[], pending: new Map<number, unknown>(), retry: vi.fn(), squads: new Map<number, unknown[]>(), familyError: '', failedSquads: [] as string[], familyRetry: vi.fn(),
    schedule: vi.fn(), childSquads: [] as unknown[],
}));
vi.mock('../../squadCommunication/journeyCopy', () => ({ useJourneyCopy: () => ((en: string) => en) }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../../squadCommunication/api', () => ({ messages: vi.fn(), acknowledge: vi.fn(), spaces: vi.fn(), overview: vi.fn(), sessions: vi.fn() }));
vi.mock('../../squadCommunication/useSquadSchedule', async original => ({ ...await original<object>(), useSquadSchedule: () => ({ events: state.events, loading: false, error: '' }), loadSquadEvents: vi.fn() }));
vi.mock('../../squadCommunication/useSessionReply', () => ({ useSessionReply: () => ({ pending: state.pending, retry: state.retry, reply: vi.fn(), busy: false, error: '', saved: false }) }));
vi.mock('../hub/useChildSquads', () => ({
    useFamilySquads: () => ({ squads: state.squads, loading: false, error: state.familyError, failedSquads: state.failedSquads, retry: state.familyRetry }),
    useChildSquads: () => ({ squads: state.childSquads, loading: false, error: '', failedSquads: [], retry: vi.fn() }),
}));
vi.mock('../FamilySchedule', () => ({ FamilySchedule: (props: { extraEvents?: SquadCalendarEvent[] }) => { state.schedule(props); return <p>Calendar with {props.extraEvents?.length ?? 0} visits</p>; } }));
vi.mock('../hub/ChildChats', () => ({ ChildChats: () => null }));
vi.mock('../../joining-contract/api', async original => ({ ...await original<object>(), fetchJoiningChildren: vi.fn() }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 7, navigationCapabilities: { workspaces: [{ id: 'parent.hub' }] } }, sessionId: 'parent-session' }) }));

import { apiClient } from '../../../api/axiosConfig';
import * as api from '../../squadCommunication/api';
import { fetchJoiningChildren } from '../../joining-contract/api';
import { loadSquadEvents } from '../../squadCommunication/useSquadSchedule';
import { ThisWeek } from '../hub/ThisWeek';
import { CoachUpdates } from '../hub/CoachUpdates';
import { FamilyWeek } from '../hub/FamilyWeek';
import { ChildPage } from '../hub/ChildPage';
import { useFamilySchedule } from '../hub/useFamilySchedule';
import { useViewerFamily } from '../../squadCommunication/page/useViewerChildren';

const child = (over: Partial<JoiningChild> = {}): JoiningChild => ({ playerId: 61, identity: { playerId: 61, version: 1, fullName: 'Saba Beridze', dateOfBirth: '2014-05-02', gender: 'MALE', photoUrl: null,
    positions: [], dominantFoot: null, heightCm: null, weightKg: null, canEdit: true, minor: true }, clubs: [], cases: [], inquiries: [], ...over });
const dinamo = { clubId: 1, clubName: 'Dinamo', cardId: 501, affiliationStatus: 'ACTIVE', consentStatus: 'CONFIRMED', squadNames: ['U12 Boys'] };
const squad = { id: 160, club_id: 1, name: 'U12 Boys', academy_name: 'Dinamo', category: 'U12', can_manage: false, unread_count: 0, viewer_id: 7, member_count: 1, notify_chat: true, head_coach_id: null,
    can_assign_coach: false, available_coaches: [], players: [{ id: 61, name: 'Saba Beridze' }], coaches: [], threads: [] } as unknown as squadApi.SquadOverview;
const soon = (hours: number) => new Date(Date.now() + hours * 3600000).toISOString();
const visit = { id: 77, organizationId: 4, organizationName: 'Dinamo', groupName: 'U12 Boys', playerId: 61, stage: 'INTRODUCTION_ASSESSMENT', enrollment: null,
    sessions: [{ id: 5, status: 'CONFIRMED', startsAt: soon(30), endsAt: soon(31.5), location: { name: 'Rustavi ground', latitude: null, longitude: null } }] } as unknown as JoiningChild['cases'][number];
const show = (node: React.ReactNode, path = '/parent?player=61') => render(<MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>);

beforeEach(() => { state.events = []; state.pending = new Map(); state.squads = new Map(); state.familyError = ''; state.failedSquads = []; state.childSquads = []; });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('the next one, large', () => {
    const fixture = (): SquadCalendarEvent => ({ id: 'match:900', eventId: 900, origin: 'MATCH_EXCHANGE', title: 'Dinamo – Rustavi', eventType: 'MATCH', startsAt: soon(26), endsAt: soon(27.5),
        locationText: 'Rustavi ground', status: 'SCHEDULED', visibility: 'CLUB_ONLY', publicationState: 'PRIVATE', recurring: false, hostSquadId: 160, hostSquadName: 'U12 Boys', squadId: 160,
        matchRevision: 4, ownerLabel: 'U12 Boys', mapEligible: false, appearsOnMap: false, conflictingEventIds: [] }) as unknown as SquadCalendarEvent;
    const team = (selected: boolean) => [{ squadId: 160, squadName: 'U12 Boys', canManage: false, players: [{ id: 61, name: 'Saba Beridze', selected, response: 'UNANSWERED', revision: 2, canRespond: true }] }];

    it('S6: a connected fixture the child was called up for has “Can’t come”, sent with the call-up’s and the match’s revisions', async () => {
        state.events = [fixture()];
        vi.mocked(apiClient.get).mockResolvedValue({ data: team(true) });
        vi.mocked(apiClient.post).mockResolvedValue({ data: null });
        show(<ThisWeek squads={[squad]} child={child({ clubs: [dinamo] })} />);
        const card = await screen.findByRole('article', { name: 'Next up' });
        expect(apiClient.get).toHaveBeenCalledWith('/match-arrangements/900/participants', expect.anything());
        fireEvent.click(await within(card).findByRole('button', { name: 'Can’t come' }));
        await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/match-arrangements/900/squads/160/attendance', { playerId: 61, response: 'NOT_GOING', revision: 2, matchRevision: 4 }));
        // A call-up has no reason to add.
        expect(within(card).queryByLabelText(/Reason for the coach/)).not.toBeInTheDocument();
    });

    it('S6: no reply where the child was not called up', async () => {
        state.events = [fixture()];
        vi.mocked(apiClient.get).mockResolvedValue({ data: team(false) });
        show(<ThisWeek squads={[squad]} child={child({ clubs: [dinamo] })} />);
        const card = await screen.findByRole('article', { name: 'Next up' });
        await waitFor(() => expect(apiClient.get).toHaveBeenCalled());
        expect(within(card).queryByRole('button', { name: 'Can’t come' })).not.toBeInTheDocument();
    });

    it.each([new Error('offline'), { response: { status: 503 } }])('S6: retries a failed participant lookup and recovers Can’t come in place (%j)', async failure => {
        state.events = [fixture()];
        vi.mocked(apiClient.get).mockRejectedValueOnce(failure).mockResolvedValue({ data: team(true) });
        vi.mocked(apiClient.post).mockResolvedValue({ data: null });
        show(<ThisWeek squads={[squad]} child={child({ clubs: [dinamo] })} />);
        const card = await screen.findByRole('article', { name: 'Next up' });
        expect(await within(card).findByText('Couldn’t load the call-up')).toBeInTheDocument();
        expect(within(card).queryByRole('button', { name: 'Can’t come' })).not.toBeInTheDocument();
        fireEvent.click(within(card).getByRole('button', { name: 'Try again' }));
        fireEvent.click(await within(card).findByRole('button', { name: 'Can’t come' }));
        await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/match-arrangements/900/squads/160/attendance', { playerId: 61, response: 'NOT_GOING', revision: 2, matchRevision: 4 }));
        expect(within(card).queryByText('Couldn’t load the call-up')).not.toBeInTheDocument();
    });

    it.each([403, 404])('S6: keeps an intentional %i participant refusal quiet', async status => {
        state.events = [fixture()];
        vi.mocked(apiClient.get).mockRejectedValue({ response: { status } });
        show(<ThisWeek squads={[squad]} child={child({ clubs: [dinamo] })} />);
        await waitFor(() => expect(apiClient.get).toHaveBeenCalled());
        expect(screen.queryByText('Couldn’t load the call-up')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Can’t come' })).not.toBeInTheDocument();
    });

    it('S12: an answer that may not have been saved is offered again on the card', async () => {
        const session = { id: 55, title: 'Training', starts_at: soon(3), ends_at: soon(4.5), location: null, status: 'SCHEDULED', revision: 3, attendance: [{ id: 61, name: 'Saba Beridze', response: 'UNANSWERED' }] };
        state.events = [{ ...fixture(), id: 'squad:160:55', origin: 'SQUAD_SESSION', eventType: 'TRAINING', title: 'Training', startsAt: session.starts_at, endsAt: session.ends_at, session }];
        state.pending = new Map([[61, { requestId: 'r-1' }]]);
        show(<ThisWeek squads={[squad]} child={child({ clubs: [dinamo] })} />);
        const card = await screen.findByRole('article', { name: 'Next up' });
        expect(within(card).getByText(/An earlier answer may not have been saved/)).toBeInTheDocument();
        fireEvent.click(within(card).getByRole('button', { name: 'Send it again' }));
        expect(state.retry).toHaveBeenCalledWith(61);
    });
});

describe('from the coaches', () => {
    const long = 'Bring the white kit, shin pads and a packed lunch. We leave from the academy gate at 08:15 sharp; the bus returns by 18:00. Parents who drive, please message me by Thursday.';
    const update = (over: Partial<squadApi.SquadMessage> = {}) => ({ id: 12, author_id: 3, author_name: 'Koba Gelashvili', thread_user_id: null, kind: 'ANNOUNCEMENT', title: 'Saturday trip', body: long,
        important: false, created_at: soon(-2), acknowledgement_requested: true, acknowledged_at: null, ...over }) as squadApi.SquadMessage;
    let restore: () => void;
    beforeEach(() => {
        // Layout: a clamped body is taller than the three lines it shows.
        const scroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight'), client = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
        Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get() { return (this as HTMLElement).classList.contains('ph-update__body') ? 120 : 0; } });
        Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get() { return (this as HTMLElement).classList.contains('ph-update__body') && !(this as HTMLElement).dataset.open ? 60 : 120; } });
        const put = (name: string, value?: PropertyDescriptor) => { if (value) Object.defineProperty(HTMLElement.prototype, name, value); else Reflect.deleteProperty(HTMLElement.prototype, name); };
        restore = () => { put('scrollHeight', scroll); put('clientHeight', client); };
        vi.mocked(api.messages).mockResolvedValue([update()]);
    });
    afterEach(() => restore());

    it('S18: a long update can be read in full before “I’ve read it”, and All updates is there for one update', async () => {
        show(<CoachUpdates squads={[squad]} child={child({ clubs: [dinamo] })} />);
        const more = await screen.findByRole('button', { name: 'Read more' });
        expect(more).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(more);
        expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByText(/Parents who drive/).closest('.ph-update__body')).toHaveAttribute('data-open');
        expect(screen.getByRole('link', { name: 'All updates ›' })).toHaveAttribute('href', '/parent?player=61&view=updates');
    });

    it('S18: the full list shows every update whole and opens on the one an old link named', async () => {
        const scrolled = vi.fn();
        Element.prototype.scrollIntoView = scrolled;
        show(<CoachUpdates squads={[squad]} child={child({ clubs: [dinamo] })} all />, '/parent?player=61&view=updates#squad-update-12');
        const body = (await screen.findByText(/Parents who drive/)).closest('.ph-update__body');
        expect(body).toHaveAttribute('data-open');
        expect(screen.queryByRole('button', { name: 'Read more' })).not.toBeInTheDocument();
        await waitFor(() => expect(scrolled).toHaveBeenCalled());
        expect(document.getElementById('squad-update-12')).not.toBeNull();
    });
});

describe('everyone’s week and a child’s calendar', () => {
    it('S3: squads that failed to load are named with Try again, never “Nothing planned yet”', async () => {
        state.familyError = 'The squads could not load.'; state.failedSquads = ['U12 Boys'];
        show(<FamilyWeek children={[child({ clubs: [dinamo] }), child({ playerId: 62, clubs: [dinamo] })]} sessionId={'parent-session' as AuthSessionId} revision={0} />, '/parent');
        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('Some squads couldn’t load: U12 Boys');
        fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
        expect(state.familyRetry).toHaveBeenCalled();
        expect(screen.queryByText(/Nothing planned yet/)).not.toBeInTheDocument();
    });

    it('S3: a child whose match listings partly failed is named in the calendar’s error', async () => {
        vi.mocked(loadSquadEvents).mockResolvedValue({ events: [], error: 'Squad sessions are available, but some match and event listings could not load. Try again.' });
        const { result } = renderHook(() => useFamilySchedule([{ playerId: 61, name: 'Saba', squads: [{ id: 160, name: 'U12 Boys' }] }], '2026-11-01', '2026-11-08'));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toBe('Saba: Squad sessions are available, but some match and event listings could not load. Try again.');
    });

    it('S4: the child’s calendar holds their first visits, also before they have a club', async () => {
        state.childSquads = [squad];
        show(<ChildPage child={child({ clubs: [dinamo], cases: [visit] })} sessionId={'parent-session' as AuthSessionId} revision={0} onChanged={vi.fn()} />, '/parent?player=61&view=calendar');
        expect(await screen.findByText('Calendar with 1 visits')).toBeInTheDocument();
        expect(state.schedule).toHaveBeenLastCalledWith(expect.objectContaining({ extraEvents: [expect.objectContaining({ id: 'visit:5', title: 'First visit', hostSquadName: 'Boys' })] }));
        cleanup();
        state.childSquads = [];
        show(<ChildPage child={child({ cases: [visit] })} sessionId={'parent-session' as AuthSessionId} revision={0} onChanged={vi.fn()} />, '/parent?player=61&view=calendar');
        expect(await screen.findByText('Calendar with 1 visits')).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Saba has no club yet' })).not.toBeInTheDocument();
    });
});

describe('a parent opening a squad page', () => {
    it('S17: a failed family lookup is not “no children”: it says so and asks again', async () => {
        vi.mocked(fetchJoiningChildren).mockRejectedValueOnce(Object.assign(new Error('Service unavailable'), { response: { status: 503 } })).mockResolvedValue({ children: [child({ clubs: [dinamo] })] });
        const { result } = renderHook(() => useViewerFamily(squad));
        await waitFor(() => expect(result.current.error).not.toBe(''));
        expect(result.current).toMatchObject({ known: false, children: [] });
        act(() => result.current.retry());
        await waitFor(() => expect(result.current.known).toBe(true));
        expect(result.current.children.map(item => item.playerId)).toEqual([61]);
        expect(result.current.error).toBe('');
    });
});
