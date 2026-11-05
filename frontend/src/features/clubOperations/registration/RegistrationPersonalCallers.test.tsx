import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../../api/axiosConfig';
import { PersonProfilePage } from '../../profiles/person/PersonProfilePage';
import { ParentHubPage } from '../../../pages/ParentHubPage';
import { fetchJoiningChildren } from '../../parents/api';
import type { JoiningChild } from '../../parents/api';
import type { RegistrationProfile } from './api';
import { PersonalRegistrationHistory } from './PersonalRegistrationHistory';

const auth = vi.hoisted(() => ({ user: { id: 9, dob: '1990-01-01' }, status: 'authenticated', isAuthenticated: true, sessionId: 'registration-a' }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../../api/axiosConfig', () => ({ DEPLOYMENT_URLS: { mediaBaseUrl: 'http://localhost' }, apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('../../parents/api', async original => ({ ...await original<object>(), fetchJoiningChildren: vi.fn() }));
// Unrelated panels remain their owners' responsibility; the real shells and domain mounts run here.
vi.mock('../../parents/hub/ChildPage', () => ({ ChildPage: ({ child }: { child: JoiningChild }) => <p>{child.identity.fullName} existing child page</p> }));
vi.mock('../../parents/hub/FamilyWeek', () => ({ FamilyWeek: () => <p>Existing family week</p> }));
vi.mock('../../profiles/person/PersonLayers', () => ({ PersonLayers: () => null }));
vi.mock('../../profiles/person/PersonSide', () => ({ PersonSide: () => null }));
vi.mock('../../profiles/person/PersonActions', () => ({ PersonActions: () => null }));
vi.mock('../../profiles/ProfilePosts', () => ({ ProfilePosts: () => null }));
vi.mock('../../clubOperations/PersonalClubWork', () => ({ GuardianClubWork: () => null }));
const child = (playerId: number, name: string): JoiningChild => ({ playerId, identity: { playerId, version: 1, fullName: name, dateOfBirth: '2016-01-01', gender: null, photoUrl: null, positions: [], dominantFoot: null, heightCm: null, weightKg: null, canEdit: true, minor: true }, clubs: [], cases: [], inquiries: [] });
const scopes = [{ clubId: 12, clubName: 'Synthetic Dinamo context', squadId: 2, squadName: 'Earlier U15' }, { clubId: 18, clubName: 'Earlier club', squadId: null, squadName: null }];
const profile = (person: number, departed = true): RegistrationProfile => ({ clubId: 12, personId: person, squadId: 2, asOf: '2026-10-30', currentPlayer: !departed,
  staff: false, canCreate: false, affiliations: [{ id: 1, status: departed ? 'LEFT' : 'ACTIVE', joinedOn: '2025-08-01', endedOn: departed ? '2026-10-29' : null }], departurePath: null,
  records: [{ id: 21, kind: 'REGISTRATION', title: `Retained entry for ${person}`, status: 'APPROVED', revision: 4, previousId: null, canOpen: false, canReplace: false,
    eligibility: { state: departed ? 'NOT_CURRENT' : 'RECORDED_CURRENT', reasons: [], expiresOn: '2026-12-31', credentialIds: [], supersededBy: null }, requirements: 'Actual rule', requirementsSource: 'Handbook',
    history: [{ id: 1, action: 'TRANSITION', status: 'APPROVED', actor: 'Club reviewer', at: '2026-10-01T12:00:00Z', note: null }] }] });
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); auth.user = { id: 9, dob: '1990-01-01' }; auth.sessionId = 'registration-a'; localStorage.setItem('gk-session-id', auth.sessionId);
  vi.mocked(fetchJoiningChildren).mockResolvedValue({ children: [child(3, 'Nika'), child(4, 'Saba')] });
  vi.mocked(apiClient.get).mockImplementation(async path => {
    if (String(path).match(/^\/users\/\d+$/)) return { data: { id: Number(String(path).split('/').at(-1)), username: 'synthetic', fullName: 'Synthetic adult', role: 'PLAYER', roleProfiles: [], followerCount: 0, followingCount: 0, footballProfile: { entries: [], appointments: [], roles: ['PLAYER'] } } };
    if (String(path).endsWith('/scopes')) return { data: scopes };
    const match = String(path).match(/\/registration\/people\/(\d+)$/);
    if (match) return { data: profile(Number(match[1])) };
    return { data: String(path).startsWith('/posts/') ? { posts: [] } : [] };
  });
});
afterEach(() => { cleanup(); localStorage.clear(); });
function openHistory() {
  const details = screen.getByText('Registration and eligibility history').closest('details')!;
  details.open = true; fireEvent(details, new Event('toggle'));
}

