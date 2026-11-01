import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ClubJobWorkspacePage from '../../../pages/ClubJobWorkspacePage';
import { useClubEditorClose } from '../../clubOperations/useClubEditorClose';
import { announceAccessRefresh } from '../../../hooks/accessRefresh';
import type { WorkspaceOperations } from '../../clubOperations/WorkspaceOperations';
import { bootstrap, desk, manifest, moduleScope, roles } from './fixtures';
import type { JobWorkspaceManifest } from '../types';

const mocks = vi.hoisted(() => ({ get: vi.fn(), refreshBoot: vi.fn(), refreshRoles: vi.fn(), tool: vi.fn(), travel: vi.fn(), scout: vi.fn() }));
const auth = vi.hoisted(() => ({ isAuthenticated: true, sessionId: 'desk-session', user: { id: 9 } }));
const loads = vi.hoisted(() => ({ boot: null as unknown, roles: null as unknown, bootError: '', rolesError: '', loading: false }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get: mocks.get } }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../clubOperations/useClubOperations', () => ({ useClubOperations: () => ({ boot: loads.boot, loading: loads.loading, error: loads.bootError, refresh: mocks.refreshBoot }) }));
vi.mock('../../clubOperations/useWorkspaceRoles', () => ({ useWorkspaceRoles: () => ({ data: loads.roles, loading: loads.loading, error: loads.rolesError, refresh: mocks.refreshRoles }) }));
vi.mock('../../clubOperations/WorkspaceOperations', () => ({ WorkspaceOperations: (props: Parameters<typeof WorkspaceOperations>[0]) => { mocks.tool(props); return <CanonicalTool {...props} />; } }));
vi.mock('../../travel/TravelWorkspace', () => ({ TravelWorkspace: (props: unknown) => { mocks.travel(props); return <div>Canonical travel coordinator</div>; } }));
vi.mock('../../scouting/Scouting', () => ({ Scouting: (props: unknown) => { mocks.scout(props); return <div>Canonical scouting records</div>; } }));

function CanonicalTool({ module, origin }: Parameters<typeof WorkspaceOperations>[0]) {
    const [params] = useSearchParams();
    const [draft, setDraft] = useState('');
    const guard = useClubEditorClose(Boolean(draft), false, () => undefined);
    return <section aria-label="Canonical operations"><h1>Canonical {module}</h1><span>record={params.get('record')} session={params.get('session')} person={params.get('person')}</span>
        <label>Draft<input value={draft} onChange={event => setDraft(event.target.value)} /></label><button onClick={origin?.onBack}>{origin?.label}</button>{guard.confirmation}</section>;
}
function Location() { const location = useLocation(); const navigate = useNavigate(); return <><output data-testid="location">{location.pathname}{location.search}</output><button onClick={() => navigate('/clubs/8/work/money?tool=finance')}>Other club</button></>; }
function App({ path }: { path: string }) { return <MemoryRouter initialEntries={[path]}><Location /><Routes>
    <Route path="/clubs/:id/work/:workspace?" element={<ClubJobWorkspacePage />} />
    <Route path="/my-squads" element={<h1>Existing My squads</h1>} />
    <Route path="/requests" element={<h1>Existing Inbox</h1>} />
    <Route path="/clubs/:id/office" element={<h1>Existing Club office</h1>} />
</Routes></MemoryRouter>; }
const start = (path = '/clubs/7/work') => render(<App path={path} />);
let response: JobWorkspaceManifest;
const record = () => ({ id: 18, club_id: 7, module: 'FINANCE', title: 'Recorded training fee', status: 'DUE', squad_id: 2, due_on: '2026-11-02' });

beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear();
    auth.isAuthenticated = true; auth.sessionId = 'desk-session'; auth.user = { id: 9 };
    localStorage.setItem('gk-session-id', auth.sessionId);
    response = manifest(); loads.boot = bootstrap(); loads.roles = roles(); loads.bootError = ''; loads.rolesError = ''; loads.loading = false;
    mocks.refreshBoot.mockResolvedValue(undefined);
    mocks.get.mockImplementation(async (url: string) => ({ data: url.endsWith('/job-workspaces') ? response : [record()] }));
});
afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); });

