import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { RequestsCentre } from './RequestsCentre';
import { EventDiscoveryPage } from './EventDiscoveryPage';
import { requestDestination, eventDestination } from './api';
import { apiClient } from '../../api/axiosConfig';
const auth = vi.hoisted(() => ({ sessionId: 'one', user: { id: 1 }, refreshNavigationCapabilities: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
const empty = { items: [], counts: { incoming: 0, actionable: 0, outgoing: 0, history: 0 }, total: 0, hasMore: false, unavailableSources: [] };
const invitation = { key: 'CLUB_INVITATION:7', id: 7, family: 'CLUB_INVITATION', title: 'Club invitation · Coach', context: 'Dinamo', status: 'PENDING', actionable: true, direction: 'INCOMING', destination: '/account?tab=profile', actionLabel: 'Review invitation' };
beforeEach(() => { vi.clearAllMocks(); auth.sessionId = 'one'; auth.user = { id: 1 }; vi.mocked(apiClient.get).mockResolvedValue({ data: empty }); });
afterEach(cleanup);
it('shows an honest empty state and does not invent a pending count', async () => { render(<MemoryRouter><RequestsCentre /></MemoryRouter>); expect(await screen.findByText('You’re up to date')).toBeVisible(); });
it('preserves state and offers a safe retry after a read failure', async () => { vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('offline')); render(<MemoryRouter><RequestsCentre /></MemoryRouter>); await screen.findByRole('alert'); fireEvent.click(screen.getByRole('button', { name: 'Retry' })); expect(await screen.findByText('You’re up to date')).toBeVisible(); });
it('does not paint a previous account response during an in-flight account switch', async () => {
  let complete!: (v: unknown) => void; vi.mocked(apiClient.get).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  const view = render(<MemoryRouter><RequestsCentre /></MemoryRouter>); auth.sessionId = 'two'; auth.user = { id: 2 }; view.rerender(<MemoryRouter><RequestsCentre /></MemoryRouter>);
  await screen.findByText('You’re up to date'); await act(async () => complete({ data: { ...empty, items: [invitation] } })); expect(screen.queryByText('Dinamo')).not.toBeInTheDocument();
});
it('reviews terms before reusing the domain invitation command and refreshes capabilities', async () => {
  vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { ...empty, items: [invitation], total: 1 } }); vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
  render(<MemoryRouter><RequestsCentre /></MemoryRouter>); fireEvent.click(await screen.findByRole('button', { name: 'Review invitation' })); expect(apiClient.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Accept invitation' })); await screen.findByText('Invitation accepted. Its recorded outcome is in History.');
  expect(apiClient.post).toHaveBeenCalledWith('/club-memberships/invites/7/accept', {}, { _authSessionId: 'one' }); expect(auth.refreshNavigationCapabilities).toHaveBeenCalled();
});
it('warns when only part of the requests projection is available', async () => { vi.mocked(apiClient.get).mockResolvedValue({ data: { ...empty, unavailableSources: ['family'] } }); render(<MemoryRouter><RequestsCentre /></MemoryRouter>); expect(await screen.findByRole('alert')).toHaveTextContent('Some request types are unavailable'); });
it('uses page two from the server rather than filtering the first page', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { items: [], total: 41, hasMore: true } }); render(<MemoryRouter initialEntries={['/events?q=%E1%83%93%E1%83%98%E1%83%9C%E1%83%90%E1%83%9B%E1%83%9D&page=1']}><EventDiscoveryPage /></MemoryRouter>);
  await screen.findByText('41 events found'); expect(apiClient.get).toHaveBeenCalledWith('/tournaments/discovery', expect.objectContaining({ params: expect.objectContaining({ q: 'დინამო', page: 1, size: 20 }) }));
});
it.each(['https://evil.test/requests', '//evil.test', '/account?next=https://evil.test', '/profile/1?representation=bad', '/account/%2e%2e', '/account?tab=profile&tab=security'])('rejects unsafe request destination %s', value => { expect(requestDestination(value)).toBeNull(); });
it('accepts precise current-domain destinations and rejects malformed event destinations', () => {
  expect(requestDestination('/notifications?venueId=2&bookingId=9')).toBe('/notifications?venueId=2&bookingId=9');
  expect(requestDestination('/admin?tab=safety&itemId=7')).toBe('/admin?tab=safety&itemId=7');
  expect(requestDestination('/reports?itemId=7')).toBe('/reports?itemId=7');
  expect(requestDestination('/admin?tab=users&itemId=7')).toBeNull();
  expect(requestDestination('/admin?tab=safety&itemId=7&next=evil')).toBeNull();
  expect(eventDestination({ kind: 'SESSION', destination: '/clubs/1?tab=teams&squad=7' } as Parameters<typeof eventDestination>[0])).toBe('/clubs/1?tab=teams&squad=7');
  expect(eventDestination({ kind: 'SCHEDULE', destination: '/calendar?eventId=1&next=evil' } as Parameters<typeof eventDestination>[0])).toBeNull();
});

