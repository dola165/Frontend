import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { apiClient } from '../../api/axiosConfig';
import { getAuthSessionId, setStoredAccessToken } from '../../utils/authStorage';
import { OfficeSettings } from '../clubOffice/OfficeSettings';
import { WorkspaceOperations } from '../clubOperations/WorkspaceOperations';
import { RecordTable } from '../clubOperations/records/RecordList';
import { RecordDetail } from '../clubOperations/RecordDetail';
import type { Bootstrap, Definition, OperationRecord } from '../clubOperations/api';
import { personalWorkspaceTarget } from '../clubOperations/workspaceStructure';
import type { ClubPresentation } from '../clubs/presentation';

vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 9, navigationCapabilities: { version: 1, workspaces: [] } }, sessionId: 'one' }) }));

const profile: ClubPresentation = { profileKind: 'ACADEMY', revision: 3, canEdit: true, canManageAffiliations: true, programmes: [], sponsors: [], affiliations: [] };
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

describe('unsaved work across Club office settings', () => {
    it('asks before going back to Settings drops public profile edits', async () => {
        vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
            if (url.startsWith('/access/') || url.endsWith('/ownership')) throw new Error('none');
            return { data: url.includes('/presentation/manage') ? profile : {} };
        });
        render(<MemoryRouter initialEntries={['/clubs/1/office?tab=settings&section=profile']}>
            <OfficeSettings clubId={1} clubName="Academy" overview={null} boot={null} onRefresh={async () => {}} />
        </MemoryRouter>);
        fireEvent.change(await screen.findByLabelText('Profile purpose'), { target: { value: 'COMMUNITY' } });
        fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
        expect(screen.getByRole('group', { name: 'Discard edits' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
        expect(screen.getByLabelText('Profile purpose')).toHaveValue('COMMUNITY');
        fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
        fireEvent.click(screen.getByRole('button', { name: 'Discard edits' }));
        expect(await screen.findByText('How players join')).toBeInTheDocument();
    });
});

describe('Coach Hub links', () => {
    it('open My squads, the coach’s own workspace, on the matching page', () => {
        expect(personalWorkspaceTarget('coach-hub', null)).toBe('/my-squads');
        expect(personalWorkspaceTarget('coach-hub', 'players')).toBe('/my-squads?tab=players');
        expect(personalWorkspaceTarget('my-role', null)).toBe('/my-squads?tab=coaches');
        expect(personalWorkspaceTarget('actions', null)).toBeNull();
    });
});

describe('records', () => {
    it('never marks a closed record overdue', () => {
        render(<MemoryRouter><RecordTable boot={boot} sort={null} onSort={vi.fn()} hrefFor={() => '#'} onOpen={vi.fn()} records={[
            record({ id: 1, title: 'Wrist fracture', status: 'CLEARED', due_on: '2020-09-28' }),
            record({ id: 2, title: 'Ankle sprain', status: 'ACTIVE', due_on: '2020-09-28' }),
        ]} /></MemoryRouter>);
        expect(within(screen.getByRole('row', { name: /Wrist fracture/ })).queryByText(/overdue/)).toBeNull();
        expect(within(screen.getByRole('row', { name: /Ankle sprain/ })).getByText(/overdue/)).toBeInTheDocument();
    });

    it('styles actions by what they do and confirms one that stops the record', async () => {
        setStoredAccessToken('workspace-guards-test-token');
        const sessionId = getAuthSessionId();
        expect(sessionId).not.toBeNull();
        const changed = vi.fn().mockResolvedValue(undefined);
        render(<MemoryRouter><RecordDetail club={1} boot={boot} record={record({ status: 'PENDING', transitions: ['REVOKED', 'GRANTED'] })} definition={definition} backLabel="Back" onEdit={vi.fn()} onChanged={changed} onClose={vi.fn()} /></MemoryRouter>);
        expect(screen.getByRole('button', { name: 'Give permission' })).toHaveClass('gk-btn--primary');
        expect(screen.getByRole('button', { name: 'Withdraw permission' })).toHaveClass('gk-btn--danger');
        fireEvent.click(screen.getByRole('button', { name: 'Withdraw permission' }));
        const confirm = screen.getByRole('alertdialog');
        expect(apiClient.post).not.toHaveBeenCalled();
        fireEvent.click(within(confirm).getByRole('button', { name: 'Withdraw permission' }));
        await waitFor(() => expect(vi.mocked(apiClient.post).mock.calls).toStrictEqual([[
            '/clubs/1/operations/records/5/transition',
            { status: 'REVOKED', revision: 2, note: null },
            { headers: undefined, _authSessionId: sessionId },
        ]]));
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
