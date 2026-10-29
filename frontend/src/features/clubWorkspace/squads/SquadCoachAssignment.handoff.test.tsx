import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { apiClient } from '../../../api/axiosConfig';
import { SquadsPage } from './SquadsPage';
import CoachWorkspacePage from '../../../pages/CoachWorkspacePage';
import { setStoredAccessToken, getAuthSessionId } from '../../../utils/authStorage';
import '../../../i18n';

const fixture = vi.hoisted(() => ({ assigned: false }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() }, DEPLOYMENT_URLS: { mediaBaseUrl: 'http://fixture.invalid' } }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, sessionId: getAuthSessionId(), user: { id: 9500, navigationCapabilities: { version: 1, workspaces: [{ id: 'club.workspace', context: { type: 'club', id: 400, label: 'Fixture academy' } }] } } }) }));
vi.mock('../../clubOperations/useClubOperations', () => ({ useClubOperations: () => ({ boot, loading: false, error: '', refresh: vi.fn() }) }));
vi.mock('../../clubOperations/useWorkspaceRoles', async original => ({ ...await original<object>(), useWorkspaceRoles: () => ({ data: roles(), loading: false, error: '', refresh: vi.fn() }) }));
vi.mock('../useClubOverview', () => ({ useClubOverview: () => ({ clubName: 'Fixture academy', clubLogoUrl: null, loading: false, error: null, schedule: { events: [] } }) }));
vi.mock('../WorkspaceGuide', () => ({ WorkspaceGuide: () => null }));
vi.mock('../../clubOperations/SquadAgePolicy', () => ({ SquadAgePolicy: () => null }));
vi.mock('../../../components/squads/AddPlayerToSquadModal', () => ({ AddPlayerToSquadModal: () => null }));
vi.mock('../../../components/squads/PlayerCardModal', () => ({ PlayerCardModal: () => null }));

const squad = { id: 401, clubId: 400, name: 'Review U12', category: 'U12', gender: 'MALE' };
const boot = { clubId: 400, actorId: 9500, clubName: 'Fixture academy', leadership: true, definitions: [], specialisations: [], permissions: [], settings: { setting: 'ACADEMY', playing_level: 'AMATEUR', enabled_modules: ['ATTENDANCE'], revision: 0 }, modules: [], squads: [squad], people: [], staff: [], guardians: [], events: [], sessions: [], venues: [], links: [] };
function roles() {
  const club = { id: 'club', label: 'Club administration', modules: [], squadIds: [401], clubWide: true, appointmentId: null, revision: null };
  // Approved read-projection fixture: leadership alone has no personal coaching view.
  return { leadership: true, actorId: 9500, catalog: [], current: club, views: [club, ...(fixture.assigned ? [{ ...club, id: 'coaching', label: 'Squad coach', clubWide: false, onSquads: true }] : [])], squads: [{ id: 401, name: 'Review U12', player_count: 0 }], requestSquads: [squad], people: [], sessions: [], requests: [], invitations: [] };
}
const overview = () => ({ id: 401, club_id: 400, viewer_id: 9500, academy_name: 'Fixture academy', name: squad.name, category: 'U12', can_manage: true, unread_count: 0, member_count: 1, notify_chat: true, head_coach_id: fixture.assigned ? 9500 : null, can_assign_coach: true, available_coaches: [{ user_id: 9500, full_name: 'Confirmed club coach' }], coaches: fixture.assigned ? [{ user_id: 9500, full_name: 'Confirmed club coach' }] : [], players: [], threads: [] });
beforeEach(() => {
  vi.clearAllMocks(); fixture.assigned = false; localStorage.clear(); sessionStorage.clear(); setStoredAccessToken('assignment-handoff-fixture');
  vi.mocked(apiClient.get).mockImplementation(async url => ({ data: url === '/clubs/400/squads' ? [squad] : url === '/squad-communication/401' ? overview() : [] }));
  vi.mocked(apiClient.put).mockImplementation(async (url, body) => {
    expect(url).toBe('/squad-communication/401/coach'); expect(body).toStrictEqual({ userId: 9500 }); fixture.assigned = true; return { data: overview() };
  });
});
afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); });

it('takes an empty confirmed leader through explicit first assignment to confirmed My squads projection', async () => {
  render(<MemoryRouter initialEntries={['/my-squads']}><Routes>
    <Route path="/clubs/:id/office" element={<SquadsPage clubId={400} overview={{ currentUserRole: 'OWNER', activePlayerCount: 0 } as never} setParentError={vi.fn()} setParentSuccess={vi.fn()} workspace={{ data: roles(), boot, onOpen: vi.fn() }} />} />
    <Route path="/my-squads" element={<CoachWorkspacePage />} />
  </Routes></MemoryRouter>);
  expect(fixture.assigned).toBe(false); fireEvent.click(await screen.findByRole('link', { name: 'Open squad lists' }));
  const choose = await screen.findByRole('combobox', { name: 'Head coach' }); expect(choose).toHaveValue('');
  expect(apiClient.put).not.toHaveBeenCalled(); fireEvent.change(choose, { target: { value: '9500' } });
  expect(apiClient.put).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Save coach' }));
  await screen.findByText('Coach saved: Confirmed club coach.');
  expect(vi.mocked(apiClient.put).mock.calls).toStrictEqual([['/squad-communication/401/coach', { userId: 9500 }, { _authSessionId: getAuthSessionId() }]]);
  fireEvent.click(screen.getByRole('link', { name: 'My squads' }));
  await waitFor(() => expect(screen.getAllByRole('link').find(link => link.getAttribute('href') === '/my-squads?squad=401&clubId=400')).toHaveTextContent('Review U12'));
  expect(apiClient.put).toHaveBeenCalledOnce();
  expect(apiClient.post).not.toHaveBeenCalled(); expect(apiClient.delete).not.toHaveBeenCalled();
});
