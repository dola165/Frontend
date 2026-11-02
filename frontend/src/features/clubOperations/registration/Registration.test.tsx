import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../../api/axiosConfig';
import type { Bootstrap, OperationRecord } from '../api';
import { RegistrationPanel, PersonalRegistration } from './RegistrationPanel';
import { RegistrationEditor } from './RegistrationEditor';
import { RegistrationDecision } from './RegistrationDecision';
import type { RegistrationProfile } from './api';

vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
const fields = [
  { key: 'requirements', label: 'Required records', type: 'textarea', required: true, options: [] },
  { key: 'requirementsSource', label: 'Rules source', type: 'text', required: false, options: [] },
  { key: 'approvalReference', label: 'Outside approval reference', type: 'text', required: false, options: [] },
  { key: 'expiresOn', label: 'Expires on', type: 'date', required: false, options: [] },
  { key: 'changeType', label: 'Change', type: 'choice', required: false, options: ['RENEWAL', 'CORRECTION'] },
  { key: 'changeReason', label: 'Reason', type: 'textarea', required: false, options: [] },
  { key: 'previousRevision', label: 'Earlier revision', type: 'text', required: false, options: [] },
];
const boot: Bootstrap = { clubId: 12, clubName: 'Synthetic club', actorId: 9, leadership: false,
  definitions: [{ module: 'REGISTRATION', kind: 'REGISTRATION', label: 'Registration', states: ['PENDING'], fields }],
  specialisations: [], permissions: [], settings: { setting: 'SCHOOL', playing_level: 'AMATEUR', enabled_modules: ['REGISTRATION'], revision: 0 },
  modules: [{ id: 'REGISTRATION', writable: true, globalWrite: false, writeSquads: [2], readSquads: [2] }], squads: [{ id: 2, name: 'Under 15' }, { id: 7, name: 'Other squad' }],
  people: [{ id: 3, name: 'Synthetic player' }], staff: [], guardians: [], venues: [], events: [], sessions: [], links: [] };
const profile: RegistrationProfile = { clubId: 12, personId: 3, squadId: 2, asOf: '2026-10-30', currentPlayer: true, staff: true, canCreate: true,
  affiliations: [], records: [], departurePath: null };
const source: OperationRecord = { id: 20, club_id: 12, module: 'REGISTRATION', kind: 'REGISTRATION', title: 'League entry', status: 'APPROVED',
  squad_id: 2, subject_user_id: 3, assigned_user_id: null, event_id: 88, session_id: null, related_record_id: null, due_on: null,
  data: { requirements: 'Actual recorded rule', requirementsSource: 'Handbook', approvalReference: 'OLD decision', expiresOn: '2026-10-29' },
  revision: 4, canEdit: false, transitions: ['EXPIRED'], created_at: '', updated_at: '' };
beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); vi.mocked(apiClient.get).mockResolvedValue({ data: profile }); });
afterEach(cleanup);
function Location() { const value = useLocation(); return <output>{value.search}</output>; }
it('uses the authorized squad and honest no-evidence state without offering unrelated scopes', async () => {
  render(<MemoryRouter initialEntries={['/?person=3&squad=2']}><RegistrationPanel boot={boot} /><Location /></MemoryRouter>);
  await screen.findByText('Eligibility unknown');
  expect(screen.queryByRole('option', { name: 'Other squad' })).not.toBeInTheDocument();
  expect(apiClient.get).toHaveBeenCalledWith('/clubs/12/registration/people/3', expect.objectContaining({ params: { squad: 2 }, signal: expect.any(AbortSignal) }));
  fireEvent.click(screen.getByRole('button', { name: 'All records and history' }));
  expect(screen.getByText('?person=3&squad=2&registration=records')).toBeVisible();
});
it('never presents a failed load as unknown empty eligibility or a successful current record', async () => {
  vi.mocked(apiClient.get).mockRejectedValue(new Error('Offline'));
  render(<MemoryRouter initialEntries={['/?person=3&squad=2']}><RegistrationPanel boot={boot} /></MemoryRouter>);
  await screen.findByRole('alert');
  expect(screen.queryByText('Eligibility unknown')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Add registration evidence' })).not.toBeInTheDocument();
});
it('preserves requirements once, clears old approval and dates, and links a renewal to its exact earlier revision', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({ data: { ...source, id: 21, status: 'PENDING', revision: 0 } });
  const saved = vi.fn();
  render(<RegistrationEditor boot={boot} person={3} squad={2} kind="REGISTRATION" source={source} credentials={[]} onSaved={saved} onClose={vi.fn()} />);
  expect(screen.getByLabelText('Required records')).toHaveValue('Actual recorded rule');
  expect(screen.getByLabelText('Outside approval reference')).toHaveValue('');
  expect(screen.getByLabelText('Expires on')).toHaveValue('');
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Next season' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save for review' }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(apiClient.post).toHaveBeenCalledWith('/clubs/12/operations/records', expect.objectContaining({ relatedRecordId: 20, subjectUserId: 3, squadId: 2, eventId: 88,
    data: expect.objectContaining({ requirements: 'Actual recorded rule', previousRevision: '4', changeType: 'RENEWAL', changeReason: 'Next season' }) }), expect.anything());
  expect(source.data.approvalReference).toBe('OLD decision');
});
it('keeps a failed-save draft and retries the exact creation identity', async () => {
  vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Lost response')).mockResolvedValueOnce({ data: { ...source, id: 21 } });
  render(<RegistrationEditor boot={boot} person={3} squad={2} kind="REGISTRATION" source={source} credentials={[]} onSaved={vi.fn()} onClose={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Correct a reference' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save for review' }));
  const retry = await screen.findByRole('button', { name: 'Retry the same save' });
  expect(screen.getByLabelText('Reason')).toHaveValue('Correct a reference');
  fireEvent.click(retry);
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(2));
  expect(vi.mocked(apiClient.post).mock.calls[0]).toEqual(vi.mocked(apiClient.post).mock.calls[1]);
});
it('asks before discarding a correction draft', () => {
  const close = vi.fn();
  render(<RegistrationEditor boot={boot} person={3} squad={2} kind="REGISTRATION" source={source} credentials={[]} onSaved={vi.fn()} onClose={close} />);
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Fix the entry' } });
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(close).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
  expect(screen.getByLabelText('Reason')).toHaveValue('Fix the entry');
});
it('recovers a saved creation after reload without posting another record', async () => {
  const key = '00000000-0000-4000-8000-000000000001';
  sessionStorage.setItem('gk-record-create:9:12:REGISTRATION', key);
  vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { id: 21 } }).mockResolvedValueOnce({ data: { ...source, id: 21 } });
  const saved = vi.fn();
  render(<RegistrationEditor boot={boot} person={3} squad={2} kind="REGISTRATION" credentials={[]} onSaved={saved} onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Open previous saved outcome' }));
  await waitFor(() => expect(saved).toHaveBeenCalledWith(expect.objectContaining({ id: 21 })));
  expect(apiClient.post).not.toHaveBeenCalled();
  expect(sessionStorage.getItem('gk-record-create:9:12:REGISTRATION')).toBeNull();
});
it('re-entering a lost draft after reload keeps the previous creation key', async () => {
  const key = '00000000-0000-4000-8000-000000000002';
  sessionStorage.setItem('gk-record-create:9:12:REGISTRATION', key);
  vi.mocked(apiClient.post).mockResolvedValue({ data: { ...source, id: 21 } });
  render(<RegistrationEditor boot={boot} person={3} squad={2} kind="REGISTRATION" credentials={[]} onSaved={vi.fn()} onClose={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Required records'), { target: { value: 'Original actual rule' } });
  fireEvent.click(screen.getByRole('button', { name: 'Resubmit under the previous key' }));
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledOnce());
  expect(apiClient.post).toHaveBeenCalledWith('/clubs/12/operations/records', expect.anything(), expect.objectContaining({ headers: { 'Idempotency-Key': key } }));
});
it('retries a decision with the original revision, reason and request key after lost acknowledgement', async () => {
  vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Lost response')).mockResolvedValueOnce({ data: { id: 20, status: 'EXPIRED', revision: 5 } });
  render(<RegistrationDecision club={12} record={source} onChanged={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Review outcome and reason'), { target: { value: 'Validity ended' } });
  fireEvent.click(screen.getByRole('button', { name: 'Expired' }));
  const retry = await screen.findByRole('button', { name: 'Retry the same decision' });
  expect(screen.getByLabelText('Review outcome and reason')).toBeDisabled();
  fireEvent.click(retry);
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(2));
  expect(vi.mocked(apiClient.post).mock.calls[0]).toEqual(vi.mocked(apiClient.post).mock.calls[1]);
  await screen.findByText('Decision recorded.');
});
it('aborts retired player context and prevents a late response populating another child', async () => {
  let resolveFirst: (value: unknown) => void = () => undefined;
  vi.mocked(apiClient.get).mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; })).mockResolvedValueOnce({ data: { ...profile, personId: 4, staff: false } });
  const view = render(<PersonalRegistration club={12} person={3} squad={2} />);
  await waitFor(() => expect(apiClient.get).toHaveBeenCalledOnce());
  view.rerender(<PersonalRegistration club={12} person={4} squad={2} />);
  await screen.findByText('Eligibility unknown');
  const config = vi.mocked(apiClient.get).mock.calls[0][1];
  expect(config?.signal?.aborted).toBe(true);
  resolveFirst({ data: { ...profile, records: [{ title: 'Other child private record' }] } });
  await waitFor(() => expect(screen.queryByText('Other child private record')).not.toBeInTheDocument());
});
