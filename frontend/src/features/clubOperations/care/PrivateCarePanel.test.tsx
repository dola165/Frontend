import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PrivateCarePanel } from './PrivateCarePanel';
import { CareEditor } from './CareEditor';
import { RecordDetail } from '../RecordDetail';
import { RecordDocuments } from '../RecordDocuments';
import { get, post, type Bootstrap, type OperationRecord } from '../api';
import { apiClient } from '../../../api/axiosConfig';
import type { CareRecord, PlayerCare } from './usePrivateCare';

vi.mock('../api', async original => ({ ...await original<typeof import('../api')>(), get: vi.fn(), post: vi.fn() }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: { put: vi.fn(), post: vi.fn(), get: vi.fn() } }));
const consent: CareRecord = { id: 10, club_id: 1, kind: 'MEDICAL_CONSENT', module: 'MEDICAL', title: 'Medical records consent', status: 'GRANTED',
  squad_id: 2, subject_user_id: 3, assigned_user_id: 6, related_record_id: null, event_id: null, session_id: null, due_on: null,
  data: { wording: 'Synthetic consent wording', version: 'test', expiresOn: '2099-01-01' }, revision: 1, canEdit: false, transitions: [],
  created_at: '2026-10-30T10:00:00Z', updated_at: '2026-10-30T10:00:00Z', created_by: 5, consentCurrent: true };
const note: CareRecord = { ...consent, id: 11, kind: 'CLINICAL_NOTE', title: 'Clinical note', data: { professional: 'Test clinician', notes: 'Confidential synthetic note' },
  assigned_user_id: 5, related_record_id: 10, canEdit: true, revision: 0, status: 'OPEN', transitions: ['REVIEWED'] };
const boot = { clubId: 1, actorId: 5, clubName: 'Synthetic academy', staff: [{ id: 5, name: 'Test clinician' }], people: [{ id: 3, name: 'Synthetic player' }],
  squads: [{ id: 2, name: 'Training group' }], guardians: [], events: [], sessions: [], links: [], settings: {},
  modules: [{ id: 'MEDICAL', globalWrite: true, globalRead: true, writeSquads: [] }],
  definitions: [{ kind: 'CLINICAL_NOTE', module: 'MEDICAL', label: 'Clinical note', states: [], fields: [{ key: 'notes', label: 'Private notes', type: 'textarea', required: true, options: [] }] },
    { kind: 'MEDICAL_APPOINTMENT', module: 'MEDICAL', label: 'Medical appointment', states: [], fields: ['startsAt', 'endsAt'].map(key => ({ key, label: key === 'startsAt' ? 'Starts' : 'Ends', type: 'datetime', required: true, options: [] })) }],
} as unknown as Bootstrap;
let fixture: PlayerCare;
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); localStorage.setItem('gk-session-id', 'care-test');
  fixture = { module: 'MEDICAL', decisionMakers: [{ id: 6, name: 'Current guardian' }], records: [consent, note], usableConsents: [consent], historyLimit: 'Legacy records retained and locked.' };
  vi.mocked(get).mockImplementation(async path => path.includes('/care/players/') ? fixture : /\/records\/\d+$/.test(path) ? fixture.records.find(r => r.id === Number(path.split('/').at(-1))) ?? null : []);
});
afterEach(cleanup);
function panel(query = '?tool.person=3&tool.squad=2') {
  return render(<MemoryRouter initialEntries={[query]}><PrivateCarePanel boot={boot} module="MEDICAL" scope="tool" onRefresh={async () => {}} /></MemoryRouter>);
}
function editor(record?: CareRecord) {
  return render(<MemoryRouter><CareEditor boot={boot} squad={2} person={3} kind="CLINICAL_NOTE" consents={[consent]} decisionMakers={fixture.decisionMakers}
    record={record} onSaved={vi.fn(async () => {})} onCancel={vi.fn()} /></MemoryRouter>);
}

