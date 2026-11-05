import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { RequestsCentre } from '../requests/RequestsCentre';
import { requestDestination, type RequestItem } from '../requests/api';
import { apiClient } from '../../api/axiosConfig';
import '../../i18n';

vi.mock('../clubOperations/PersonalClubWork', () => ({ StaffAppointments: () => null }));
const auth = vi.hoisted(() => ({ sessionId: 'concern-owner', user: { id: 21 }, refreshNavigationCapabilities: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
const participant = '/tournaments/8?tab=matches&fixtureId=4';
const operator = '/tournaments/8/workspace?view=schedule&fixtureId=4';
const empty = { items: [], counts: { incoming: 0, actionable: 0, outgoing: 0, history: 0 }, total: 0, hasMore: false, unavailableSources: [] };
const concern: RequestItem = { key: 'COMPETITION_CONCERN:5', family: 'COMPETITION_CONCERN', id: 5, title: 'Competition result concern', context: 'Synthetic competition', status: 'PENDING', direction: 'OUTGOING', actionable: false, updatedAt: '', destination: participant, actionLabel: 'View concern receipt' };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(apiClient.get).mockResolvedValue({ data: empty }); });
afterEach(cleanup);

it.each([participant, operator, '/tournaments/9007199254740991?tab=matches&fixtureId=9007199254740991'])('accepts only the canonical concern identifiers: %s', value => {
  expect(requestDestination(value)).toBe(value);
});
it.each([
  '/tournaments/8?fixtureId=4&tab=matches', '/tournaments/8?tab=matches&fixtureId=4&fixtureId=5',
  '/tournaments/8?tab=matches&fixtureId=4&next=evil', '/tournaments/8?tab=matches&fixtureId=4#offer-1',
  '/tournaments/8?tab=matches&fixtureId=0', '/tournaments/0?tab=matches&fixtureId=4',
  '/tournaments/08?tab=matches&fixtureId=4', '/tournaments/8?tab=matches&fixtureId=04',
  '/tournaments/9007199254740992?tab=matches&fixtureId=4', '/tournaments/8?tab=matches&fixtureId=9007199254740992',
  '/tournaments/8/workspace?fixtureId=4&view=schedule', '/tournaments/8/workspace?view=bracket&fixtureId=4',
  '/tournaments/8/workspace?view=schedule&fixtureId=4&view=schedule', '/tournaments/8/workspace?view=schedule&fixtureId=4&tab=matches',
  '/tournaments/8/workspace?view=schedule&fixtureId=-4', '/tournaments/8/workspace?view=schedule&fixtureId=4#offer-1',
  '/tournaments/9007199254740992/workspace?view=schedule&fixtureId=4', '/tournaments/8/workspace?view=schedule&fixtureId=9007199254740992',
  '/tournaments/8/admin?view=schedule&fixtureId=4', '/tournaments/8/workspace/extra?view=schedule&fixtureId=4',
  '/tournaments/%38?tab=matches&fixtureId=4', '/tournaments/8?tab=matches&fixtureId=%34',
  '/tournaments/8/workspace?view=schedule%26fixtureId=4', '/tournaments/8/../8/workspace?view=schedule&fixtureId=4',
  'https://evil.test/tournaments/8?tab=matches&fixtureId=4', '//evil.test/tournaments/8?tab=matches&fixtureId=4',
  '/tournaments/8?tab=matches&fixtureId=4 ', '/tournaments/8/workspace\\?view=schedule&fixtureId=4',
])('rejects a malformed or broader concern destination: %s', value => { expect(requestDestination(value)).toBeNull(); });

it.each([
  '/parent?tab=connections&permissionId=7', '/profile/7?representation=8',
  '/clubs/7/workspace?tab=jobs&applicationId=8', '/matches/7', '/match-exchange/7', '/tournaments/8',
])('preserves an existing Parent/Jobs/Matches destination: %s', value => { expect(requestDestination(value)).toBe(value); });

function Destination() { const value = useLocation(); return <p data-testid="fixture-destination">{value.pathname + value.search}</p>; }
function show(view: string) {
  return render(<MemoryRouter initialEntries={[`/requests?view=needs-you&requestView=${view}`]}><Routes>
    <Route path="/requests" element={<RequestsCentre/>}/><Route path="/tournaments/:id" element={<Destination/>}/>
    <Route path="/tournaments/:id/workspace" element={<Destination/>}/>
  </Routes></MemoryRouter>);
}
it.each([
  { view: 'INCOMING', status: 'PENDING', destination: operator, actionable: true, label: 'Review concern' },
  { view: 'OUTGOING', status: 'PENDING', destination: participant, actionable: false, label: 'Open request' },
  { view: 'HISTORY', status: 'CORRECTED', destination: participant, actionable: false, label: 'View outcome' },
  { view: 'HISTORY', status: 'REJECTED', destination: participant, actionable: false, label: 'View outcome' },
])('opens the existing Requests UI concern link for $view / $status', async ({ view, status, destination, actionable, label }) => {
  const item = { ...concern, status, destination, actionable, direction: view === 'INCOMING' ? 'INCOMING' : 'OUTGOING', actionLabel: label };
  vi.mocked(apiClient.get).mockResolvedValue({ data: { ...empty, items: [item], total: 1 } });
  show(view);
  const link = await screen.findByRole('link', { name: label });
  expect(link).toHaveAttribute('href', destination); fireEvent.click(link);
  expect(await screen.findByTestId('fixture-destination')).toHaveTextContent(destination);
  expect(apiClient.post).not.toHaveBeenCalled();
});
it('removes a concern link when the current-authority projection no longer returns it', async () => {
  vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { ...empty, items: [concern], total: 1 } });
  show('OUTGOING'); await screen.findByRole('link', { name: 'Open request' });
  await act(async () => { window.dispatchEvent(new Event('focus')); });
  await screen.findByText('No requests waiting for a reply');
  expect(screen.queryByRole('link', { name: 'Open request' })).not.toBeInTheDocument();
  expect(screen.queryByText('Competition result concern')).not.toBeInTheDocument();
});
