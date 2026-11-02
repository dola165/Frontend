import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import '../../i18n';
import { ClubOffice } from '../clubOffice/ClubOffice';
import { officeToolPath } from '../clubOffice/officeLinks';
import { ProjectFacilityOutcome } from './ProjectFacilityOutcome';
import type { Bootstrap, OperationRecord } from '../clubOperations/api';

const fixture = vi.hoisted(() => ({ get: vi.fn(), boot: null as unknown }));
vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: fixture.get } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 9500, dob: '1990-01-01' } }) }));
vi.mock('../../hooks/useCan', () => ({ refreshAccess: vi.fn(), useCan: () => ({ pending: false, failed: false, admin: null, decide: () => ({ allowed: true }) }) }));
vi.mock('../clubWorkspace/useClubOverview', () => ({ useClubOverview: () => ({ overview: { currentUserRole: 'OWNER' }, clubName: 'Dinamo synthetic', loading: false, reload: vi.fn() }) }));
vi.mock('../clubOperations/useClubOperations', () => ({ useClubOperations: () => ({ boot: fixture.boot, loading: false, refresh: vi.fn() }) }));
vi.mock('../clubOperations/useWorkspaceRoles', () => ({ useWorkspaceRoles: () => ({ data: { views: [], squads: [], people: [] }, loading: false, refresh: vi.fn() }) }));
vi.mock('../admissions/club/useClubAdmissions', () => ({ useClubAdmissions: () => ({ data: null, loading: false }) }));
vi.mock('../clubWorkspace/useClubMembership', () => ({ useClubMembership: () => ({}) }));
vi.mock('../clubOperations/people/ClubPeople', () => ({ ClubPeople: () => <h1>Staff receiver</h1> }));
vi.mock('../squadCommunication/journeyCopy', () => ({ useJourneyCopy: () => (en: string) => en }));
const definition = { module: 'FACILITIES', kind: 'FACILITY_TASK', label: 'Ground work', states: ['SCHEDULED', 'COMPLETED', 'CANCELLED'], fields: [] };
const boot: Bootstrap = {
    clubId: 400, clubName: 'Dinamo synthetic', actorId: 9500, leadership: true, definitions: [definition], specialisations: [], permissions: [],
    settings: { setting: 'COMMUNITY', playing_level: 'AMATEUR', enabled_modules: ['FACILITIES'], revision: 0 },
    modules: [{ id: 'FACILITIES', writable: true, globalWrite: true, writeSquads: [] }],
    squads: [{ id: 7, name: 'U14 synthetic' }], people: [], staff: [], guardians: [], events: [], sessions: [], venues: [], links: [],
};
const record: OperationRecord = {
    id: 81, club_id: 400, module: 'FACILITIES', kind: 'FACILITY_TASK', title: 'Pitch 1 net repair', status: 'SCHEDULED', data: {}, revision: 0,
    squad_id: 7, subject_user_id: null, assigned_user_id: 9500, event_id: null, session_id: null, related_record_id: null, due_on: null,
    canEdit: true, transitions: ['COMPLETED', 'CANCELLED'], created_at: '2026-10-31', updated_at: '2026-10-31',
};
beforeEach(() => {
    fixture.get.mockReset(); fixture.boot = boot;
    localStorage.clear(); localStorage.setItem('gk-session-id', 'destination-test');
});
afterEach(cleanup);

it.each([['SCHEDULED', 'Record actual outcome'], ['COMPLETED', 'Open facilities task']])('G4-S1 opens the actual facilities receiver for %s, retaining record and squad', async (status, action) => {
    // This is the source response contract; the backend covering case independently asserts its emitted href.
    const href = '/clubs/400/office?tab=tools&tool=facilities&record=81&squad=7';
    const currentRecord = { ...record, status, transitions: status === 'SCHEDULED' ? ['COMPLETED', 'CANCELLED'] : [] };
    fixture.get.mockImplementation(async (path: string) => ({ data: path.endsWith('/facility-task')
        ? { id: 81, title: record.title, status, outcome: null, revision: 0, canRecordOutcome: status === 'SCHEDULED', href }
        : path === '/clubs/400/operations/records/81' ? currentRecord
            : path.includes('/facility-tasks/') ? { projectId: 5, canStart: false } : [] }));
    render(<MemoryRouter initialEntries={['/projects/5']}><Routes>
        <Route path="/projects/5" element={<ProjectFacilityOutcome club={400} project={5} version={1} />} />
        <Route path="/clubs/400/office" element={<ClubOffice clubId={400} sessionId="destination-test" />} />
    </Routes></MemoryRouter>);
    fireEvent.click(await screen.findByRole('link', { name: action }));
    // Real ClubOffice -> OfficeTool -> WorkspaceOperations -> RecordDetail, with data/auth only stubbed.
    expect(await screen.findByRole('heading', { level: 1, name: record.title })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Staff receiver' })).not.toBeInTheDocument();
    expect(href).toBe(officeToolPath(400, 'facilities', { record: '81', squad: '7' }));
    expect(fixture.get).toHaveBeenCalledWith('/clubs/400/operations/records/81', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    if (status === 'SCHEDULED') expect(screen.getByRole('button', { name: 'Mark as completed' })).toBeVisible();
    else expect(screen.queryByRole('button', { name: 'Mark as completed' })).not.toBeInTheDocument();
    expect(screen.getByText('U14 synthetic')).toBeVisible();
});
