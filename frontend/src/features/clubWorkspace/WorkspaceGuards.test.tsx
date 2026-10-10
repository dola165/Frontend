import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { apiClient } from '../../api/axiosConfig';
import { ClubSettingsPage } from './settings/ClubSettingsPages';
import { CoachHub } from './coachHub/CoachHub';
import { WorkspaceOperations } from '../clubOperations/WorkspaceOperations';
import { RecordTable } from '../clubOperations/records/RecordList';
import { RecordDetail } from '../clubOperations/RecordDetail';
import type { Bootstrap, Definition, OperationRecord } from '../clubOperations/api';
import type { RoleView, RolesWorkspace } from '../clubOperations/useWorkspaceRoles';
import type { ResponsibilityFocus } from '../clubOperations/workspaceStructure';
import type { ClubPresentation } from '../clubs/presentation';

vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 9, navigationCapabilities: { version: 1, workspaces: [] } }, sessionId: 'one' }) }));

const profile: ClubPresentation = { profileKind: 'ACADEMY', revision: 3, canEdit: true, canManageAffiliations: true, programmes: [], sponsors: [], affiliations: [] };
const coaching: RoleView = { id: 'coaching', label: 'Squad coach', modules: ['DEVELOPMENT'], squadIds: [11], clubWide: false, appointmentId: 4, revision: 1 };
const roles: RolesWorkspace = {
    leadership: false, actorId: 9, current: { ...coaching, id: 'all', label: 'All' }, views: [coaching],
    catalog: [{ key: 'ANALYST', title: 'Video analyst', description: 'Reviews match footage.', permissions: ['DEVELOPMENT:READ'] }],
    requestSquads: [{ id: 11, name: 'U12' }], squads: [{ id: 11, name: 'U12', player_count: 1 }], people: [{ id: 21, name: 'Alex', squad_id: 11, squad_name: 'U12' }],
    sessions: [], requests: [], invitations: [],
};
const focus = (selected: RoleView[]): ResponsibilityFocus => ({ available: [coaching], selected: selected.map(v => v.id), selectedViews: selected, tabs: 'all', toggle: vi.fn(), showAll: vi.fn() });
const definition: Definition = { module: 'GUARDIANS', kind: 'PERMISSION', label: 'Permission', states: [], fields: [] };
const boot: Bootstrap = {
    clubId: 1, clubName: 'Academy', actorId: 9, leadership: false, definitions: [definition], specialisations: [], permissions: [],
    settings: { setting: 'COMMUNITY', playing_level: 'AMATEUR', enabled_modules: ['GUARDIANS'], revision: 0 },
    modules: [{ id: 'GUARDIANS', writable: true, globalWrite: true, writeSquads: [], readSquads: [11], globalRead: true }],
    squads: [{ id: 11, name: 'U12' }], people: [], staff: [], guardians: [], events: [], sessions: [], venues: [], links: [],
};
const record = (overrides: Partial<OperationRecord>): OperationRecord => ({
    id: 5, module: 'GUARDIANS', kind: 'PERMISSION', title: 'Photo permission', status: 'GRANTED', squad_id: 11, subject_user_id: null, assigned_user_id: null,
    event_id: null, session_id: null, related_record_id: null, due_on: null, data: {}, revision: 2, canEdit: true, transitions: [], ...overrides,
} as OperationRecord);

beforeEach(() => {
    vi.mocked(apiClient.get).mockImplementation(async (url: string) => ({ data: url.includes('/presentation/manage') ? profile : url.includes('/history') || url.includes('/documents') ? [] : url.includes('/records/') ? record({}) : {} }));
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); localStorage.clear(); });

