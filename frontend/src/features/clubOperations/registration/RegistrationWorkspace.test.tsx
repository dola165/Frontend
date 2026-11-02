import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../../api/axiosConfig';
import { WorkspaceOperations } from '../WorkspaceOperations';
import type { Bootstrap, OperationRecord } from '../api';
import type { RegistrationDecision, RegistrationProfile } from './api';

vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
const boot: Bootstrap = { clubId: 12, clubName: 'Synthetic Dinamo review context', actorId: 9, leadership: false,
  definitions: [{ module: 'REGISTRATION', kind: 'REGISTRATION', label: 'Registration', states: ['PENDING'], fields: [{ key: 'requirements', label: 'Required records', type: 'textarea', required: true, options: [] }] }],
  specialisations: [], permissions: [], settings: { setting: 'SCHOOL', playing_level: 'AMATEUR', enabled_modules: ['REGISTRATION'], revision: 0 },
  modules: [{ id: 'REGISTRATION', writable: true, globalWrite: false, writeSquads: [2], readSquads: [2] }], squads: [{ id: 2, name: 'Under 15' }],
  people: [{ id: 3, name: 'Synthetic player' }], staff: [], guardians: [], venues: [], events: [], sessions: [], links: [] };
const profile: RegistrationProfile = { clubId: 12, personId: 3, squadId: 2, asOf: '2026-10-30', currentPlayer: true, staff: true, canCreate: true, affiliations: [], records: [], departurePath: null };
let record: OperationRecord;
function Location() { const value = useLocation(); return <output data-testid="location">{value.search}</output>; }
const show = (query = '?person=3&squad=2') => render(<MemoryRouter initialEntries={[`/${query}`]}><WorkspaceOperations boot={boot} module="REGISTRATION" onRefresh={vi.fn().mockResolvedValue(undefined)} /><Location /></MemoryRouter>);
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear();
  record = { id: 21, club_id: 12, module: 'REGISTRATION', kind: 'REGISTRATION', title: 'League entry', status: 'IN_REVIEW',
    squad_id: 2, subject_user_id: 3, assigned_user_id: null, event_id: null, session_id: null, related_record_id: null, due_on: null,
    data: { requirements: 'Actual rule' }, revision: 4, canEdit: false, transitions: ['APPROVED', 'REJECTED'], created_at: '', updated_at: '' };
  vi.mocked(apiClient.get).mockImplementation(async path => ({ data: path === '/clubs/12/registration/people/3' ? profile
    : path === '/clubs/12/operations/records/21' ? { ...record } : [] }));
});
afterEach(cleanup);

it('guards All records and history through the actual workspace, keeping or explicitly discarding the draft', async () => {
  show(); fireEvent.click(await screen.findByRole('button', { name: 'Add registration evidence' }));
  fireEvent.change(screen.getByLabelText('Required records'), { target: { value: 'Unsaved outside rule' } });
  fireEvent.click(screen.getByRole('button', { name: 'All records and history' }));
  fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
  expect(screen.getByLabelText('Required records')).toHaveValue('Unsaved outside rule');
  expect(screen.getByTestId('location')).not.toHaveTextContent('registration=records');
  fireEvent.click(screen.getByRole('button', { name: 'All records and history' }));
  fireEvent.click(screen.getByRole('button', { name: 'Discard edits' }));
  await waitFor(() => expect(screen.queryByLabelText('Required records')).not.toBeInTheDocument());
  expect(screen.getByTestId('location')).toHaveTextContent('registration=records');
});

