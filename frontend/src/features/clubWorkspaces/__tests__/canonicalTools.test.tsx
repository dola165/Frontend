import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { WorkspaceTool } from '../WorkspaceTool';
import { workspaceTools } from '../registry';
import { bootstrap, desk, manifest, moduleScope, roles } from './fixtures';

const mocks = vi.hoisted(() => ({ get: vi.fn(), boot: null as unknown, roles: null as unknown }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get: mocks.get } }));
vi.mock('../../clubOperations/useClubOperations', () => ({ useClubOperations: () => ({ boot: mocks.boot, loading: false, error: '', refresh: async () => undefined }) }));
vi.mock('../../clubOperations/useWorkspaceRoles', () => ({ useWorkspaceRoles: () => ({ data: mocks.roles, loading: false, error: '', refresh: () => undefined }) }));

beforeEach(() => {
    vi.clearAllMocks(); localStorage.setItem('gk-session-id', 'canonical-desk');
    mocks.boot = bootstrap(); mocks.roles = roles();
    mocks.get.mockImplementation(async (url: string) => {
        if (url.startsWith('/clubs/7/workspace-roles/work?') || url.endsWith('/finance-summary') || url.endsWith('/kit-stock')) return { data: [] };
        if (url === '/clubs/7/registration/people/4') return { data: { clubId: 7, personId: 4, squadId: 2, asOf: '2026-10-31', currentPlayer: true, staff: true, canCreate: false, records: [], affiliations: [], departurePath: null } };
        if (url === '/travel/context?clubId=7&squadId=2') return { data: { relevant: true, events: [], plans: [] } };
        if (url === '/clubs/7/scouting/scope') return { data: { clubWide: false, squads: [{ id: 2, name: 'U14' }] } };
        if (url.startsWith('/clubs/7/scouting?')) return { data: { items: [], page: 0, hasMore: false } };
        throw new Error('Unexpected canonical API request: ' + url);
    });
});
afterEach(() => { cleanup(); localStorage.clear(); });

it.each([
    ['money', 'FINANCE', 'Finance', '/clubs/7/operations/finance-summary'],
    ['kit', 'EQUIPMENT', 'Equipment', '/clubs/7/operations/kit-stock'],
    ['facilities', 'FACILITIES', 'Grounds & facilities', '/clubs/7/workspace-roles/work?module=FACILITIES'],
] as const)('%s loads the real canonical tool and its domain source', async (key, module, title, source) => {
    const workspace = desk(key, [moduleScope(module)]), tool = workspaceTools(workspace)[0];
    render(<MemoryRouter initialEntries={[`/clubs/7/work/${key}?tool=${tool.id}&squad=2`]}><WorkspaceTool manifest={manifest([workspace])} workspace={workspace} tool={tool} session="canonical-desk" /></MemoryRouter>);
    await screen.findByRole('heading', { name: title });
    await screen.findByText('No matching records');
    expect(mocks.get.mock.calls.some(([url]) => String(url).startsWith(source))).toBe(true);
});

it('registration uses the real eligibility panel with the selected player and squad', async () => {
    const workspace = desk('registration', [moduleScope('REGISTRATION')]);
    render(<MemoryRouter initialEntries={['/clubs/7/work/registration?tool=registration&person=4&squad=2']}><WorkspaceTool manifest={manifest([workspace])} workspace={workspace} tool={workspaceTools(workspace)[0]} session="canonical-desk" /></MemoryRouter>);
    await screen.findByText('Eligibility unknown');
    expect(mocks.get).toHaveBeenCalledWith('/clubs/7/registration/people/4', expect.objectContaining({ params: { squad: 2 }, _authSessionId: 'canonical-desk' }));
    expect(screen.queryByRole('button', { name: 'Back to overview' })).not.toBeInTheDocument();
});

it('travel uses the real event-based coordinator without creating a second event', async () => {
    const workspace = desk('travel', [moduleScope('TRAVEL')]);
    render(<MemoryRouter initialEntries={['/clubs/7/work/travel?tool=travel&squad=2']}><WorkspaceTool manifest={manifest([workspace])} workspace={workspace} tool={workspaceTools(workspace)[0]} session="canonical-desk" /></MemoryRouter>);
    await screen.findByText('No upcoming events in your travel scope');
    expect(mocks.get).toHaveBeenCalledWith('/travel/context?clubId=7&squadId=2', expect.objectContaining({ signal: expect.any(AbortSignal) }));
});

it('scouting uses the real scope and watch-record endpoints', async () => {
    const workspace = desk('scouting', [moduleScope('SCOUTING')]);
    render(<MemoryRouter initialEntries={['/clubs/7/work/scouting?tool=scouting&squad=2']}><WorkspaceTool manifest={manifest([workspace])} workspace={workspace} tool={workspaceTools(workspace)[0]} session="canonical-desk" /></MemoryRouter>);
    await screen.findByText('No scouting records in this scope');
    expect(mocks.get).toHaveBeenCalledWith('/clubs/7/scouting/scope', expect.objectContaining({ _authSessionId: 'canonical-desk' }));
    expect(mocks.get).toHaveBeenCalledWith('/clubs/7/scouting?squad=2&page=0', expect.objectContaining({ _authSessionId: 'canonical-desk' }));
});
