import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { FacilityProjectAction } from './FacilityProjectAction';
import { ProjectFacilityOutcome } from './ProjectFacilityOutcome';
import { useProject } from './useProjects';
import { openFacilityProject } from './facilityProjectApi';
import { clearStoredAuth } from '../../utils/authStorage';
import { RecordDetail } from '../clubOperations/RecordDetail';
import type { Bootstrap, OperationRecord } from '../clubOperations/api';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../../api/axiosConfig', () => ({ apiClient: api }));
vi.mock('../squadCommunication/journeyCopy', () => ({ useJourneyCopy: () => (en: string) => en }));
const source = { id: 81, title: 'Pitch 1 net repair', status: 'SCHEDULED', outcome: null, revision: 0,
    canRecordOutcome: true, href: '/clubs/400/office?tab=tools&tool=facilities&record=81' };
beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('gk-session-id', crypto.randomUUID());
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
});
afterEach(cleanup);
const showSource = () => render(<MemoryRouter><ProjectFacilityOutcome club={400} project={5} version={1} /></MemoryRouter>);

it('finds the project after an uncertain create using a read, and offers the exact existing destination', async () => {
    api.get.mockResolvedValueOnce({ data: { projectId: null, canStart: true } })
        .mockResolvedValue({ data: { projectId: 5, canStart: true } });
    api.post.mockRejectedValueOnce(new Error('Response lost'));
    render(<MemoryRouter><FacilityProjectAction club={400} task={81} /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Start project' }));
    expect(await screen.findByRole('link', { name: 'Open project' })).toHaveAttribute('href', '/projects/5');
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post.mock.calls[0][0]).toBe('/clubs/400/projects/facility-tasks/81');
    expect(api.post.mock.calls[0][1]).toEqual({ language: 'en' });
});

it('retains one source command identity beyond ten seconds and module reload, and isolates sessions', async () => {
    api.post.mockRejectedValue(new Error('Response lost'));
    await expect(openFacilityProject(400, 82, 'en')).rejects.toThrow();
    const first = api.post.mock.calls[0][2].headers['Idempotency-Key'];
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_000);
    vi.resetModules();
    const reloaded = await import('./facilityProjectApi');
    await expect(reloaded.openFacilityProject(400, 82, 'en')).rejects.toThrow();
    expect(api.post.mock.calls[1][2].headers['Idempotency-Key']).toBe(first);
    localStorage.setItem('gk-session-id', crypto.randomUUID());
    await expect(reloaded.openFacilityProject(400, 82, 'en')).rejects.toThrow();
    expect(api.post.mock.calls[2][2].headers['Idempotency-Key']).not.toBe(first);
    expect([...Object.values(sessionStorage)].every(value => /^[0-9a-f-]{36}$/.test(value))).toBe(true);
    clearStoredAuth();
    expect(sessionStorage.length).toBe(0);
    clock.mockRestore();
});

it('shows the source outcome separately from project changes and refreshes only the source read', async () => {
    api.get.mockResolvedValue({ data: source });
    const view = showSource();
    expect(await screen.findByText('Outcome still to record')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Record actual outcome' })).toHaveAttribute('href', source.href);
    view.rerender(<MemoryRouter><ProjectFacilityOutcome club={400} project={5} version={2} /></MemoryRouter>);
    expect(await screen.findByText('Outcome still to record')).toBeVisible();
    api.get.mockResolvedValue({ data: { ...source, status: 'COMPLETED', outcome: 'Net repaired and checked', revision: 1, canRecordOutcome: false } });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh facilities status' }));
    expect(await screen.findByText('Completed at source')).toBeVisible();
    expect(screen.getByText('Net repaired and checked')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Open facilities task' })).toHaveAttribute('href', source.href);
    expect(api.post).not.toHaveBeenCalled();
});

it('clears previously visible source facts after revoked access and after a failed refresh', async () => {
    api.get.mockResolvedValue({ data: source });
    showSource();
    await screen.findByText(source.title);
    api.get.mockRejectedValueOnce({ response: { status: 404 } });
    fireEvent.focus(window);
    await screen.findByRole('alert');
    expect(screen.queryByText(source.title)).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    api.get.mockResolvedValue({ data: null });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh facilities status' }));
    await waitFor(() => expect(screen.queryByRole('region')).not.toBeInTheDocument());
    expect(document.body).not.toHaveTextContent('81');
});

it('renders no source details or URL for unlinked legacy projects or collaborators lacking facilities access', async () => {
    api.get.mockResolvedValue({ data: null });
    showSource();
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText('Facilities outcome')).not.toBeInTheDocument();
});

it('retires delayed source reads when the login changes', async () => {
    let resolve!: (value: unknown) => void;
    api.get.mockImplementationOnce(() => new Promise(done => { resolve = done; })).mockResolvedValue({ data: null });
    showSource();
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
    await act(async () => {
        localStorage.setItem('gk-session-id', crypto.randomUUID()); window.dispatchEvent(new Event('gk-auth-changed'));
        resolve({ data: source });
    });
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(source.title)).not.toBeInTheDocument();
});

it('removes the already opened project when a current project reread denies access', async () => {
    api.get.mockResolvedValue({ data: { summary: { id: 5, goal: 'Facilities work' } } });
    const hook = renderHook(() => useProject(5));
    await waitFor(() => expect(hook.result.current.data?.summary.id).toBe(5));
    api.get.mockRejectedValue({ response: { status: 404 } });
    act(() => fireEvent.focus(window));
    await waitFor(() => expect(hook.result.current.notFound).toBe(true));
    expect(hook.result.current.data).toBeNull();
});

it('keeps an unsaved source action note when opening the project is cancelled', async () => {
    const boot: Bootstrap = {
        clubId: 400, clubName: 'Dinamo synthetic', actorId: 9500, leadership: true, definitions: [], specialisations: [], permissions: [],
        settings: { setting: 'COMMUNITY', playing_level: 'AMATEUR', enabled_modules: ['FACILITIES'], revision: 0 },
        modules: [{ id: 'FACILITIES', writable: true, globalWrite: true, writeSquads: [] }],
        squads: [], people: [], staff: [], guardians: [], events: [], sessions: [], venues: [], links: [],
    };
    const record: OperationRecord = {
        id: 81, club_id: 400, module: 'FACILITIES', kind: 'FACILITY_TASK', title: 'Ground work', status: 'SCHEDULED', data: {}, revision: 0,
        squad_id: null, subject_user_id: null, assigned_user_id: null, event_id: null, session_id: null, related_record_id: null, due_on: null,
        canEdit: true, transitions: ['COMPLETED', 'CANCELLED'], created_at: '2026-10-31', updated_at: '2026-10-31',
    };
    api.get.mockImplementation((path: string) => Promise.resolve({ data: path.includes('/facility-tasks/') ? { projectId: 5, canStart: true } : [] }));
    render(<MemoryRouter><RecordDetail club={400} boot={boot} record={record} definition={{ module: 'FACILITIES', kind: 'FACILITY_TASK', label: 'Ground work', states: [], fields: [] }}
        backLabel="Facilities" onChanged={vi.fn()} onEdit={vi.fn()} onClose={vi.fn()} /></MemoryRouter>);
    const note = screen.getByRole('textbox', { name: /Decision or action note/ });
    fireEvent.change(note, { target: { value: 'Keep this unsaved outcome note' } });
    fireEvent.click(await screen.findByRole('link', { name: 'Open project' }));
    expect(await screen.findByRole('group', { name: 'Discard edits' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(note).toHaveValue('Keep this unsaved outcome note');
    expect(api.post).not.toHaveBeenCalled();
});