it('mounts private history on the actual own profile, preserves old squad choice after leaving, and withholds it on another profile', async () => {
  render(<MemoryRouter initialEntries={['/profile/9?registrationScope=9:12:2']}><Link to="/profile/10">Other profile</Link><Routes><Route path="/profile/:id" element={<PersonProfilePage />} /></Routes></MemoryRouter>);
  await screen.findByText('Registration and eligibility history'); openHistory();
  await screen.findByText('Retained entry for 9');
  expect(screen.getByText(/No current playing relationship/)).toBeVisible();
  expect(screen.getByLabelText('Club and record scope')).toHaveValue('9:12:2');
  expect(screen.getByRole('option', { name: /Earlier U15/ })).toBeInTheDocument();
  fireEvent.click(screen.getByText('Outcome history'));
  expect(screen.getByText('Club reviewer', { exact: false })).toBeVisible();
  expect(apiClient.get).toHaveBeenCalledWith('/registration/people/9/scopes', expect.objectContaining({ _authSessionId: 'registration-a' }));
  fireEvent.click(screen.getByRole('link', { name: 'Other profile' }));
  await waitFor(() => expect(screen.queryByText('Registration and eligibility history')).not.toBeInTheDocument());
  expect(vi.mocked(apiClient.get).mock.calls.some(([path]) => path === '/registration/people/10/scopes')).toBe(false);
});

it('uses only the actual Parent Hub selected child, retires sibling reads, and reloads retained history on return', async () => {
  render(<MemoryRouter initialEntries={['/parent?player=3&registrationScope=3:12:2']}><ParentHubPage /></MemoryRouter>);
  await screen.findByText('Nika existing child page'); openHistory();
  await screen.findByText('Retained entry for 3');
  fireEvent.click(screen.getByRole('button', { name: /^Saba/ }));
  await screen.findByText('Saba existing child page');
  expect(screen.queryByText('Retained entry for 3')).not.toBeInTheDocument(); openHistory();
  await screen.findByText('Retained entry for 4');
  expect(apiClient.get).toHaveBeenCalledWith('/registration/people/4/scopes', expect.anything());
  fireEvent.click(screen.getByRole('button', { name: /^Nika/ }));
  await screen.findByText('Nika existing child page'); openHistory();
  await screen.findByText('Retained entry for 3');
  expect(screen.getByText(/No current playing relationship/)).toBeVisible();
  expect(apiClient.post).not.toHaveBeenCalled();
});

it('never mounts history for an unrelated selected-child URL and removes it when the directory revokes that child', async () => {
  const view = render(<MemoryRouter initialEntries={['/parent?player=999']}><ParentHubPage /></MemoryRouter>);
  await screen.findByText('Existing family week');
  expect(screen.queryByText('Registration and eligibility history')).not.toBeInTheDocument();
  expect(vi.mocked(apiClient.get).mock.calls.some(([path]) => String(path).includes('/registration/people/999'))).toBe(false);
  cleanup();
  render(<MemoryRouter initialEntries={['/parent?player=3']}><ParentHubPage /></MemoryRouter>);
  await screen.findByText('Nika existing child page'); openHistory(); await screen.findByText('Retained entry for 3');
  vi.mocked(fetchJoiningChildren).mockResolvedValue({ children: [child(4, 'Saba')] });
  await act(async () => document.dispatchEvent(new Event('visibilitychange')));
  await screen.findByText('Saba existing child page');
  expect(screen.queryByText('Retained entry for 3')).not.toBeInTheDocument();
  view.unmount();
});

it('aborts retired account history and does not let a late response fill the next session', async () => {
  let finish!: (data: unknown) => void;
  vi.mocked(apiClient.get).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const view = render(<MemoryRouter><PersonalRegistrationHistory person={9} /></MemoryRouter>); openHistory();
  await waitFor(() => expect(apiClient.get).toHaveBeenCalledOnce());
  const signal = vi.mocked(apiClient.get).mock.calls[0][1]?.signal;
  localStorage.setItem('gk-session-id', 'registration-b');
  await act(async () => window.dispatchEvent(new Event('gk-auth-changed')));
  expect(signal?.aborted).toBe(true);
  await act(async () => finish({ data: [{ clubId: 99, clubName: 'Previous private club', squadId: null, squadName: null }] }));
  expect(screen.queryByText(/Previous private club/)).not.toBeInTheDocument();
  view.unmount();
});
