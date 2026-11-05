import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { WorkspaceOperations } from './WorkspaceOperations';
import { apiClient } from '../../api/axiosConfig';
import type { Bootstrap, OperationRecord } from './api';
import i18n from '../../i18n';

vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 9 }, sessionId: 'receiver-session', status: 'authenticated' }) }));
vi.mock('./FinanceSummary', () => ({ FinanceSummary: () => <p>Ordinary finance summary</p> }));
vi.mock('./KitStockPanel', () => ({ KitStockPanel: () => <p>Ordinary equipment stock</p> }));
const boot: Bootstrap = {
  clubId: 12, actorId: 9, clubName: 'Synthetic Dinamo', leadership: false,
  definitions: [
    { module: 'FINANCE', kind: 'INSTALMENT', label: 'Training fee', states: ['DUE', 'PAID'], fields: [] },
    { module: 'EQUIPMENT', kind: 'EQUIPMENT_ISSUE', label: 'Kit issue', states: ['ISSUED', 'RETURNED'], fields: [] },
  ], specialisations: [], permissions: [],
  settings: { setting: 'COMMUNITY', playing_level: 'AMATEUR', enabled_modules: ['FINANCE', 'EQUIPMENT'], revision: 0 },
  modules: [{ id: 'FINANCE', writable: true, globalWrite: false, writeSquads: [66] }, { id: 'EQUIPMENT', writable: true, globalWrite: false, writeSquads: [66] }],
  squads: [{ id: 66, name: 'Actual training squad' }], people: [], staff: [], guardians: [], events: [], sessions: [], venues: [], links: [],
};
const placed = { actorId: 9, clubId: 12, caseId: 40, caseVersion: 7, playerId: 51, playerName: 'Placed player',
  squadId: 66, squadName: 'Actual training squad', offerId: 70, target: 'FINANCE', startDate: '2026-10-31', endDate: null,
  feesKnown: true, charges: [{ label: 'Training', amount: 20, currency: 'GEL', frequency: 'MONTHLY' }], records: [] };
const saved: OperationRecord = { id: 91, club_id: 12, module: 'FINANCE', kind: 'INSTALMENT', title: 'October training fee',
  status: 'DUE', squad_id: 66, subject_user_id: 51, assigned_user_id: null, event_id: null, session_id: null,
  related_record_id: null, due_on: null, data: { amount: '20', currency: 'GEL', period: 'October' }, revision: 0,
  canEdit: false, transitions: [], created_at: '2026-10-31', updated_at: '2026-10-31' };
beforeEach(async () => {
  vi.resetAllMocks(); localStorage.clear(); sessionStorage.clear();
  localStorage.setItem('gk-session-id', 'receiver-session'); await i18n.changeLanguage('en');
  vi.mocked(apiClient.get).mockImplementation(async url => ({ data: String(url).endsWith('/records/91') ? saved
    : String(url).endsWith('/money/91') ? { id: 91, title: saved.title, squadId: 66, subjectUserId: 51, dueOn: null, period: 'October', revision: 0,
      canRecord: false, balance: { agreed: 20, received: 0, waived: 0, remaining: 20, currency: 'GEL', status: 'DUE', reminderCandidate: false }, history: [] }
    : String(url).includes('/handoff/') ? { ...placed, target: String(url).endsWith('/EQUIPMENT') ? 'EQUIPMENT' : 'FINANCE' } : [] }));
  vi.mocked(apiClient.post).mockResolvedValue({ data: { actorId: 9, clubId: 12, caseId: 40, recordId: 91 } });
});
afterEach(cleanup);
function Location() { const location = useLocation(); return <output data-testid="receiving-location">{location.pathname + location.search}</output>; }
function open(module = 'FINANCE', search = '?admissionCase=40&admissionVersion=7&q=keeper') {
  render(<MemoryRouter initialEntries={['/clubs/12/office' + search]}><WorkspaceOperations boot={boot} module={module} onRefresh={vi.fn()} /><Location /></MemoryRouter>);
}

it.each(['FINANCE', 'EQUIPMENT'])('mounts the actual %s receiving context without opening a private case or creating a record', async module => {
  open(module);
  expect(await screen.findByText('Placed player')).toBeVisible();
  expect(apiClient.get).toHaveBeenCalledWith(`/clubs/12/admissions/cases/40/handoff/${module}`, expect.objectContaining({ params: { expectedVersion: 7 }, _authSessionId: 'receiver-session' }));
  expect(screen.queryByText('Ordinary finance summary')).toBeNull();
  expect(apiClient.post).not.toHaveBeenCalled();
  expect(vi.mocked(apiClient.get).mock.calls.some(([url]) => String(url).endsWith('/cases/40'))).toBe(false);
});

it('returns Cancel to the same target tool and preserves unrelated context', async () => {
  open(); await screen.findByText('Placed player');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  await screen.findByText('Ordinary finance summary');
  expect(screen.getByTestId('receiving-location')).toHaveTextContent('/clubs/12/office?q=keeper');
  expect(apiClient.post).not.toHaveBeenCalled();
});

it('opens the canonical record only after an explicit save, clearing source parameters', async () => {
  open(); await screen.findByLabelText('Agreed amount');
  fireEvent.change(screen.getByLabelText('Agreed amount'), { target: { value: '20' } });
  fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'GEL' } });
  fireEvent.change(screen.getByLabelText('Membership period'), { target: { value: 'October' } });
  fireEvent.click(screen.getByRole('button', { name: 'Record agreed fee' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Open saved record' }));
  expect(await screen.findByRole('heading', { level: 1, name: saved.title })).toBeVisible();
  await waitFor(() => expect(screen.getByTestId('receiving-location')).toHaveTextContent('/clubs/12/office?q=keeper&record=91'));
  expect(apiClient.post).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Placed player')).toBeNull();
});

it.each([
  ['FINANCE', '?admissionCase=40&admissionCase=41&admissionVersion=7'],
  ['EQUIPMENT', '?admissionCase=40&admissionVersion=7&admissionVersion=8'],
  ['FINANCE', '?admissionCase=40'], ['MEDICAL', '?admissionCase=40&admissionVersion=7'],
])('rejects malformed or unrelated receiving context without a case read: %s %s', async (module, search) => {
  open(module, search);
  expect(await screen.findByRole('alert')).toHaveTextContent('This follow-up link is invalid for this tool.');
  expect(vi.mocked(apiClient.get).mock.calls.some(([url]) => String(url).includes('/admissions/'))).toBe(false);
  expect(apiClient.post).not.toHaveBeenCalled();
});
