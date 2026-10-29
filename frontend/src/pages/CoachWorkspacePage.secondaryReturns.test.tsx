import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { apiClient } from '../api/axiosConfig';
import { getAuthSessionId, setStoredAccessToken } from '../utils/authStorage';
import type { Bootstrap, OperationRecord } from '../features/clubOperations/api';
import type { RolesWorkspace } from '../features/clubOperations/useWorkspaceRoles';
import type { CoachData } from '../features/clubWorkspace/coachHub/CoachWorkspace';
import CoachWorkspacePage from './CoachWorkspacePage';
import ClubOfficePage from './ClubOfficePage';
import '../i18n';

const fixture = vi.hoisted(() => ({ selectedFirst: false, kind: 'update' as 'update' | 'record', access: true, assigned: true, readClubs: [] as number[] }));
vi.mock('../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() }, DEPLOYMENT_URLS: { mediaBaseUrl: 'http://fixture.invalid' } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, sessionId: getAuthSessionId(), user: { id: 9500, navigationCapabilities: { version: 1, workspaces: [
    { id: 'club.workspace', context: { type: 'club', id: 399, label: fixture.selectedFirst ? 'Z other club' : 'A other club' } },
    ...(fixture.access ? [{ id: 'club.workspace', context: { type: 'club', id: 400, label: fixture.selectedFirst ? 'A assigned club' : 'Z assigned club' } }] : []),
] } } }) }));
vi.mock('../features/clubOperations/useClubOperations', () => ({ useClubOperations: (club: number) => ({ boot: { ...boot, clubId: club }, loading: false, error: '', refresh: vi.fn() }) }));
vi.mock('../features/clubOperations/useWorkspaceRoles', async original => ({ ...await original<object>(), useWorkspaceRoles: (club: number) => {
    fixture.readClubs.push(club); return { data: roles(club), loading: false, error: '', refresh: vi.fn() };
} }));
vi.mock('../features/clubWorkspace/useClubOverview', () => ({ useClubOverview: (club: number) => ({ overview: { currentUserRole: 'COACH', pendingInvitations: [], pendingApplications: [] }, clubName: club === 400 ? 'Assigned club' : 'Other club', loading: false, error: null, schedule: { events: [] }, reload: vi.fn() }) }));
vi.mock('../features/clubWorkspace/useClubMembership', () => ({ useClubMembership: () => ({ tryouts: { applicants: [], pendingCount: 0 }, errorMessage: null, successMessage: null, setErrorMessage: vi.fn(), setSuccessMessage: vi.fn() }) }));
vi.mock('../features/admissions/club/useClubAdmissions', () => ({ useClubAdmissions: () => ({ data: null }) }));
vi.mock('../features/clubWorkspace/ClubDecisionDialogs', () => ({ ClubDecisionDialogs: () => null }));
vi.mock('../features/clubWorkspace/WorkspaceGuide', () => ({ WorkspaceGuide: () => null }));
vi.mock('../hooks/useCan', () => ({ refreshAccess: vi.fn(), useCan: () => ({ pending: false, admin: null, decide: (action: string) => ({ allowed: action === 'see_staff' }) }) }));
vi.mock('../features/clubWorkspace/coachHub/CoachUpdates', () => ({ CoachUpdates: ({ data }: { data: CoachData }) => <p data-testid="updates">Updates club{data.clubId} squad{data.focus}</p> }));
const boot: Bootstrap = { clubId: 400, actorId: 9500, clubName: 'Assigned club', leadership: false, definitions: [{ module: 'AVAILABILITY', kind: 'RESTRICTION', label: 'Participation restriction', fields: [], states: [] }], specialisations: [], permissions: [],
    settings: { setting: 'ACADEMY', playing_level: 'AMATEUR', enabled_modules: ['AVAILABILITY'], revision: 0 }, modules: [{ id: 'AVAILABILITY', writable: false, globalWrite: false, writeSquads: [], readSquads: [401], globalRead: false }],
    squads: [{ id: 401, name: 'Assigned U12' }], people: [{ id: 8, name: 'Fixture player' }], staff: [], guardians: [], events: [], sessions: [], venues: [], links: [] };