it('keeps prototype destinations in a closed explicit preview and multiple jobs share one destination', async () => {
    const money = desk(); money.jobTitles = ['Fees officer', 'Treasurer'];
    const office = { ...desk('office', []), title: 'Club office', maturity: 'working' as const, path: '/clubs/7/office' };
    response = manifest([office, money]); start();
    const summary = await screen.findByText('Preview job workspaces');
    expect(summary.closest('details')).not.toHaveAttribute('open');
    const preview = within(summary.closest('details')!);
    expect(preview.getAllByRole('link', { hidden: true })).toHaveLength(1);
    expect(preview.getByText('Fees officer')).toBeInTheDocument(); expect(preview.getByText('Treasurer')).toBeInTheDocument();
    fireEvent.click(summary);
    fireEvent.click(screen.getByRole('link', { name: /Money Fees officer.*Treasurer/ }));
    await screen.findByRole('heading', { name: 'Money' });
    expect(await screen.findByText('Recorded training fee')).toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledWith('/clubs/7/job-workspaces', expect.objectContaining({ _authSessionId: 'desk-session' }));
});

it('shows failure and retry separately from a confirmed empty manifest', async () => {
    mocks.get.mockRejectedValueOnce({ response: { status: 503, data: { detail: 'Responsibilities unavailable' } } }); start();
    expect(await screen.findByRole('alert')).toHaveTextContent('Responsibilities unavailable');
    expect(screen.queryByText(/No workspaces are available/)).not.toBeInTheDocument();
    response = manifest([]); fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('No workspaces are available for your current responsibilities')).toBeInTheDocument();
});

it('does not expose a tool from the URL, job title or a different desk', async () => {
    response.workspaces[0].jobTitles = ['Owner', 'Doctor']; start('/clubs/7/work/money?tool=medical&record=88');
    await screen.findByText('This tool is not available in this workspace');
    expect(mocks.tool).not.toHaveBeenCalled();
    cleanup(); start('/clubs/7/work/unassigned?tool=finance');
    await screen.findByText('This workspace is not available for your current responsibilities');
    expect(mocks.tool).not.toHaveBeenCalled();
});

