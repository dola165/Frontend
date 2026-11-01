import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../../api/axiosConfig';
import { get, type Bootstrap } from '../api';
import { CareEditor } from './CareEditor';
import { PrivateCarePanel } from './PrivateCarePanel';
import type { CareRecord, PlayerCare } from './usePrivateCare';

vi.mock('../api', async original => ({ ...await original<typeof import('../api')>(), get: vi.fn(), post: vi.fn() }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: { put: vi.fn(), post: vi.fn(), get: vi.fn() } }));
const original: CareRecord = { id: 11, club_id: 1, squad_id: 2, subject_user_id: 3, assigned_user_id: 5, related_record_id: 10,
  module: 'MEDICAL', kind: 'CLINICAL_NOTE', title: 'Clinical note', status: 'OPEN', data: { notes: 'Synthetic private body', professional: 'Test clinician' },
  event_id: null, session_id: null, due_on: null, revision: 0, canEdit: true, transitions: ['REVIEWED'], created_at: '2026-10-30T10:00:00Z', updated_at: '2026-10-30T10:00:00Z' };
const boot = { clubId: 1, actorId: 5, clubName: 'Synthetic club', leadership: false, staff: [{ id: 5, name: 'Test clinician' }], people: [{ id: 3, name: 'Adult patient' }], squads: [{ id: 2, name: 'Original squad' }], guardians: [], events: [], sessions: [], links: [], settings: {},
  modules: [{ id: 'MEDICAL', writable: true, globalWrite: true, globalRead: true, writeSquads: [] }],
  definitions: [{ kind: 'CLINICAL_NOTE', module: 'MEDICAL', label: 'Clinical note', states: [], fields: [{ key: 'notes', label: 'Private notes', type: 'textarea', required: true, options: [] }] },
    { kind: 'MEDICAL_CONSENT', module: 'MEDICAL', label: 'Medical records consent', states: [], fields: [] }],
} as unknown as Bootstrap;
const context: PlayerCare = { module: 'MEDICAL', records: [original], decisionMakers: [{ id: 3, name: 'Adult self' }], usableConsents: [], historyLimit: 'Retained and sealed without original authority.' };
let note: CareRecord;
let contextFailure: unknown;
let denied: boolean;
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); localStorage.setItem('gk-session-id', 'care-retained-session');
  note = original; contextFailure = { response: { status: 403 } }; denied = false;
  vi.mocked(get).mockImplementation(async path => {
    if (path.includes('/care/players/')) { if (contextFailure) throw contextFailure; return context; }
    if (path.endsWith('/records/11')) { if (denied) throw { response: { status: 403 } }; return note; }
    if (path.endsWith('/documents')) return [{ id: 20, file_name: 'original-private.pdf', bytes: 20 }];
    if (path.endsWith('/history')) return [{ id: 30, action: 'CREATED', actor: 'Test clinician', created_at: original.created_at }];
    return [];
  });
});
afterEach(cleanup);
function panel(extra = '') {
  return render(<MemoryRouter initialEntries={['?tool.person=3&tool.squad=2&tool.record=11' + extra]}><PrivateCarePanel boot={boot} module="MEDICAL" scope="tool" onRefresh={async () => {}} /></MemoryRouter>);
}
function noCreation() {
  for (const name of ['Add private note', 'Request permission', 'Set participation restriction', 'Record appointment', 'Open player']) expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
}
function pending<T>() {
  let resolve!: (value: T) => void;
  let reject!: (failure: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
async function dirtyRetainedEditor() {
  contextFailure = { response: { status: 503, data: { detail: 'Context retry needed' } } }; panel();
  await screen.findByText('Synthetic private body');
  await userEvent.click(screen.getByRole('button', { name: 'Edit details' }));
  await userEvent.clear(screen.getByLabelText('Private notes'));
  await userEvent.type(screen.getByLabelText('Private notes'), 'C5 private retry draft');
}

it.each([403, 404])('context %i exposes only the authorized existing detail, documents and history', async status => {
  contextFailure = { response: { status } }; panel();
  expect(await screen.findByText('Synthetic private body')).toBeInTheDocument();
  expect(await screen.findByText('original-private.pdf')).toBeInTheDocument();
  await waitFor(() => expect(get).toHaveBeenCalledWith('/clubs/1/operations/records/11/history', expect.anything()));
  noCreation(); expect(screen.getByRole('button', { name: 'Edit details' })).toBeEnabled();
});

it('edits the retained original without fabricating a usable consent or a replacement choice', async () => {
  panel(); await userEvent.click(await screen.findByRole('button', { name: 'Edit details' }));
  const reference = screen.getByLabelText('Recorded consent');
  expect(reference).toHaveValue('10'); expect(reference).toHaveAttribute('readonly');
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument(); noCreation();
  await userEvent.clear(screen.getByLabelText('Private notes')); await userEvent.type(screen.getByLabelText('Private notes'), 'Retained follow-up');
  vi.mocked(apiClient.put).mockRejectedValueOnce(new Error('Connection lost'));
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('alert'); expect(screen.getByLabelText('Private notes')).toHaveValue('Retained follow-up');
  expect(JSON.stringify(sessionStorage)).not.toContain('Retained follow-up');
  expect(vi.mocked(apiClient.put).mock.calls[0][1]).toMatchObject({ squadId: 2, subjectUserId: 3, assignedUserId: 5, relatedRecordId: 10, revision: 0 });
});

it('never turns an existing-record URL into a new consent or note editor without current context', async () => {
  panel('&tool.care=MEDICAL_CONSENT');
  await screen.findByText('Synthetic private body'); noCreation();
  expect(screen.queryByLabelText('Exact permission requested')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
});

it('a denied record clears the clinical body even if context still lists it', async () => {
  contextFailure = null; denied = true; panel();
  expect(await screen.findByRole('alert')).toHaveTextContent('This record is unavailable');
  expect(screen.queryByText('Synthetic private body')).not.toBeInTheDocument();
  expect(screen.queryByText('original-private.pdf')).not.toBeInTheDocument(); noCreation();
});

it('reports context 5xx and preserves an existing draft and original revision through retries', async () => {
  contextFailure = { response: { status: 503, data: { detail: 'Context service unavailable' } } }; panel();
  await screen.findByRole('alert'); await userEvent.click(screen.getByRole('button', { name: 'Edit details' }));
  await userEvent.clear(screen.getByLabelText('Private notes')); await userEvent.type(screen.getByLabelText('Private notes'), 'Keep this correction draft');
  note = { ...original, revision: 1, data: { ...original.data, notes: 'Someone else updated the server' } };
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByRole('alert'); expect(screen.getByLabelText('Private notes')).toHaveValue('Keep this correction draft');
  noCreation(); expect(screen.getByRole('alert')).not.toHaveTextContent('This record is unavailable');
  vi.mocked(apiClient.put).mockRejectedValue({ response: { status: 409, data: { detail: 'Changed by another request' } } });
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(apiClient.put).toHaveBeenCalled());
  expect(vi.mocked(apiClient.put).mock.calls[0][1]).toMatchObject({ revision: 0, relatedRecordId: 10 });
  expect(screen.getByLabelText('Private notes')).toHaveValue('Keep this correction draft');
  expect(screen.queryByText(/Saved\. Refresh/)).not.toBeInTheDocument();
});

it('a refresh denial removes a mounted private editor and its body', async () => {
  contextFailure = { response: { status: 500, data: { detail: 'Context retry needed' } } }; panel();
  await screen.findByRole('alert'); await userEvent.click(screen.getByRole('button', { name: 'Edit details' }));
  await userEvent.type(screen.getByLabelText('Private notes'), ' secret draft');
  denied = true; contextFailure = null;
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('This record is unavailable');
  expect(screen.queryByLabelText('Private notes')).not.toBeInTheDocument();
  expect(screen.queryByText('Synthetic private body')).not.toBeInTheDocument(); noCreation();
});

it('an editor cannot substitute a consent or reassign original scope through its inputs', async () => {
  const replacement = { ...original, id: 99, kind: 'MEDICAL_CONSENT', consentCurrent: true };
  vi.mocked(apiClient.put).mockResolvedValue({ data: { ...original, revision: 1 } });
  render(<MemoryRouter><CareEditor boot={boot} squad={8} person={9} kind="CLINICAL_NOTE" consents={[replacement]} decisionMakers={[]} record={original} onSaved={async () => {}} onCancel={vi.fn()} /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Recorded consent'), { target: { value: '99' } });
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(apiClient.put).toHaveBeenCalled());
  expect(vi.mocked(apiClient.put).mock.calls[0][1]).toMatchObject({ squadId: 2, subjectUserId: 3, assignedUserId: 5, relatedRecordId: 10, revision: 0 });
});

it('an account switch clears an authorized detail before the new denied response completes', async () => {
  panel(); await screen.findByText('Synthetic private body');
  denied = true; contextFailure = null;
  await act(async () => { localStorage.setItem('gk-session-id', 'different-account'); window.dispatchEvent(new Event('gk-auth-changed')); });
  await screen.findByRole('alert'); expect(screen.queryByText('Synthetic private body')).not.toBeInTheDocument(); noCreation();
});

it.each(['direct-first', 'context-first'])('C5 removes a dirty editor for direct 503 plus context 401: %s', async order => {
  await dirtyRetainedEditor();
  const direct = pending<CareRecord>(), nextContext = pending<PlayerCare>();
  vi.mocked(get).mockImplementation(async path => path.includes('/care/players/') ? nextContext.promise : direct.promise);
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  if (order === 'direct-first') {
    await act(async () => direct.reject({ response: { status: 503 } }));
    expect(screen.getByLabelText('Private notes')).toHaveValue('C5 private retry draft');
    await act(async () => nextContext.reject({ response: { status: 401 } }));
  } else {
    await act(async () => nextContext.reject({ response: { status: 401 } }));
    await act(async () => direct.reject({ response: { status: 503 } }));
  }
  expect(screen.getByRole('alert')).toHaveTextContent('This record is unavailable');
  expect(screen.queryByLabelText('Private notes')).not.toBeInTheDocument();
  expect(screen.queryByText('Synthetic private body')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument(); noCreation();
});

it('C5 clears a dirty editor on context 401 while direct is pending and ignores its later 200', async () => {
  await dirtyRetainedEditor();
  const direct = pending<CareRecord>(), nextContext = pending<PlayerCare>();
  vi.mocked(get).mockImplementation(async path => path.includes('/care/players/') ? nextContext.promise : direct.promise);
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await act(async () => nextContext.reject({ response: { status: 401 } }));
  expect(screen.queryByLabelText('Private notes')).not.toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('This record is unavailable');
  await act(async () => direct.resolve({ ...original, revision: 1, data: { notes: 'Late private response' } }));
  expect(screen.queryByLabelText('Private notes')).not.toBeInTheDocument();
  expect(screen.queryByText('Late private response')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument(); noCreation();
});

it('C5 preserves a dirty editor and original revision on direct 503 without authentication loss', async () => {
  await dirtyRetainedEditor();
  vi.mocked(get).mockImplementation(async path => {
    throw { response: { status: path.includes('/care/players/') ? 403 : 503 } };
  });
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(screen.getByLabelText('Private notes')).toHaveValue('C5 private retry draft');
  expect(screen.getByRole('alert')).not.toHaveTextContent('This record is unavailable'); noCreation();
  vi.mocked(apiClient.put).mockRejectedValue({ response: { status: 409, data: { detail: 'Changed by another request' } } });
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(apiClient.put).toHaveBeenCalled());
  expect(vi.mocked(apiClient.put).mock.calls[0][1]).toMatchObject({ revision: 0, relatedRecordId: 10 });
  expect(screen.getByLabelText('Private notes')).toHaveValue('C5 private retry draft');
});