describe('unsaved work across workspace tabs', () => {
    it('asks before a settings section switch drops public profile edits', async () => {
        render(<MemoryRouter initialEntries={['/?section=profile']}><ClubSettingsPage clubId={1} busy={false} /></MemoryRouter>);
        fireEvent.change(await screen.findByLabelText('Profile purpose'), { target: { value: 'COMMUNITY' } });
        fireEvent.click(screen.getByRole('tab', { name: 'Joining' }));
        expect(screen.getByRole('group', { name: 'Discard edits' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Public profile' })).toHaveAttribute('aria-selected', 'true');
        fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
        expect(screen.getByLabelText('Profile purpose')).toHaveValue('COMMUNITY');
        fireEvent.click(screen.getByRole('tab', { name: 'Joining' }));
        fireEvent.click(screen.getByRole('button', { name: 'Discard edits' }));
        await waitFor(() => expect(screen.getByRole('tab', { name: 'Joining' })).toHaveAttribute('aria-selected', 'true'));
    });

    it('asks before Coach Hub drops a responsibility request draft', () => {
        render(<MemoryRouter initialEntries={['/?tab=coach-hub&hub=responsibilities']}><CoachHub clubId={1} roles={roles} boot={null} focus={focus([coaching])} events={[]}
            onOpenCalendar={vi.fn()} onOpenEvent={vi.fn()} onOpen={vi.fn()} onChanged={vi.fn()} /></MemoryRouter>);
        fireEvent.click(screen.getByRole('button', { name: 'Ask for this' }));
        fireEvent.change(screen.getByLabelText('Message to your club admin (optional)'), { target: { value: 'Match analysis on Saturdays' } });
        fireEvent.click(screen.getByRole('tab', { name: 'My week' }));
        expect(screen.getByRole('group', { name: 'Discard edits' })).toBeInTheDocument();
        expect(screen.getByLabelText('Message to your club admin (optional)')).toHaveValue('Match analysis on Saturdays');
        expect(screen.getByRole('tab', { name: 'Responsibilities' })).toHaveAttribute('aria-selected', 'true');
    });

    it('opens an old responsibilities link on the right Coach Hub tab at once', () => {
        render(<MemoryRouter initialEntries={['/?tab=my-role']}><CoachHub clubId={1} roles={roles} boot={null} focus={focus([coaching])} events={[]} legacyHub="responsibilities"
            onOpenCalendar={vi.fn()} onOpenEvent={vi.fn()} onOpen={vi.fn()} onChanged={vi.fn()} /></MemoryRouter>);
        expect(screen.getByRole('tab', { name: 'Responsibilities' })).toHaveAttribute('aria-selected', 'true');
    });
});

describe('Coach Hub follows the responsibilities switched on', () => {
    it('leaves out squads whose responsibility is switched off and offers to show them again', () => {
        const hidden = focus([]);
        render(<MemoryRouter><CoachHub clubId={1} roles={roles} boot={null} focus={{ ...hidden, available: [coaching] }} events={[]}
            onOpenCalendar={vi.fn()} onOpenEvent={vi.fn()} onOpen={vi.fn()} onChanged={vi.fn()} /></MemoryRouter>);
        expect(screen.queryByText('U12')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Show all my responsibilities' }));
        expect(hidden.showAll).toHaveBeenCalled();
    });
});

describe('records', () => {
    it('never marks a closed record overdue', () => {
        render(<MemoryRouter><RecordTable boot={boot} home={false} sort={null} onSort={vi.fn()} hrefFor={() => '#'} onOpen={vi.fn()} records={[
            record({ id: 1, title: 'Wrist fracture', status: 'CLEARED', due_on: '2020-09-28' }),
            record({ id: 2, title: 'Ankle sprain', status: 'ACTIVE', due_on: '2020-09-28' }),
        ]} /></MemoryRouter>);
        expect(within(screen.getByRole('row', { name: /Wrist fracture/ })).queryByText(/overdue/)).toBeNull();
        expect(within(screen.getByRole('row', { name: /Ankle sprain/ })).getByText(/overdue/)).toBeInTheDocument();
    });

    it('styles actions by what they do and confirms one that stops the record', async () => {
        const changed = vi.fn().mockResolvedValue(undefined);
        render(<MemoryRouter><RecordDetail club={1} boot={boot} record={record({ status: 'PENDING', transitions: ['REVOKED', 'GRANTED'] })} definition={definition} backLabel="Back" onEdit={vi.fn()} onChanged={changed} onClose={vi.fn()} /></MemoryRouter>);
        expect(screen.getByRole('button', { name: 'Give permission' })).toHaveClass('gk-btn--primary');
        expect(screen.getByRole('button', { name: 'Withdraw permission' })).toHaveClass('gk-btn--danger');
        fireEvent.click(screen.getByRole('button', { name: 'Withdraw permission' }));
        const confirm = screen.getByRole('alertdialog');
        expect(apiClient.post).not.toHaveBeenCalled();
        fireEvent.click(within(confirm).getByRole('button', { name: 'Withdraw permission' }));
        await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/clubs/1/operations/records/5/transition', { status: 'REVOKED', revision: 2, note: null }));
    });
});

describe('the way back', () => {
    const origin = { label: 'Back to Coach Hub', onBack: vi.fn() };
    it('sends a record opened from Coach Hub back to Coach Hub', async () => {
        render(<MemoryRouter initialEntries={['/?tab=guardians&record=5&squad=11']}><WorkspaceOperations boot={boot} module="GUARDIANS" onRefresh={vi.fn()} origin={origin} /></MemoryRouter>);
        await screen.findByRole('heading', { name: 'Photo permission' });
        fireEvent.click(screen.getByRole('button', { name: 'Back to Coach Hub' }));
        expect(origin.onBack).toHaveBeenCalled();
    });

    it('sends a record opened from the tool’s own list back to that list', async () => {
        render(<MemoryRouter initialEntries={['/?tab=guardians&record=5&from=list']}><WorkspaceOperations boot={boot} module="GUARDIANS" onRefresh={vi.fn()} origin={origin} /></MemoryRouter>);
        await screen.findByRole('heading', { name: 'Photo permission' });
        expect(screen.getByRole('button', { name: 'Back to guardians & permissions' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Back to Coach Hub' })).not.toBeInTheDocument();
    });

    it('shows no way back without an origin, even with a squad in the address', async () => {
        render(<MemoryRouter initialEntries={['/?tab=guardians&squad=11']}><WorkspaceOperations boot={boot} module="GUARDIANS" onRefresh={vi.fn()} /></MemoryRouter>);
        await screen.findByRole('heading', { name: 'Guardians & permissions' });
        expect(screen.queryByRole('button', { name: /^Back to/ })).not.toBeInTheDocument();
    });
});
