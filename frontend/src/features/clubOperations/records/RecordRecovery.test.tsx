import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WorkspaceOperations } from '../WorkspaceOperations';
import { RecordForm } from './RecordForm';
import { useClubOperations } from '../useClubOperations';
import type { Bootstrap, OperationRecord } from '../api';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: api }));
const boot: Bootstrap = {
  clubId: 400, clubName: 'New academy', actorId: 9500, leadership: true,
  definitions: [{ module: 'EQUIPMENT', kind: 'ASSET', label: 'Equipment', states: ['ACTIVE'], fields: [] }],
  specialisations: [], permissions: [], settings: { setting: 'COMMUNITY', playing_level: 'AMATEUR', enabled_modules: ['EQUIPMENT'], revision: 0 },
  modules: [{ id: 'EQUIPMENT', writable: true, globalWrite: true, writeSquads: [] }],
  squads: [], people: [], staff: [], guardians: [], events: [], sessions: [], venues: [], links: [],
};
const record: OperationRecord = {
  id: 81, club_id: 400, module: 'EQUIPMENT', kind: 'ASSET', title: 'Match balls', status: 'ACTIVE', data: {}, revision: 0,
  squad_id: null, subject_user_id: null, assigned_user_id: null, event_id: null, session_id: null, related_record_id: null, due_on: null,
  canEdit: true, transitions: [], created_at: '2026-10-17', updated_at: '2026-10-17',
};
function Harness() {
  const operations = useClubOperations(400);
  return operations.boot && <WorkspaceOperations boot={operations.boot} module="EQUIPMENT" onRefresh={operations.refresh} />;
}
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear();
  api.get.mockImplementation((url: string) => Promise.resolve({ data: url === '/clubs/400/operations' ? boot : [] }));
  api.post.mockResolvedValue({ data: record }); api.put.mockResolvedValue({ data: { ...record, revision: 1 } });
});
afterEach(cleanup);
async function newRecord() {
  render(<MemoryRouter><Harness /></MemoryRouter>);
  fireEvent.click((await screen.findAllByRole('button', { name: 'Add equipment' }))[0]);
  fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: 'Match balls' } });
}
it('retains the saved identity when the list read fails and retries opening that identity without saving again', async () => {
  let lists = 0, reads = 0;
  api.get.mockImplementation((url: string) => {
    if (url === '/clubs/400/operations') return Promise.resolve({ data: boot });
    if (url.includes('/workspace-roles/work?')) return ++lists === 2 ? Promise.reject({ response: { status: 503, data: { message: 'List offline' } } }) : Promise.resolve({ data: lists === 1 ? [] : [record] });
    if (url === '/clubs/400/operations/records/81') return ++reads === 1 ? Promise.reject({ response: { status: 503, data: { message: 'Record read offline' } } }) : Promise.resolve({ data: record });
    return Promise.resolve({ data: [] });
  });
  await newRecord();
  await waitFor(() => expect(lists).toBe(1));
  fireEvent.click(screen.getByRole('button', { name: 'Save equipment' }));
  await screen.findByText('List offline');
  expect(screen.getByText('Saved: Match balls · #81')).toBeVisible();
  expect(api.post).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByRole('link', { name: /Match balls/ });
  fireEvent.click(screen.getByRole('button', { name: 'Open record' }));
  await screen.findByText('Record read offline');
  expect(screen.getByText('Saved: Match balls · #81')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByRole('heading', { name: 'Match balls' });
  expect(reads).toBe(2);
  expect(api.post).toHaveBeenCalledTimes(1); expect(api.put).not.toHaveBeenCalled();
  const requestConfig = api.post.mock.calls[0][2];
  expect(requestConfig.headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
});
it('keeps the confirmed identity after failed bootstrap refresh and retries only the refresh', async () => {
  await newRecord();
  api.get.mockRejectedValueOnce(new Error('Network offline'));
  fireEvent.click(screen.getByRole('button', { name: 'Save equipment' }));
  await screen.findByText('Saved: Match balls · #81');
  expect(screen.getByRole('alert')).toHaveTextContent('Record saved. The current view could not refresh.');
  expect(screen.getByRole('textbox', { name: 'Title' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Save equipment' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh saved record' }));
  await screen.findAllByRole('button', { name: 'Add equipment' });
  expect(api.post).toHaveBeenCalledTimes(1); expect(api.put).not.toHaveBeenCalled();
});
it('keeps a saved receipt and makes no second creation after repeated refresh failures', async () => {
  await newRecord(); api.get.mockRejectedValue(new Error('Unavailable'));
  fireEvent.click(screen.getByRole('button', { name: 'Save equipment' }));
  await screen.findByRole('button', { name: 'Refresh saved record' });
  fireEvent.click(screen.getByRole('button', { name: 'Refresh saved record' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh saved record' })).toBeEnabled());
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Saved: Match balls · #81')).toBeVisible();
});
it('keeps rejected answers editable and never labels a rejected create as saved', async () => {
  await newRecord(); api.post.mockRejectedValueOnce({ response: { status: 400, data: { message: 'Save rejected' } } });
  fireEvent.click(screen.getByRole('button', { name: 'Save equipment' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Match balls');
  expect(screen.getByRole('textbox', { name: 'Title' })).toBeEnabled();
  expect(screen.queryByText(/^Saved:/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save equipment' }));
  await screen.findAllByRole('button', { name: 'Add equipment' });
  expect(api.post).toHaveBeenCalledTimes(2);
});
it('does not repeat a successful edit when its follow-up refresh fails', async () => {
  const refreshed = vi.fn().mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValue(undefined);
  render(<MemoryRouter><RecordForm boot={boot} definition={boot.definitions[0]} record={record} backLabel="Back to equipment" onSaved={refreshed} onCancel={vi.fn()} /></MemoryRouter>);
  fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: 'Five match balls' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await screen.findByRole('button', { name: 'Refresh saved record' });
  fireEvent.click(screen.getByRole('button', { name: 'Refresh saved record' }));
  await waitFor(() => expect(refreshed).toHaveBeenCalledTimes(2));
  expect(api.put).toHaveBeenCalledTimes(1); expect(api.post).not.toHaveBeenCalled();
});
it('replays a lost create response with its original UUID and exact submitted body', async () => {
  await newRecord(); api.post.mockRejectedValueOnce(new Error('Response lost'));
  fireEvent.click(screen.getByRole('button', { name: 'Save equipment' }));
  await screen.findByRole('button', { name: 'Retry same save' });
  expect(screen.getByRole('textbox', { name: 'Title' })).toBeDisabled();
  expect(screen.getByText(/This may already be saved/)).toBeVisible();
  const first = api.post.mock.calls[0];
  expect(first[2].headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
  fireEvent.click(screen.getByRole('button', { name: 'Retry same save' }));
  await screen.findAllByRole('button', { name: 'Add equipment' });
  expect(api.post.mock.calls[1]).toEqual(first);
  expect(sessionStorage.getItem('gk-record-create:9500:400:ASSET')).toBeNull();
});
it('discloses an unresolved save after reload instead of silently creating again', async () => {
  api.post.mockRejectedValueOnce(new Error('Response lost'));
  const { unmount } = render(<MemoryRouter><RecordForm boot={boot} definition={boot.definitions[0]} backLabel="Back to equipment" onSaved={vi.fn()} onCancel={vi.fn()} /></MemoryRouter>);
  fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: 'Private record details' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save equipment' })); await screen.findByRole('button', { name: 'Retry same save' });
  expect(JSON.stringify(sessionStorage)).not.toContain('Private record details');
  unmount();
  render(<MemoryRouter><RecordForm boot={boot} definition={boot.definitions[0]} backLabel="Back to equipment" onSaved={vi.fn()} onCancel={vi.fn()} /></MemoryRouter>);
  expect(screen.getByText(/A previous save was not confirmed/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Save equipment' })).toBeDisabled();
  expect(api.post).toHaveBeenCalledTimes(1);
});

