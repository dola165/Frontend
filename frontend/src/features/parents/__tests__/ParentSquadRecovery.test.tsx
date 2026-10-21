import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import i18n from '../../../i18n';
import { ParentHubPage } from '../../../pages/ParentHubPage';
import { fetchJoiningChildren } from '../api';
import type { ChildClub, ChildDirectory, JoiningChild } from '../../joining-contract/types';
import * as api from '../../squadCommunication/api';
import { apiClient } from '../../../api/axiosConfig';

const auth = vi.hoisted(() => ({ user: { id: 7 }, sessionId: 'f06-parent', isAuthenticated: true }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../../utils/authStorage', async original => ({ ...await original<object>(), getAuthSessionId: () => auth.sessionId, getStoredUserId: () => String(auth.user.id), isCurrentAuthSession: (id: string) => id === auth.sessionId }));
vi.mock('../api', () => ({ fetchJoiningChildren: vi.fn() }));
vi.mock('../../squadCommunication/api', () => ({ spaces: vi.fn(), overview: vi.fn(), sessions: vi.fn(), messages: vi.fn(), attendance: vi.fn(), editSession: vi.fn(), createSession: vi.fn(), cancelSession: vi.fn() }));
vi.mock('../../schedule/api', () => ({ fetchClubSchedule: vi.fn().mockResolvedValue([]) }));
vi.mock('../../mapPlanning/journeyScheduleData', async original => ({ ...await original<object>(), useJourneyEntries: () => ({ entries: [], error: '', loading: false }) }));
vi.mock('../../squadCommunication/useClubCrest', () => ({ useClubCrest: () => null }));
vi.mock('../FamilyRelationships', () => ({ FamilyRelationships: () => null }));
vi.mock('../AddChild', () => ({ AddChild: () => null }));
vi.mock('../PlayerLinkCode', () => ({ PlayerLinkCode: () => null }));
vi.mock('../../players/PlayerIdentityEditor', () => ({ PlayerIdentityEditor: () => null }));

const club = (id: number): ChildClub => ({ clubId: id, clubName: 'Fixture club ' + id, cardId: 500 + id, affiliationStatus: 'ACTIVE', consentStatus: 'CONFIRMED', squadNames: [] });
const child = (id: number, name: string, clubs = [club(1)]) => ({ playerId: id, identity: { playerId: id, version: 1, fullName: name, dateOfBirth: '2015-01-01', gender: null, photoUrl: null, positions: [], dominantFoot: null, heightCm: null, weightKg: null, canEdit: false, minor: true }, clubs, cases: [], inquiries: [], guardians: [] }) as JoiningChild;
const directory = (): ChildDirectory => ({ children: [child(61, 'Nika', [club(1), club(2)]), child(62, 'Saba')] });
const rows: api.SquadSpace[] = [{ id: 10, club_id: 1, name: 'Fixture A', academy_name: 'Fixture club 1', category: 'U12', can_manage: true, unread_count: 0 }, { id: 20, club_id: 2, name: 'Fixture B', academy_name: 'Fixture club 2', category: 'U12', can_manage: true, unread_count: 0 }];
const overview = (id: number, players = [61, 62]): api.SquadOverview => ({ ...rows.find(row => row.id === id)!, can_manage: true, viewer_id: auth.user.id, member_count: players.length, notify_chat: true, head_coach_id: null, can_assign_coach: false, available_coaches: [], players: players.map(id => ({ id, name: id === 61 ? 'Nika' : id === 62 ? 'Saba' : 'Own child' })), coaches: [], threads: [] });
const session = (squad: number): api.SquadSession => ({ id: squad === 10 ? 101 : 201, title: 'Fixture training ' + (squad === 10 ? 'A' : 'B'), starts_at: squad === 10 ? '2026-10-19T12:00:23.123Z' : '2026-10-20T12:00:23.123Z', ends_at: squad === 10 ? '2026-10-19T13:30:45.987Z' : '2026-10-20T13:30:45.987Z', location: 'Fixture ground', status: 'SCHEDULED', cancellation_reason: null, revision: 2, response_requested: false, attendance: [61, 62, 63].map(id => ({ id, name: id === 61 ? 'Nika' : id === 62 ? 'Saba' : 'Own child', active: true, response: 'UNANSWERED' })) });
const page = () => <MemoryRouter initialEntries={['/parent?player=61']}><ParentHubPage /></MemoryRouter>;
const show = () => render(page());
const nextLink = () => screen.getByRole('link', { name: /Fixture training A/ });
const href = (player: number) => '/squads/10?tab=schedule&session=101&at=2026-10-19T12%3A00%3A23.123Z&player=' + player;
function deferred<T>() { let finish!: (value: T) => void; return { promise: new Promise<T>(resolve => { finish = resolve; }), resolve: (value: T) => finish(value) }; }

beforeEach(async () => {
    vi.clearAllMocks(); sessionStorage.clear(); auth.user = { id: 7 }; auth.sessionId = 'f06-parent';
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-17T06:00:00Z'));
    await i18n.changeLanguage('en');
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    vi.mocked(fetchJoiningChildren).mockResolvedValue(directory());
    vi.mocked(api.spaces).mockReset().mockResolvedValue(rows);
    vi.mocked(api.overview).mockReset().mockImplementation(async id => overview(id));
    vi.mocked(api.sessions).mockImplementation(async id => [session(id)]);
    vi.mocked(api.messages).mockResolvedValue([]);
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: [] });
});
afterEach(() => {
    cleanup(); vi.useRealTimers(); vi.restoreAllMocks();
    for (const method of [api.attendance, api.editSession, api.createSession, api.cancelSession]) expect(method).not.toHaveBeenCalled();
});

