import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/axiosConfig';
import ClubOperationsPage from '../../pages/ClubOperationsPage';
import { WorkspaceOperations } from './WorkspaceOperations';
import { RecordEditor } from './RecordEditor';
import { operationModule, availableOperationTabs } from './workspaceNavigation';
import type { Bootstrap, Definition } from './api';

vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
const definition: Definition = { module: 'EQUIPMENT', kind: 'ASSET', label: 'Club equipment', states: ['AVAILABLE'], fields: [
  { key: 'quantity', label: 'Total quantity', type: 'integer', required: true, options: [] },
  { key: 'location', label: 'Storage location', type: 'text', required: false, options: [] },
] };
const boot: Bootstrap = { clubId: 12, clubName: 'School football', actorId: 1, leadership: false, definitions: [definition], specialisations: [], permissions: ['EQUIPMENT:WRITE'], settings: { setting: 'SCHOOL', playing_level: 'AMATEUR', currency: 'EUR', enabled_modules: ['EQUIPMENT'], revision: 0 }, modules: [{ id: 'EQUIPMENT', writable: true, globalWrite: false, writeSquads: [2] }], squads: [{ id: 2, name: 'Under 12' }], people: [], staff: [], venues: [], guardians: [], events: [], sessions: [], links: [] };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(apiClient.get).mockResolvedValue({ data: [] }); vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 4 } }); });
afterEach(cleanup);

it('keeps old operations record links and unrelated parameters when redirecting into the workspace', async () => {
  function Destination() { return <p>{window.location.pathname}</p>; }
  render(<MemoryRouter initialEntries={['/clubs/12/operations?module=EQUIPMENT&record=18&from=match']}><Routes><Route path="/clubs/:id/operations" element={<ClubOperationsPage />} /><Route path="/clubs/:id/workspace" element={<Destination />} /></Routes><Location /></MemoryRouter>);
  await screen.findByText('/clubs/12/workspace?record=18&from=match&tab=equipment');
});

import { useLocation } from 'react-router-dom';
function Location() { const location = useLocation(); return <output>{location.pathname}{location.search}</output>; }

it('offers only the appointed sections and keeps private care/settings unavailable', () => {
  expect(availableOperationTabs(boot).map(t => t.id)).toEqual(['actions', 'equipment']);
  expect(operationModule('equipment')).toBe('EQUIPMENT');
});

it('keeps API failures distinct from an empty club list', async () => {
  vi.mocked(apiClient.get).mockRejectedValue(new Error('Offline'));
  render(<MemoryRouter><WorkspaceOperations boot={boot} module="EQUIPMENT" onRefresh={vi.fn()} /></MemoryRouter>);
  expect(await screen.findByRole('alert')).toBeVisible();
  expect(screen.queryByText('Nothing here yet')).not.toBeInTheDocument();
});

it('preserves fields between editor steps and submits the permitted squad without adding a financial currency', async () => {
  const saved = vi.fn().mockResolvedValue(undefined);
  render(<RecordEditor boot={boot} definition={definition} onSaved={saved} onCancel={vi.fn()} />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: 'Training balls' } });
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Total quantity' }), { target: { value: '8' } });
  fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
  fireEvent.change(screen.getByLabelText('Squad'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
  expect(screen.getAllByText('Training balls').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: 'Save club equipment' }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(apiClient.post).toHaveBeenCalledWith('/clubs/12/operations/records', expect.objectContaining({ title: 'Training balls', squadId: 2, data: { quantity: '8' } }));
});

it('asks before discarding a changed editor and preserves the draft when kept', () => {
  const close = vi.fn(); render(<RecordEditor boot={boot} definition={definition} onSaved={vi.fn()} onCancel={close} />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: 'Unsaved equipment' } });
  fireEvent.click(screen.getByRole('button', { name: 'Close editor' }));
  expect(close).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
  expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Unsaved equipment');
  fireEvent.click(screen.getByRole('button', { name: 'Close editor' }));
  fireEvent.click(screen.getByRole('button', { name: 'Discard edits' }));
  expect(close).toHaveBeenCalledOnce();
});