it('cannot retire a busy save and preserves the unresolved creation and its original draft afterwards', async () => {
  let reject!: (reason: Error) => void;
  vi.mocked(apiClient.post).mockImplementation(() => new Promise((_resolve, fail) => { reject = fail; }));
  show(); fireEvent.click(await screen.findByRole('button', { name: 'Add registration evidence' }));
  fireEvent.change(screen.getByLabelText('Required records'), { target: { value: 'Outside evidence' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save for review' }));
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole('button', { name: 'All records and history' }));
  expect(screen.getByLabelText('Required records')).toHaveValue('Outside evidence');
  expect(screen.queryByRole('button', { name: 'Discard edits' })).not.toBeInTheDocument();
  await act(async () => reject(new Error('Lost response')));
  await screen.findByRole('button', { name: 'Retry the same save' });
  fireEvent.click(screen.getByRole('button', { name: 'All records and history' }));
  fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
  expect(screen.getByLabelText('Required records')).toHaveValue('Outside evidence');
  expect(sessionStorage.getItem('gk-record-create:9:12:REGISTRATION')).toBeTruthy();
  expect(apiClient.post).toHaveBeenCalledOnce();
});

it('reloads record and history in place after remount and uses the freshly reviewed revision through a conflict', async () => {
  const marker = 'gk-registration-decision:null:12:21'; sessionStorage.setItem(marker, 'opaque-old-request');
  show('?person=3&squad=2&record=21');
  fireEvent.click(await screen.findByRole('button', { name: 'Refresh record and history' }));
  record = { ...record, revision: 6 };
  // First reload may already have started; a further explicit refresh reads the updated revision.
  await screen.findByRole('button', { name: 'History reviewed; enable a new decision' });
  fireEvent.click(screen.getByRole('button', { name: 'Refresh record and history' }));
  fireEvent.click(await screen.findByRole('button', { name: 'History reviewed; enable a new decision' }));
  expect(screen.getByTestId('location')).toHaveTextContent('record=21');
  expect(sessionStorage.getItem(marker)).toBeNull();
  vi.mocked(apiClient.post).mockRejectedValueOnce({ response: { status: 409, data: { detail: 'Record changed' } } });
  fireEvent.change(screen.getByLabelText('Review outcome and reason'), { target: { value: 'Actual review' } });
  fireEvent.click(screen.getByRole('button', { name: 'Record supported approval' }));
  await screen.findByRole('button', { name: 'Retry the same decision' });
  expect(apiClient.post).toHaveBeenLastCalledWith('/clubs/12/registration/records/21/decision', expect.objectContaining({ revision: 6 }), expect.anything());
  record = { ...record, revision: 7 };
  fireEvent.click(screen.getByRole('button', { name: 'Refresh record and history' }));
  fireEvent.click(await screen.findByRole('button', { name: 'History reviewed; enable a new decision' }));
  fireEvent.change(screen.getByLabelText('Review outcome and reason'), { target: { value: 'Reviewed changed evidence' } });
  vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { id: 21, revision: 8, status: 'APPROVED' } });
  fireEvent.click(screen.getByRole('button', { name: 'Record supported approval' }));
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(2));
  expect(apiClient.post).toHaveBeenLastCalledWith('/clubs/12/registration/records/21/decision', expect.objectContaining({ revision: 7, note: 'Reviewed changed evidence' }), expect.anything());
  expect((vi.mocked(apiClient.post).mock.calls[0][1] as RegistrationDecision).requestId).not.toBe((vi.mocked(apiClient.post).mock.calls[1][1] as RegistrationDecision).requestId);
});

it('keeps the unresolved marker when authorized history fails and also exposes recovery for a terminal record', async () => {
  const marker = 'gk-registration-decision:null:12:21'; sessionStorage.setItem(marker, 'opaque-old-request');
  record = { ...record, transitions: [], status: 'APPROVED' };
  vi.mocked(apiClient.get).mockImplementation(async path => {
    if (path === '/clubs/12/operations/records/21/history') throw new Error('History unavailable');
    return { data: path === '/clubs/12/operations/records/21' ? record : path === '/clubs/12/registration/people/3' ? profile : [] };
  });
  show('?record=21');
  fireEvent.click(await screen.findByRole('button', { name: 'Refresh record and history' }));
  await screen.findByText('Current record and history could not load. Keep the unresolved decision.');
  expect(screen.getByTestId('location')).toHaveTextContent('record=21');
  expect(sessionStorage.getItem(marker)).toBe('opaque-old-request');
  expect(screen.queryByRole('button', { name: 'History reviewed; enable a new decision' })).not.toBeInTheDocument();
  expect(apiClient.post).not.toHaveBeenCalled();
});