it('loads a confirmed training enrolment without requiring a competitive club affiliation, keeping the actual child roster boundary', async () => {
    vi.mocked(fetchJoiningChildren).mockResolvedValue({ children: [child(61, 'Nika', [{ ...club(1), cardId: null, affiliationStatus: 'ENROLLED' }])] });
    vi.mocked(api.spaces).mockResolvedValue([rows[0], { ...rows[0], id: 11, name: 'Sibling only' }]);
    vi.mocked(api.overview).mockImplementation(async id => id === 10 ? overview(10, [61]) : { ...overview(10, [62]), id: 11, name: 'Sibling only' });
    show();
    expect(await screen.findByRole('link', { name: /Fixture training A/ })).toHaveAttribute('href', href(61));
    expect(screen.queryByRole('link', { name: /Sibling only/ })).not.toBeInTheDocument();
    expect(screen.getByText('Not recorded')).toBeVisible();
});

it('does not turn an unaccepted enquiry into squad or schedule access', async () => {
    vi.mocked(fetchJoiningChildren).mockResolvedValue({ children: [child(61, 'Nika', [{ ...club(1), affiliationStatus: 'APPLICANT' }])] });
    show(); await screen.findByRole('button', { name: /Nika,/ });
    expect(api.spaces).not.toHaveBeenCalled(); expect(api.sessions).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: /Fixture training A/ })).not.toBeInTheDocument();
});

it('shows a failed child squad read and retries only reads while preserving the exact session/child destination', async () => {
    vi.mocked(api.spaces).mockRejectedValueOnce(new Error('Fixture read failure'));
    show();
    expect(await screen.findByRole('alert')).toHaveTextContent('The squads could not load.');
    expect(screen.queryByText('No squads are listed for Nika yet.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry squads' }));
    expect(await screen.findByRole('link', { name: /Fixture training A/ })).toHaveAttribute('href', href(61));
    expect(nextLink()).toHaveTextContent('16:00–17:30');
    expect(screen.queryByRole('button', { name: 'Retry squads' })).not.toBeInTheDocument();
    expect(api.spaces).toHaveBeenCalledTimes(2);
});

