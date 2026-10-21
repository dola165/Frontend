import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RecordDetail } from './RecordDetail';
import { WorkspaceOperations } from './WorkspaceOperations';
import { setStoredAccessToken } from '../../utils/authStorage';
import type { Bootstrap, OperationRecord } from './api';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock('../../api/axiosConfig', () => ({ apiClient: api }));
const definition = { module: 'STAFF', kind: 'DUTY', label: 'Staff duty', states: ['ASSIGNED', 'CONFIRMED'], fields: [] };
const boot: Bootstrap = { clubId: 400, clubName: 'New academy', actorId: 9500, leadership: true, definitions: [definition], specialisations: [], permissions: [],
    settings: { setting: 'COMMUNITY', playing_level: 'AMATEUR', enabled_modules: ['STAFF'], revision: 0 }, modules: [{ id: 'STAFF', writable: true, globalWrite: true, writeSquads: [] }],
    squads: [], people: [], staff: [], guardians: [], events: [], sessions: [], venues: [], links: [] };
const record: OperationRecord = { id: 81, club_id: 400, module: 'STAFF', kind: 'DUTY', title: 'Open the ground', status: 'ASSIGNED', revision: 0, data: {},
    squad_id: null, subject_user_id: null, assigned_user_id: null, event_id: null, session_id: null, related_record_id: null, due_on: null, canEdit: true,
    transitions: ['CONFIRMED'], created_at: '2026-10-17', updated_at: '2026-10-17' };
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); api.get.mockReset().mockResolvedValue({ data: [] }); api.post.mockReset().mockResolvedValue({ data: { ...record, status: 'CONFIRMED', revision: 1 } }); api.put.mockReset(); });
afterEach(cleanup);
function detail(onChanged = vi.fn().mockResolvedValue(undefined)) {
    return { ...render(<MemoryRouter><RecordDetail club={400} boot={boot} record={record} definition={definition} backLabel="Back" onChanged={onChanged} onEdit={vi.fn()} onClose={vi.fn()} /></MemoryRouter>), onChanged };
}
it('keeps a confirmed action and retries only refresh after the view fails to reload', async () => {
    const refresh = vi.fn().mockRejectedValueOnce(new Error('Refresh offline')).mockResolvedValue(undefined); detail(refresh);
    fireEvent.change(screen.getByLabelText(/Decision or action note/), { target: { value: 'Ground ready' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mark as confirmed' }));
    await screen.findByText('Change saved. The current view could not refresh.');
    expect(screen.getByText('Change saved: Open the ground · #81')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Mark as confirmed' })).toBeDisabled();
    expect(screen.getByLabelText(/Decision or action note/)).toHaveValue('Ground ready');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh saved record' }));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));
    expect(api.post).toHaveBeenCalledTimes(1); expect(api.put).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenLastCalledWith({ id: 81, title: 'Open the ground' });
    expect(api.post.mock.calls[0][1]).toEqual({ status: 'CONFIRMED', revision: 0, note: 'Ground ready' });
    expect(api.post.mock.calls[0][2].headers).toBeUndefined();
});
it('retains a refused action as editable and does not claim it was saved', async () => {
    api.post.mockRejectedValueOnce({ response: { status: 422, data: { message: 'Decision refused' } } }); const { onChanged } = detail();
    fireEvent.change(screen.getByLabelText(/Decision or action note/), { target: { value: 'Please check' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mark as confirmed' })); await screen.findByText('Decision refused');
    expect(screen.getByLabelText(/Decision or action note/)).toHaveValue('Please check');
    expect(screen.getByRole('button', { name: 'Mark as confirmed' })).toBeEnabled();
    expect(screen.queryByText(/^Change saved:/)).not.toBeInTheDocument(); expect(onChanged).not.toHaveBeenCalled();
});
it('sends one action while repeated clicks await its response', async () => {
    let resolve!: (value: { data: OperationRecord }) => void; api.post.mockImplementationOnce(() => new Promise(yes => { resolve = yes; })); detail();
    const confirm = screen.getByRole('button', { name: 'Mark as confirmed' });
    act(() => { fireEvent.click(confirm); fireEvent.click(confirm); });
    expect(api.post).toHaveBeenCalledTimes(1);
    await act(async () => { resolve({ data: { ...record, status: 'CONFIRMED', revision: 1 } }); });
    expect(screen.getByText('Change saved: Open the ground · #81')).toBeVisible();
});
it('passes the known identity through a successful refresh followed by a failed list read', async () => {
    let lists = 0;
    api.get.mockImplementation((url: string) => {
        if (url.includes('/workspace-roles/work?')) return ++lists === 2 ? Promise.reject({ response: { status: 503, data: { message: 'List unavailable' } } }) : Promise.resolve({ data: [] });
        return Promise.resolve({ data: url === '/clubs/400/operations/records/81' ? record : [] });
    });
    render(<MemoryRouter initialEntries={['/?tab=staff-duties&record=81']}><WorkspaceOperations boot={boot} module="STAFF" onRefresh={vi.fn().mockResolvedValue(undefined)} /></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Open the ground' }); await waitFor(() => expect(lists).toBe(1));
    fireEvent.click(screen.getByRole('button', { name: 'Mark as confirmed' })); await screen.findByText('List unavailable');
    expect(screen.getByText('Saved: Open the ground · #81')).toBeVisible(); expect(screen.getByRole('button', { name: 'Open record' })).toBeEnabled();
    expect(api.post).toHaveBeenCalledTimes(1);
});
it('refuses the previous account session before sending an action', async () => {
    detail(); act(() => setStoredAccessToken('synthetic-next-account-token'));
    fireEvent.click(screen.getByRole('button', { name: 'Mark as confirmed' })); await screen.findByRole('alert');
    expect(api.post).not.toHaveBeenCalled(); expect(screen.queryByText(/^Change saved:/)).not.toBeInTheDocument();
});