it('opens an allowed player with current consent and separates notes from participation', async () => {
  panel(); expect(await screen.findByRole('button', { name: 'Add private note' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Set participation restriction' })).toBeEnabled();
  expect(screen.queryByText('Confidential synthetic note')).not.toBeInTheDocument();
});
it('keeps an older original consent usable independently of the latest 100 notes', async () => {
  fixture.records = Array.from({ length: 100 }, (_, i) => ({ ...note, id: 200 + i }));
  panel(); await screen.findByRole('button', { name: 'Add private note' });
  await userEvent.click(screen.getByRole('button', { name: 'Add private note' }));
  expect(screen.getByLabelText('Recorded consent')).toHaveValue('10');
  expect(screen.queryByText(/An unanswered request grants no access/)).not.toBeInTheDocument();
});
it('reads an authorized older deep link through the direct endpoint outside the page', async () => {
  fixture.records = Array.from({ length: 100 }, (_, i) => ({ ...note, id: 200 + i }));
  vi.mocked(get).mockImplementation(async path => path.includes('/care/players/') ? fixture : path.endsWith('/records/11') ? note : []);
  panel('?tool.person=3&tool.squad=2&tool.record=11');
  expect(await screen.findByText('Confidential synthetic note')).toBeInTheDocument();
  expect(get).toHaveBeenCalledWith('/clubs/1/operations/records/11', expect.any(AbortSignal));
});
it('does not fall back to a stale history row when its direct read is denied', async () => {
  vi.mocked(get).mockImplementation(async path => {
    if (path.includes('/care/players/')) return fixture;
    if (path.endsWith('/records/11')) throw { response: { status: 403 } };
    return [];
  });
  panel('?tool.person=3&tool.squad=2&tool.record=11');
  expect(await screen.findByRole('alert')).toHaveTextContent('This record is unavailable');
  expect(screen.queryByText('Confidential synthetic note')).not.toBeInTheDocument();
});
it('shows honest missing or revoked consent without write actions', async () => {
  fixture.records = [{ ...consent, status: 'REVOKED', consentCurrent: false }]; fixture.usableConsents = []; panel();
  expect(await screen.findByText(/An unanswered request grants no access/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Add private note' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Request permission' })).toBeEnabled();
});
it('a clinician who is also a guardian cannot reuse another professional’s consent', async () => {
  fixture.records = [{ ...consent, created_by: 9, assigned_user_id: 5 }]; fixture.usableConsents = fixture.records; panel();
  await screen.findByRole('button', { name: 'Request permission' });
  expect(screen.queryByRole('button', { name: 'Add private note' })).not.toBeInTheDocument();
});
it('preserves editing a permitted medical appointment from the player drawer', async () => {
  const appointment = { ...note, kind: 'MEDICAL_APPOINTMENT', title: 'Existing appointment', status: 'SCHEDULED',
    data: { startsAt: '2099-01-01T10:00:00Z', endsAt: '2099-01-01T11:00:00Z', professional: 'Test clinician' } };
  fixture.records = [consent, appointment];
  vi.mocked(apiClient.put).mockResolvedValue({ data: { ...appointment, revision: 1 } });
  panel('?tool.person=3&tool.squad=2&tool.record=11');
  await userEvent.click(await screen.findByRole('button', { name: 'Edit details' }));
  expect((screen.getByLabelText('Starts') as HTMLInputElement).value).toMatch(/^2099-01-01T/);
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith(expect.stringContaining('/records/11'),
    expect.objectContaining({ kind: 'MEDICAL_APPOINTMENT', title: 'Existing appointment', relatedRecordId: 10, data: appointment.data }), expect.anything()));
});
it('refreshes away inaccessible notes instead of leaving a stale successful detail', async () => {
  panel(); await screen.findByRole('button', { name: 'Add private note' });
  vi.mocked(get).mockRejectedValueOnce({ response: { status: 403, data: { detail: 'Consent withdrawn' } } });
  await userEvent.click(screen.getByRole('button', { name: 'Refresh current access' }));
  await screen.findByRole('alert'); expect(screen.queryByRole('button', { name: 'Add private note' })).not.toBeInTheDocument();
});
it('keeps a lost creation response tied to the same request and never stores notes', async () => {
  vi.mocked(post).mockRejectedValueOnce({ response: { status: 500 } }).mockResolvedValueOnce(note);
  editor(); await userEvent.type(screen.getByLabelText('Private notes'), 'Sensitive draft');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('button', { name: 'Retry same request' });
  expect(screen.getByLabelText('Private notes')).toHaveValue('Sensitive draft');
  expect(JSON.stringify(sessionStorage)).not.toContain('Sensitive draft');
  await userEvent.click(screen.getByRole('button', { name: 'Retry same request' }));
  await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
  expect(vi.mocked(post).mock.calls[0][2]).toEqual(vi.mocked(post).mock.calls[1][2]);
  expect(vi.mocked(post).mock.calls[1][1]).toMatchObject({ relatedRecordId: 10, assignedUserId: 5, subjectUserId: 3, squadId: 2 });
});
it('retains a stale edit and reports failure without claiming a save', async () => {
  vi.mocked(apiClient.put).mockRejectedValue({ response: { status: 409, data: { detail: 'Changed by another request' } } });
  editor(note); await userEvent.clear(screen.getByLabelText('Private notes')); await userEvent.type(screen.getByLabelText('Private notes'), 'Correction draft');
  await userEvent.click(screen.getByRole('button', { name: 'Save' })); await screen.findByRole('alert');
  expect(screen.getByLabelText('Private notes')).toHaveValue('Correction draft'); expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
it('asks before discarding a private draft', async () => {
  editor(); await userEvent.type(screen.getByLabelText('Private notes'), 'Keep this draft');
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(await screen.findByRole('group', { name: 'Discard edits' })).toBeInTheDocument(); expect(screen.getByLabelText('Private notes')).toHaveValue('Keep this draft');
});
it('a new session clears the previous account result and ignores its late response', async () => {
  let finish: (value: PlayerCare) => void = () => {};
  vi.mocked(get).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  panel();
  await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
  await act(async () => { localStorage.setItem('gk-session-id', 'another-session'); window.dispatchEvent(new Event('gk-auth-changed')); });
  await screen.findByRole('button', { name: 'Add private note' });
  await act(async () => finish({ ...fixture, records: [{ ...note, title: 'Old account private title' }] }));
  expect(screen.queryByText('Old account private title')).not.toBeInTheDocument();
});
it('binds a pending editor to its original session before any mutation', async () => {
  editor(); await userEvent.type(screen.getByLabelText('Private notes'), 'Draft');
  localStorage.setItem('gk-session-id', 'changed'); fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('alert'); expect(post).not.toHaveBeenCalled();
});
it('short participation detail never requests staff documents or private history', async () => {
  const short: OperationRecord = { ...note, kind: 'RESTRICTION', module: 'AVAILABILITY', title: 'Participation', summaryOnly: true,
    data: { restrictions: 'No contact training' }, canEdit: false, transitions: [] };
  render(<MemoryRouter><RecordDetail boot={boot} club={1} record={short} definition={{ kind: 'RESTRICTION', module: 'AVAILABILITY', label: 'Participation', states: [],
    fields: [{ key: 'restrictions', label: 'Participation instructions', type: 'textarea', required: true, options: [] }] }} backLabel="Back"
    onClose={vi.fn()} onEdit={vi.fn()} onChanged={async () => {}} /></MemoryRouter>);
  expect(screen.getByText('No contact training')).toBeInTheDocument(); expect(get).not.toHaveBeenCalled();
  expect(screen.queryByText('Supporting documents')).not.toBeInTheDocument(); expect(screen.queryByText('Record history')).not.toBeInTheDocument();
});

it('failed document refresh clears stale names and never claims an empty successful list', async () => {
  vi.mocked(get).mockResolvedValueOnce([{ id: 1, file_name: 'private.pdf', bytes: 50 }]).mockRejectedValue(new Error('Access lost'));
  vi.mocked(apiClient.post).mockRejectedValue(new Error('Response lost'));
  render(<RecordDocuments club={1} record={11} canUpload />);
  await screen.findByText('private.pdf');
  await userEvent.upload(screen.getByLabelText('Supporting document'), new File(['%PDF test'], 'test.pdf', { type: 'application/pdf' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Refresh documents' }));
  await screen.findByText('Could not load supporting documents.');
  expect(screen.queryByText('private.pdf')).not.toBeInTheDocument();
  expect(screen.queryByText('No documents yet')).not.toBeInTheDocument();
});

it('document download retains its starting account and does not expose a late blob', async () => {
  vi.mocked(get).mockResolvedValue([{ id: 1, file_name: 'private.pdf', bytes: 50 }]);
  let finish: (value: { data: Blob }) => void = () => {};
  vi.mocked(apiClient.get).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const createObjectURL = vi.fn();
  vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL }));
  try {
    render(<RecordDocuments club={1} record={11} canUpload={false} />);
    await userEvent.click(await screen.findByText('private.pdf'));
    expect(apiClient.get).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ _authSessionId: 'care-test' }));
    await act(async () => { localStorage.setItem('gk-session-id', 'changed'); window.dispatchEvent(new Event('gk-auth-changed')); });
    await act(async () => finish({ data: new Blob(['private']) }));
    expect(createObjectURL).not.toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); }
});