it('keeps fresh authorised data on a partial read and restores the failed squad through Retry', async () => {
    let failing = true;
    vi.mocked(api.overview).mockImplementation(async id => { if (id === 20 && failing) throw new Error('Fixture B read failed'); return overview(id); });
    show();
    expect(await screen.findByRole('alert')).toHaveTextContent('Some squads could not load. Available squads are shown.');
    expect(await screen.findByRole('link', { name: /Fixture training A/ })).toHaveAttribute('href', href(61));
    expect(screen.queryByRole('link', { name: /Fixture B/ })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Coming up' })).toBeInTheDocument();
    failing = false; fireEvent.click(screen.getByRole('button', { name: 'Retry squads' }));
    expect(await screen.findByRole('link', { name: /^Fixture B\s*Coach/ })).toHaveAttribute('href', '/squads/20?player=61');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('does not keep failed old data or a fresh roster that no longer includes the current child', async () => {
    show(); await screen.findByRole('link', { name: /^Fixture B\s*Coach/ });
    vi.mocked(api.overview).mockImplementation(async id => { if (id === 20) throw { response: { status: 403 } }; return overview(id, [62]); });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await screen.findByRole('alert');
    await waitFor(() => expect(screen.queryByRole('link', { name: /Fixture training A/ })).not.toBeInTheDocument());
    expect(screen.queryAllByRole('link', { name: /Fixture A|Fixture B/ })).toHaveLength(0);
    expect(screen.queryByText('No squads are listed for Nika yet.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nika,/ })).toHaveAttribute('aria-pressed', 'true');
});

it('distinguishes loading from a successfully confirmed empty squad list', async () => {
    const read = deferred<api.SquadSpace[]>(); vi.mocked(api.spaces).mockReturnValueOnce(read.promise);
    show(); expect(await screen.findByText('Loading squads…')).toBeInTheDocument();
    expect(screen.queryByText('No squads are listed for Nika yet.')).not.toBeInTheDocument();
    await act(async () => read.resolve([]));
    expect(await screen.findByText('No squads are listed for Nika yet.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry squads' })).not.toBeInTheDocument();
});

it('refuses a retired child completion after switching to a sibling', async () => {
    const old = deferred<api.SquadOverview>(); let first = true;
    vi.mocked(api.overview).mockImplementation(async id => { if (id === 10 && first) { first = false; return old.promise; } return overview(id, [62]); });
    show(); await waitFor(() => expect(api.overview).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('button', { name: /Saba,/ }));
    expect(await screen.findByRole('link', { name: /Fixture training A/ })).toHaveAttribute('href', href(62));
    await act(async () => old.resolve(overview(10, [61])));
    expect(nextLink()).toHaveAttribute('href', href(62)); expect(screen.getByRole('button', { name: /Saba,/ })).toHaveAttribute('aria-pressed', 'true');
});

it('refuses a retired login completion before it can populate the replacement family', async () => {
    const old = deferred<api.SquadOverview>(); let first = true;
    vi.mocked(api.overview).mockImplementation(async id => { if (id === 10 && first) { first = false; return old.promise; } return overview(id, [63]); });
    const view = show(); await waitFor(() => expect(api.overview).toHaveBeenCalledTimes(2));
    auth.sessionId = 'f06-next-login'; auth.user = { id: 8 };
    vi.mocked(fetchJoiningChildren).mockResolvedValue({ children: [child(63, 'Own child')] });
    view.rerender(page());
    expect(await screen.findByRole('link', { name: /Fixture training A/ })).toHaveAttribute('href', href(63));
    await act(async () => old.resolve(overview(10, [61])));
    expect(nextLink()).toHaveAttribute('href', href(63)); expect(screen.queryByRole('button', { name: /Nika,/ })).not.toBeInTheDocument();
});
