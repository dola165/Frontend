import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { apiClient } from '../../../api/axiosConfig';
import CoachWorkspacePage from '../../../pages/CoachWorkspacePage';
import { getAuthSessionId, setStoredAccessToken } from '../../../utils/authStorage';
import type { CoachTrainingContext } from '../coachHub/coachData';
import { SquadsPage } from './SquadsPage';
import '../../../i18n';

const fixture = vi.hoisted(() => ({ assigned: false, selectedFirst: false, refuseRoles: false, readClubs: [] as number[] }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() }, DEPLOYMENT_URLS: { mediaBaseUrl: 'http://fixture.invalid' } }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, sessionId: getAuthSessionId(), user: { id: 9500, navigationCapabilities: { version: 1, workspaces: [
    { id: 'club.workspace', context: { type: 'club', id: 399, label: fixture.selectedFirst ? 'Z other club' : 'A other club' } },
    { id: 'club.workspace', context: { type: 'club', id: 400, label: fixture.selectedFirst ? 'A assigned club' : 'Z assigned club' } },
] } } }) }));
vi.mock('../../clubOperations/useClubOperations', () => ({ useClubOperations: (club: number) => ({ boot: { ...boot, clubId: club, clubName: club === 400 ? 'Assigned club' : 'Other club' }, loading: false, error: '', refresh: vi.fn() }) }));
vi.mock('../../clubOperations/useWorkspaceRoles', async original => ({ ...await original<object>(), useWorkspaceRoles: (club: number) => {
    fixture.readClubs.push(club); return { data: fixture.refuseRoles ? null : roles(club), loading: false, error: fixture.refuseRoles ? 'Club role read refused.' : '', refresh: vi.fn() };
} }));
vi.mock('../useClubOverview', () => ({ useClubOverview: (club: number) => ({ clubName: club === 400 ? 'Assigned club' : 'Other club', clubLogoUrl: null, loading: false, error: null, schedule: { events: [] } }) }));
vi.mock('../WorkspaceGuide', () => ({ WorkspaceGuide: ({ training, onOpenSchedule }: { training?: CoachTrainingContext; onOpenSchedule: (next?: NonNullable<CoachTrainingContext['next']>) => void }) => training?.next
    ? <button onClick={() => onOpenSchedule(training.next!)}>Open fixture guide session</button> : null }));
vi.mock('../../squadCommunication/page/SquadPage', () => ({ SquadPage: ({ id }: { id: number }) => <p>Shared squad #{id}</p> }));
vi.mock('../../clubOperations/SquadAgePolicy', () => ({ SquadAgePolicy: () => null }));
vi.mock('../../../components/squads/AddPlayerToSquadModal', () => ({ AddPlayerToSquadModal: () => null }));
vi.mock('../../../components/squads/PlayerCardModal', () => ({ PlayerCardModal: () => null }));
const squad = { id: 401, clubId: 400, name: 'Assigned U12', category: 'U12', gender: 'MALE' };
const coach = { user_id: 9500, full_name: 'Confirmed club coach' };
const session = { id: 77, title: 'Existing fixture training', event_type: 'TRAINING', starts_at: '2099-10-19T14:00:00Z', ends_at: '2099-10-19T15:30:00Z', location: 'Fixture ground', status: 'SCHEDULED', revision: 1, attendance: [] };
const boot = { clubId: 400, actorId: 9500, clubName: 'Assigned club', leadership: true, definitions: [], specialisations: [], permissions: [], settings: { setting: 'ACADEMY', playing_level: 'AMATEUR', enabled_modules: ['ATTENDANCE'], revision: 0 }, modules: [], squads: [squad], people: [], staff: [], guardians: [], events: [], sessions: [], venues: [], links: [] };
function roles(club = 400) {
    const owned = club === 400, view = { id: 'club', label: 'Club administration', modules: [], squadIds: owned ? [401] : [], clubWide: true, appointmentId: null, revision: null };
    return { leadership: true, actorId: 9500, catalog: [], current: view, views: [view, ...(owned && fixture.assigned ? [{ ...view, id: 'coaching', label: 'Squad coach', clubWide: false }] : [])], squads: owned ? [{ id: 401, name: squad.name, player_count: 0 }] : [], requestSquads: owned ? [squad] : [], people: [], sessions: [], requests: [], invitations: [] };
}
const overview = () => ({ id: 401, club_id: 400, viewer_id: 9500, academy_name: 'Assigned club', name: squad.name, category: 'U12', can_manage: true, unread_count: 0, member_count: 1, notify_chat: true, head_coach_id: fixture.assigned ? 9500 : null, can_assign_coach: true, available_coaches: [coach], coaches: fixture.assigned ? [coach] : [], players: [], threads: [] });
function Location() { const value = useLocation(); return <output data-testid="location">{value.pathname + value.search}</output>; }
function mount(path = '/clubs/400/workspace?tab=squads&squad=401') { return render(<MemoryRouter initialEntries={[path]}><Location /><Routes>
    <Route path="/clubs/:id/workspace" element={<SquadsPage clubId={400} overview={{ currentUserRole: 'OWNER', activePlayerCount: 0 } as never} setParentError={vi.fn()} setParentSuccess={vi.fn()} workspace={{ data: roles(), boot, onOpen: vi.fn() }} />} />
    <Route path="/my-squads" element={<CoachWorkspacePage />} />
</Routes></MemoryRouter>); }
async function assign() {
    fireEvent.change(await screen.findByRole('combobox', { name: 'Head coach' }), { target: { value: '9500' } });
    expect(apiClient.put).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Save coach' }));
    await screen.findByText('Coach saved: Confirmed club coach.');
    expect(vi.mocked(apiClient.put).mock.calls).toStrictEqual([['/squad-communication/401/coach', { userId: 9500 }, { _authSessionId: getAuthSessionId() }]]);
}
async function card() {
    let found: HTMLElement | undefined;
    await waitFor(() => { found = screen.getAllByRole('link').find(link => {
        const url = new URL(link.getAttribute('href')!, 'http://fixture.invalid');
        return url.pathname === '/my-squads' && url.searchParams.get('squad') === '401' && !url.searchParams.has('tab');
    }); expect(found).toHaveTextContent('Assigned U12'); });
    return found!;
}
beforeEach(() => {
    vi.resetAllMocks(); fixture.assigned = false; fixture.selectedFirst = false; fixture.refuseRoles = false; fixture.readClubs = [];
    localStorage.clear(); sessionStorage.clear(); setStoredAccessToken('club-handoff-fixture');
    vi.mocked(apiClient.get).mockImplementation(async url => ({ data: url === '/clubs/400/squads' ? [squad] : url === '/squad-communication/401' ? overview() : url === '/squad-communication/401/sessions' ? [session] : [] }));
    vi.mocked(apiClient.put).mockImplementation(async (url, body) => {
        expect(url).toBe('/squad-communication/401/coach'); expect(body).toStrictEqual({ userId: 9500 }); fixture.assigned = true; return { data: overview() };
    });
});
afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); });