it.each([
    ['money', 'FINANCE', 'finance'], ['registration', 'REGISTRATION', 'registration'], ['kit', 'EQUIPMENT', 'equipment'], ['facilities', 'FACILITIES', 'facilities'],
] as const)('%s mounts the canonical tool with its exact module and deep source context', async (key, module, tool) => {
    response = manifest([desk(key, [moduleScope(module)])]); start(`/clubs/7/work/${key}?tool=${tool}&record=18&squad=2&session=6&person=4&source=fixture`);
    await screen.findByRole('heading', { name: `Canonical ${module}` });
    const props = mocks.tool.mock.calls.at(-1)![0] as Parameters<typeof WorkspaceOperations>[0];
    expect(props.boot.modules.find(m => m.id === module)).toMatchObject({ globalRead: false, globalWrite: false, readSquads: [2], writeSquads: [2] });
    expect(screen.getByText('record=18 session=6 person=4')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to overview' }));
    await screen.findByRole('heading', { name: response.workspaces[0].title });
    expect(screen.getByTestId('location')).toHaveTextContent('session=6');
    expect(screen.getByTestId('location')).toHaveTextContent('source=fixture');
    expect(screen.getByTestId('location')).not.toHaveTextContent('record=18');
});

it('travel uses its canonical coordinator for writers and canonical operation records for read-only/deep links', async () => {
    response = manifest([desk('travel', [moduleScope('TRAVEL')])]); start('/clubs/7/work/travel?tool=travel&squad=2');
    await screen.findByText('Canonical travel coordinator'); expect(mocks.travel).toHaveBeenCalledWith({ clubId: 7, squadId: 2 });
    cleanup(); response = manifest([desk('travel', [moduleScope('TRAVEL', { writeSquadIds: [] })])]); start('/clubs/7/work/travel?tool=travel&record=18&squad=2');
    await screen.findByRole('heading', { name: 'Canonical TRAVEL' });
    expect(mocks.tool.mock.calls.at(-1)![0].boot.modules.find((m: { id: string }) => m.id === 'TRAVEL').writable).toBe(false);
});

it('scouting mounts its independently authorized canonical component without requiring operations bootstrap', async () => {
    loads.bootError = 'Operations unavailable'; response = manifest([desk('scouting', [moduleScope('SCOUTING')])]); start('/clubs/7/work/scouting?tool=scouting&squad=2&prospect=18');
    await screen.findByText('Canonical scouting records');
    expect(mocks.scout).toHaveBeenCalledWith({ clubId: 7, sessionId: 'desk-session' });
});

it('canonical links and the shell respect unsaved edits before navigating', async () => {
    start('/clubs/7/work/money?tool=finance&record=18&squad=2'); await screen.findByRole('heading', { name: 'Canonical FINANCE' });
    fireEvent.change(screen.getByLabelText('Draft'), { target: { value: 'An unfinished record' } });
    fireEvent.click(screen.getByRole('link', { name: 'Inbox' }));
    await screen.findByRole('group', { name: 'Discard edits' });
    fireEvent.click(screen.getByRole('button', { name: /Keep editing/ }));
    expect(screen.getByLabelText('Draft')).toHaveValue('An unfinished record');
    fireEvent.click(screen.getByRole('button', { name: 'Back to overview' }));
    await screen.findByRole('group', { name: 'Discard edits' }); fireEvent.click(screen.getByRole('button', { name: /Discard/ }));
    await screen.findByRole('heading', { name: 'Money' });
});

it('does not aggregate private care or send another module’s squad scope to it', async () => {
    response = manifest([desk('shared', [moduleScope('FINANCE', { globalRead: true }), moduleScope('MEDICAL')])]); start('/clubs/7/work/shared');
    await screen.findByText('Private care and concerns open in their own permitted tool. They are not included in the shared overview.');
    expect(mocks.get.mock.calls.filter(([url]) => String(url).includes('module=MEDICAL'))).toHaveLength(0);
    cleanup(); start('/clubs/7/work/shared?tool=medical&squad=3'); await screen.findByText('This squad is outside this tool’s current scope');
    expect(mocks.tool).not.toHaveBeenCalled();
});

it('gates the mounted tool during revalidation and retires it on confirmed access refusal', async () => {
    start('/clubs/7/work/money?tool=finance'); await screen.findByRole('heading', { name: 'Canonical FINANCE' });
    const tool = screen.getByRole('heading', { name: 'Canonical FINANCE' });
    mocks.get.mockRejectedValueOnce({ response: { status: 403, data: { detail: 'Current job ended' } } });
    act(() => announceAccessRefresh());
    expect(tool).toBeInTheDocument(); expect(tool).not.toBeVisible();
    expect(await screen.findByRole('alert')).toHaveTextContent('Current job ended');
    expect(tool).not.toBeInTheDocument();
});

it('rejects bootstrap identity mismatches and load errors instead of calling them missing authority', async () => {
    loads.boot = { ...bootstrap(), actorId: 10 }; start('/clubs/7/work/money?tool=finance');
    await screen.findByText('Could not confirm this tool’s account and club context.'); expect(mocks.tool).not.toHaveBeenCalled();
    cleanup(); loads.boot = bootstrap(); loads.bootError = 'Could not load responsibilities'; start('/clubs/7/work/money?tool=finance');
    await screen.findByRole('alert'); fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(mocks.refreshBoot).toHaveBeenCalled(); expect(mocks.refreshRoles).toHaveBeenCalled();
});

it('switching club hides old records before the replacement manifest resolves', async () => {
    start('/clubs/7/work/money?tool=finance'); await screen.findByRole('heading', { name: 'Canonical FINANCE' });
    mocks.get.mockImplementation(() => new Promise(() => undefined)); fireEvent.click(screen.getByRole('button', { name: 'Other club' }));
    expect(screen.queryByRole('heading', { name: 'Canonical FINANCE' })).not.toBeInTheDocument();
    await screen.findByRole('status', { name: 'Loading your club workspaces' });
});

it('a new login for the same actor retires editors and late old-session metadata', async () => {
    let resolveOld!: (value: unknown) => void;
    mocks.get.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
    const view = start('/clubs/7/work/money?tool=finance');
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(1));
    auth.sessionId = 'new-desk-session'; localStorage.setItem('gk-session-id', auth.sessionId);
    response = manifest([]);
    act(() => window.dispatchEvent(new Event('gk-auth-changed')));
    view.rerender(<App path="/clubs/7/work/money?tool=finance" />);
    await screen.findByText('This workspace is not available for your current responsibilities');
    await act(async () => { resolveOld({ data: manifest() }); });
    expect(screen.queryByRole('heading', { name: 'Canonical FINANCE' })).not.toBeInTheDocument();
});

