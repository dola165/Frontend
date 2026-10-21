import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import ClubWorkspacePage from './ClubWorkspacePage';
import { apiClient } from '../api/axiosConfig';
import { coachRecordHref } from '../features/clubOperations/coachOrigin';
import type { Bootstrap, OperationRecord } from '../features/clubOperations/api';
import type { RolesWorkspace } from '../features/clubOperations/useWorkspaceRoles';
import '../i18n';

vi.mock('../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, sessionId: 'coach-session' }) }));
vi.mock('../features/clubOperations/useClubOperations', () => ({ useClubOperations: () => ({ boot, loading: false, error: '', refresh: vi.fn() }) }));
vi.mock('../features/clubOperations/useWorkspaceRoles', async original => ({ ...await original<object>(), useWorkspaceRoles: () => ({ data: roles, loading: false, error: '', refresh: vi.fn() }) }));
vi.mock('../features/clubWorkspace/useClubOverview', () => ({ useClubOverview: () => ({ overview: { currentUserRole: 'COACH', pendingInvitations: [], pendingApplications: [] }, clubName: 'Academy', loading: false, error: null, schedule: { events: [] }, reload: vi.fn() }) }));
vi.mock('../features/clubWorkspace/useClubMembership', () => ({ useClubMembership: () => ({ tryouts: { applicants: [], pendingCount: 0 }, errorMessage: null, successMessage: null, setErrorMessage: vi.fn(), setSuccessMessage: vi.fn() }) }));
vi.mock('../features/clubWorkspace/useClubInbox', () => ({ useClubInbox: () => ({ unreadCount: 0 }) }));
vi.mock('../features/admissions/club/useClubAdmissions', () => ({ useClubAdmissions: () => ({ data: null }) }));
vi.mock('../features/clubWorkspace/ClubDecisionDialogs', () => ({ ClubDecisionDialogs: () => null }));
vi.mock('../features/clubWorkspace/WorkspaceGuide', () => ({ WorkspaceGuide: () => null }));
vi.mock('../features/clubWorkspace/coachHub/ResponsibilityRequests', () => ({ ResponsibilityRequests: () => null }));
vi.mock('../features/clubOperations/WorkspaceSquads', () => ({ WorkspaceSquads: () => <h1>Squad lists</h1> }));
vi.mock('../features/clubWorkspace/squads/SquadsPage', () => ({ SquadsPage: () => <h1>Squad lists</h1> }));
vi.mock('../design/workspace/WorkspaceShell', () => ({ WorkspaceShell: ({ children }: { children: ReactNode }) => children }));

const boot: Bootstrap = { clubId: 1, actorId: 9, clubName: 'Academy', leadership: false, definitions: [{ module: 'AVAILABILITY', kind: 'RESTRICTION', label: 'Participation restriction', fields: [], states: [] }], specialisations: [], permissions: [],
    settings: { setting: 'ACADEMY', playing_level: 'AMATEUR', enabled_modules: ['AVAILABILITY'], revision: 0 }, modules: [{ id: 'AVAILABILITY', writable: false, globalWrite: false, writeSquads: [], readSquads: [103], globalRead: false }],
    squads: [{ id: 103, name: 'U14' }], people: [{ id: 8, name: 'Archil' }], staff: [], guardians: [], events: [], sessions: [], venues: [], links: [] };
const roles: RolesWorkspace = { leadership: false, actorId: 9, catalog: [], views: [{ id: 'coaching', label: 'Squad coach', clubWide: false, squadIds: [103], modules: ['AVAILABILITY'], appointmentId: 1, revision: 1 }],
    current: { id: 'all', label: 'All', clubWide: false, squadIds: [103], modules: ['AVAILABILITY'], appointmentId: null, revision: null }, squads: [{ id: 103, name: 'U14', player_count: 1 }], requestSquads: [{ id: 103, name: 'U14' }], people: [], sessions: [], requests: [], invitations: [] };
const record: OperationRecord = { id: 70116, club_id: 1, module: 'AVAILABILITY', kind: 'RESTRICTION', title: 'Actual participation limit', status: 'ACTIVE', revision: 2, squad_id: 103, subject_user_id: 8, assigned_user_id: null, event_id: null, session_id: null, related_record_id: null, due_on: null, data: {}, canEdit: false, transitions: [], created_at: '', updated_at: '' };
function Location() { const location = useLocation(); return <output aria-label="Current route">{location.pathname}{location.search}</output>; }
function view(query = '') {
    return render(<MemoryRouter initialEntries={[coachRecordHref(1, record) + query]}><Location /><Routes>
        <Route path="/clubs/:id/workspace" element={<ClubWorkspacePage />} /><Route path="/my-squads" element={<h1>Coach overview</h1>} />
    </Routes></MemoryRouter>);
}
beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear(); localStorage.setItem('userId', '9');
    vi.mocked(apiClient.get).mockImplementation(async url => ({ data: String(url).endsWith('/records/70116') ? record : [] }));
});
afterEach(() => { cleanup(); localStorage.clear(); });

it('returns a current assigned-squad record to the real My squads route without a write', async () => {
    view(); await screen.findByRole('heading', { name: record.title });
    expect(apiClient.get).toHaveBeenCalledWith('/clubs/1/operations/records/70116', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to My squads' }));
    expect(await screen.findByRole('heading', { name: 'Coach overview' })).toBeVisible(); expect(screen.getByLabelText('Current route')).toHaveTextContent(/^\/my-squads\?clubId=1$/);
    expect(apiClient.post).not.toHaveBeenCalled(); expect(apiClient.put).not.toHaveBeenCalled();
});
it('keeps a record opened from the internal tool list returning to that list', async () => {
    view('&from=list'); await screen.findByRole('heading', { name: record.title });
    expect(screen.queryByRole('button', { name: 'Back to My squads' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to restrictions' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/clubs/1/workspace?'); expect(screen.getByLabelText('Current route')).not.toHaveTextContent('record=');
});
it('preserves an existing internal workspace origin ahead of the coach marker', async () => {
    view('&return=tab%3Dsquads%26squad%3D103'); await screen.findByRole('heading', { name: record.title });
    fireEvent.click(screen.getByRole('button', { name: 'Back to U14' }));
    expect(await screen.findByRole('heading', { name: 'Squad lists' })).toBeVisible(); expect(screen.getByLabelText('Current route')).toHaveTextContent('/clubs/1/workspace?tab=squads&squad=103');
});
it('does not give a coach return when the confirmed account identity differs', async () => {
    localStorage.setItem('userId', '10'); view(); await screen.findByRole('heading', { name: record.title });
    expect(screen.queryByRole('button', { name: 'Back to My squads' })).not.toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Back to restrictions' })).toBeVisible();
});
it('keeps a server record refusal authoritative despite valid navigation metadata', async () => {
    vi.mocked(apiClient.get).mockRejectedValue({ response: { status: 403, data: { message: 'No record access' } } });
    view(); expect(await screen.findByRole('alert')).toHaveTextContent('No record access'); expect(screen.queryByRole('heading', { name: record.title })).not.toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
});