function roles(club: number): RolesWorkspace {
    const owned = club === 400, current = { id: 'all', label: 'All', clubWide: false, squadIds: owned ? [401] : [], modules: ['AVAILABILITY'], appointmentId: null, revision: null };
    return { leadership: false, actorId: 9500, catalog: [], current, views: owned && fixture.assigned ? [{ ...current, id: 'coaching', label: 'Squad coach', onSquads: true }] : [],
        squads: owned ? [{ id: 401, name: 'Assigned U12', player_count: 1 }] : [], requestSquads: owned ? [{ id: 401, name: 'Assigned U12' }] : [], people: [], sessions: [], requests: [], invitations: [] };
}
const record: OperationRecord = { id: 70116, club_id: 400, module: 'AVAILABILITY', kind: 'RESTRICTION', title: 'Fixture participation limit', status: 'ACTIVE', revision: 2, squad_id: 401, subject_user_id: 8, assigned_user_id: null, event_id: null, session_id: null, related_record_id: null, due_on: null, data: {}, canEdit: false, transitions: [], created_at: '', updated_at: '' };
const overview = { id: 401, club_id: 400, viewer_id: 9500, academy_name: 'Assigned club', name: 'Assigned U12', category: 'U12', can_manage: true, unread_count: 0, member_count: 5, notify_chat: true, head_coach_id: 9500, can_assign_coach: false, available_coaches: [], coaches: [{ user_id: 9500, full_name: 'Confirmed coach' }], players: [], threads: [9601, 9602, 9603, 9604].map(user_id => ({ user_id, full_name: 'Fixture family', unread_count: 0 })) };
const update = { id: 88, author_id: 9500, author_name: 'Confirmed coach', thread_user_id: null, kind: 'ANNOUNCEMENT', title: 'Matchday: Fixture opposition', body: 'Fixture update', important: true, created_at: '2026-10-17T09:00:00Z', acknowledgement_requested: true, acknowledged_at: null, acknowledged_by: [], expires_at: '2099-01-01T00:00:00Z' };
function Location() { const value = useLocation(); return <output data-testid="location">{value.pathname + value.search}</output>; }
function Harness({ initial = '/my-squads?clubId=400' }: { initial?: string }) { return <MemoryRouter initialEntries={[initial]}><Location /><Routes>
    <Route path="/my-squads" element={<CoachWorkspacePage />} /><Route path="/clubs/:id/office" element={<ClubOfficePage />} />
</Routes></MemoryRouter>; }
const location = () => new URL(screen.getByTestId('location').textContent!, 'http://fixture.invalid');
async function needLink(kind: 'update' | 'record') {
    if (kind === 'update') return screen.findByRole('link', { name: /Matchday: Fixture opposition/ });
    let found: HTMLElement | undefined; await waitFor(() => { found = screen.getAllByRole('link').find(link => new URL(link.getAttribute('href')!, 'http://fixture.invalid').searchParams.get('record') === '70116'); expect(found).toBeDefined(); }); return found!;
}
beforeEach(() => {
    vi.resetAllMocks(); fixture.selectedFirst = false; fixture.kind = 'update'; fixture.access = true; fixture.assigned = true; fixture.readClubs = [];
    localStorage.clear(); sessionStorage.clear(); setStoredAccessToken('secondary-scope-fixture'); localStorage.setItem('userId', '9500');
    vi.mocked(apiClient.get).mockImplementation(async url => ({ data: url === '/squad-communication/401' ? overview : url === '/squad-communication/401/messages' ? fixture.kind === 'update' ? [update] : []
        : url === '/clubs/400/operations/records/70116' ? record : fixture.kind === 'record' && String(url).startsWith('/clubs/400/workspace-roles/work?module=AVAILABILITY') ? [record] : [] }));
});
afterEach(() => { expect(apiClient.put).not.toHaveBeenCalled(); expect(apiClient.post).not.toHaveBeenCalled(); expect(apiClient.delete).not.toHaveBeenCalled(); cleanup(); localStorage.clear(); sessionStorage.clear(); });

describe('392 secondary scoped returns', () => {
    it.each([false, true])('important-update link keeps the rendered club and squad with selectedFirst=%s', async selectedFirst => {
        fixture.selectedFirst = selectedFirst; render(<Harness />); fireEvent.click(await needLink('update'));
        expect(fixture.readClubs.at(-1)).toBe(400); expect(await screen.findByTestId('updates')).toHaveTextContent('Updates club400 squad401');
        expect(location().searchParams.get('clubId')).toBe('400'); expect(location().searchParams.get('squad')).toBe('401');
    });
    it.each([false, true])('record return keeps the validated club with selectedFirst=%s', async selectedFirst => {
        fixture.selectedFirst = selectedFirst; fixture.kind = 'record'; render(<Harness />); fireEvent.click(await needLink('record'));
        await screen.findByRole('heading', { name: record.title }); expect(location().searchParams.get('coachClub')).toBe('400');
        fireEvent.click(screen.getByRole('button', { name: 'Back to My squads' })); expect(fixture.readClubs.at(-1)).toBe(400);
        await screen.findByRole('link', { name: /Assigned U12/ }); expect(location().searchParams.get('clubId')).toBe('400');
    });
    it('keeps an unscoped important-update destination unscoped', async () => {
        fixture.selectedFirst = true; render(<Harness initial="/my-squads" />); fireEvent.click(await needLink('update'));
        expect(await screen.findByTestId('updates')).toHaveTextContent('Updates club400 squad401'); expect(location().searchParams.has('clubId')).toBe(false);
    });
    it.each(['update', 'record'] as const)('refuses newly withdrawn current club access at the %s destination without falling back to399', async kind => {
        fixture.kind = kind; render(<Harness />); const link = await needLink(kind);
        if (kind === 'record') { fireEvent.click(link); await screen.findByRole('heading', { name: record.title }); }
        fixture.access = false;
        fireEvent.click(kind === 'record' ? screen.getByRole('button', { name: 'Back to My squads' }) : link);
        await screen.findByText('Club squads unavailable'); expect(fixture.readClubs).not.toContain(399);
    });
    it('does not offer a record coach return after its confirmed squad assignment is withdrawn', async () => {
        fixture.kind = 'record'; const view = render(<Harness />); fireEvent.click(await needLink('record')); await screen.findByRole('heading', { name: record.title });
        fixture.assigned = false; view.rerender(<Harness />);
        expect(screen.queryByRole('button', { name: 'Back to My squads' })).not.toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Back to restrictions' })).toBeVisible();
    });
});