it('a new session of the same actor starts without the former editor’s draft', async () => {
    const view = start('/clubs/7/work/money?tool=finance'); await screen.findByLabelText('Draft');
    fireEvent.change(screen.getByLabelText('Draft'), { target: { value: 'Old login draft' } });
    auth.sessionId = 'second-login'; localStorage.setItem('gk-session-id', auth.sessionId);
    act(() => window.dispatchEvent(new Event('gk-auth-changed')));
    view.rerender(<App path="/clubs/7/work/money?tool=finance" />);
    await screen.findByLabelText('Draft'); expect(screen.getByLabelText('Draft')).toHaveValue('');
});

it('storage changes hide the desk while AuthContext is still resolving the next account', async () => {
    start('/clubs/7/work/money?tool=finance'); await screen.findByLabelText('Draft');
    localStorage.setItem('gk-session-id', 'unresolved-login');
    act(() => window.dispatchEvent(new Event('gk-auth-changed')));
    expect(screen.queryByLabelText('Draft')).not.toBeInTheDocument();
});

it('rejects source rows from another club and leaves current work retryable', async () => {
    mocks.get.mockImplementation(async (url: string) => ({ data: url.endsWith('/job-workspaces') ? response : [{ ...record(), club_id: 8, title: 'Other club record' }] }));
    start('/clubs/7/work/money'); await screen.findByText('Could not load current work.');
    expect(screen.queryByText('Other club record')).not.toBeInTheDocument();
    mocks.get.mockResolvedValue({ data: [record()] }); fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('Recorded training fee');
});

it('keeps a verified coach-origin record’s canonical return destination', async () => {
    const current = roles(); current.views = [{ ...current.current, id: 'coach', onSquads: true, squadIds: [2] }]; loads.roles = current;
    start('/clubs/7/work/money?tool=finance&record=18&squad=2&coachReturn=my-squads&coachClub=7');
    fireEvent.click(await screen.findByRole('button', { name: 'Back to My squads' }));
    await screen.findByRole('heading', { name: 'Existing My squads' });
    expect(screen.getByTestId('location')).toHaveTextContent('/my-squads?clubId=7');
});

it('existing squads remain a canonical destination and carry the original record context', async () => {
    response = manifest([{ ...desk('squads', []), title: 'My squads', path: '/my-squads?clubId=7', maturity: 'working' }]);
    start('/clubs/7/work/squads?squad=2&session=6&person=4'); await screen.findByRole('heading', { name: 'Existing My squads' });
    expect(screen.getByTestId('location')).toHaveTextContent('/my-squads?squad=2&session=6&person=4&clubId=7');
});