it('keeps an acceptance failure visible after automatic refresh and focus', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({data:{...empty,items:[invitation],total:1}});
  vi.mocked(apiClient.post).mockRejectedValue({response:{data:{error:'This invitation has expired.'}}});
  render(<MemoryRouter><RequestsCentre /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button',{name:'Review invitation'}));
  fireEvent.click(screen.getByRole('button',{name:'Accept invitation'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('This invitation has expired.');
  await act(async()=>{window.dispatchEvent(new Event('focus'));});
  expect(screen.getByRole('alert')).toHaveTextContent('This invitation has expired.');
  expect(screen.queryByText('Invitation accepted. Its recorded outcome is in History.')).toBeNull();
});
it('asks which invited club team enters a squad tournament and submits it', async () => {
  const item={...invitation,family:'TOURNAMENT_INVITATION',key:'TOURNAMENT_INVITATION:7',title:'Tournament invitation',destination:'/tournaments/9'};
  vi.mocked(apiClient.get).mockImplementation(async url=>({data:String(url).endsWith('/review')?{requiresSquad:true,squads:[{id:44,name:'Dinamo U12'}]}:{...empty,items:[item],total:1}}));
  vi.mocked(apiClient.post).mockResolvedValue({data:{}});
  render(<MemoryRouter><RequestsCentre /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button',{name:'Review invitation'}));
  const select=await screen.findByRole('combobox',{name:'Team entering the tournament'});
  expect(screen.getByRole('button',{name:'Accept invitation'})).toBeDisabled();
  fireEvent.change(select,{target:{value:'44'}});
  fireEvent.click(screen.getByRole('button',{name:'Accept invitation'}));
  await screen.findByText('Invitation accepted. Its recorded outcome is in History.');
  expect(apiClient.post).toHaveBeenCalledWith('/tournaments/9/invitations/7/accept',{squadId:44},{_authSessionId:'one'});
});

it.each(['/club-operations?appointmentId=7', '/map?plans=staff&plan=8', '/map?plans=family&plan=9'])('opens the domain request destination %s', value => {
  expect(requestDestination(value)).toBe(value);
});
it.each(['/club-operations', '/club-operations?appointmentId=0', '/club-operations?appointmentId=7&appointmentId=8', '/club-operations?appointmentId=7&next=evil', '/club-operations?appointmentId=7#offer-1', '/map?plans=admin&plan=8', '/map?plans=staff&plan=8&next=evil', '/map?plans=staff&plan=8&plan=9', '/map?plans=family&plan=-1', '/map?plans=staff&plan=9007199254740992', '/account?appointmentId=7'])('rejects malformed or unrelated domain destination %s', value => {
  expect(requestDestination(value)).toBeNull();
});
it('offers an outcome link for a resolved personal staff appointment', async () => {
  const receipt = { ...invitation, key: 'STAFF_APPOINTMENT:7', family: 'STAFF_APPOINTMENT', title: 'Historical appointment', status: 'ENDED', actionable: false, destination: '/club-operations?appointmentId=7', actionLabel: 'Review appointment' };
  vi.mocked(apiClient.get).mockResolvedValue({ data: { ...empty, items: [receipt], counts: { ...empty.counts, history: 1 }, total: 1 } });
  render(<MemoryRouter initialEntries={['/requests?view=HISTORY']}><RequestsCentre /></MemoryRouter>);
  expect(await screen.findByRole('link', { name: 'View outcome' })).toHaveAttribute('href', '/club-operations?appointmentId=7');
});