describe('assigned club handoff', () => {
    it.each([false, true])('keeps the assigned club through squad opening, Back and guide navigation with selectedFirst=%s', async selectedFirst => {
        fixture.selectedFirst = selectedFirst; mount(); await assign(); fireEvent.click(screen.getByRole('link', { name: 'My squads' }));
        const selected = await card(); expect(fixture.readClubs.length).toBeGreaterThan(0); expect(fixture.readClubs.every(club => club === 400)).toBe(true);
        fireEvent.click(selected); await screen.findByText('Shared squad #401');
        const back = screen.getAllByRole('link', { name: 'My squads' }).find(link => link.closest('.ch-squad-page__back')); expect(back).toBeDefined(); fireEvent.click(back!); await card();
        fireEvent.click(await screen.findByRole('button', { name: 'Open fixture guide session' })); await screen.findByText('Shared squad #401');
        const location = new URL(screen.getByTestId('location').textContent!, 'http://fixture.invalid');
        expect(location.searchParams.get('clubId')).toBe('400'); expect(location.searchParams.get('squad')).toBe('401'); expect(location.searchParams.get('session')).toBe('77');
        expect(fixture.readClubs.every(club => club === 400)).toBe(true);
        expect(apiClient.put).toHaveBeenCalledOnce(); expect(apiClient.post).not.toHaveBeenCalled(); expect(apiClient.delete).not.toHaveBeenCalled();
    });
    it('keeps a destination role-read refusal honest after save without inventing coaching or switching clubs', async () => {
        mount(); await assign(); fixture.refuseRoles = true; fireEvent.click(screen.getByRole('link', { name: 'My squads' }));
        await screen.findByText('Club role read refused.'); expect(screen.queryByText('Assigned U12')).not.toBeInTheDocument();
        expect(fixture.readClubs.length).toBeGreaterThan(0); expect(fixture.readClubs.every(club => club === 400)).toBe(true); expect(apiClient.put).toHaveBeenCalledOnce();
    });
    it("opens the linked squad's editor once from a private score's age-group link", async () => {
        mount('/clubs/400/workspace?tab=squads&squad=401&edit=1');
        expect(await screen.findByRole('dialog', { name: 'Edit squad' })).toBeInTheDocument();
        await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/clubs/400/workspace?tab=squads&squad=401'));
    });
    it('removes the saved handoff when its captured login retires before navigation', async () => {
        mount(); await assign(); act(() => setStoredAccessToken('replacement-club-handoff-fixture'));
        await screen.findByText(/Your sign-in changed/); expect(screen.queryByRole('link', { name: 'My squads' })).not.toBeInTheDocument();
        expect(fixture.readClubs).toStrictEqual([]); expect(apiClient.put).toHaveBeenCalledOnce();
    });
});
