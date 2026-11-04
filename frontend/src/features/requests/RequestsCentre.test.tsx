import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RequestsCentre } from './RequestsCentre';
import { requestDestination, requestTitle, eventDestination } from './api';
import { apiClient } from '../../api/axiosConfig';
import { RouteMetadata } from '../../components/layout/RouteMetadata';
import i18n from '../../i18n';
vi.mock('../clubOperations/PersonalClubWork', () => ({ StaffAppointments: () => null }));
const leaving = vi.hoisted(() => ({ hold: false, left: null as null | (() => void) }));
vi.mock('../clubOperations/leaving/OtherClubNotice', () => ({ OtherClubNotice: ({ club, onLeft }: { club: { name: string }; onLeft: () => void }) => <button type="button" onClick={() => { leaving.left = onLeft; if (!leaving.hold) onLeft(); }}>Leave {club.name}</button> }));
const auth = vi.hoisted(() => ({ sessionId: 'one', user: { id: 1 }, refreshNavigationCapabilities: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
const empty = { items: [], counts: { incoming: 0, actionable: 0, outgoing: 0, history: 0 }, total: 0, hasMore: false, unavailableSources: [] };
const invitation = { key: 'CLUB_INVITATION:7', id: 7, family: 'CLUB_INVITATION', title: 'Club invitation · Coach', context: 'Dinamo', status: 'PENDING', actionable: true, direction: 'INCOMING', destination: '/account?tab=profile', actionLabel: 'Review invitation' };
beforeEach(() => { vi.clearAllMocks(); leaving.hold = false; leaving.left = null; auth.sessionId = 'one'; auth.user = { id: 1 }; vi.mocked(apiClient.get).mockResolvedValue({ data: empty }); });
afterEach(async () => { cleanup(); await i18n.changeLanguage('en'); });

it('names Inbox and its two views in Georgian, including the document title', async () => {
  await i18n.changeLanguage('ka');
  render(<MemoryRouter initialEntries={['/requests']}><RouteMetadata /><RequestsCentre /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: 'შემოსულები', level: 1 })).toBeVisible();
  expect(screen.getByRole('navigation', { name: 'შემოსულების ხედები' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'თქვენ გელოდებათ' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('button', { name: 'სიახლეები' })).toBeVisible();
  expect(document.title).toBe('შემომავალი | GrassKickZ');
  await screen.findByText('ყველაფერი განხილულია');
});
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
it('a club row reads in football words and opens the Inbox', () => {
    expect(requestTitle('Invited as Admin', (english, georgian) => `${english} / ${georgian}`)).toBe('Invited as Admin / მოწვევა: ადმინი');
    expect(requestTitle('Job offer: Coach', (_, georgian) => georgian)).toBe('შეთავაზება: მწვრთნელი');
    expect(requestTitle('Choose your squad', (_, georgian) => georgian)).toBe('Choose your squad');
    expect(requestDestination('/requests?view=needs-you')).toBe('/requests?view=needs-you');
    expect(requestDestination('/requests?view=needs-you&applicationId=12')).toBe('/requests?view=needs-you&applicationId=12');
});
it.each(['https://evil.test/requests', '//evil.test', '/account?next=https://evil.test', '/profile/1?representation=bad', '/account/%2e%2e', '/account?tab=profile&tab=security'])('rejects unsafe request destination %s', value => { expect(requestDestination(value)).toBeNull(); });
it.each([
  '/clubs/1/office?tab=tools&tool=staff-duties&record=12',
  '/clubs/1/office?tab=tools&tool=facilities&record=14&squad=3',
])('opens the canonical ordinary-work record %s', value => {
  expect(requestDestination(value)).toBe(value);
});
it.each([
  '/clubs/1/office?tab=tools&tool=medical&record=12',
  '/clubs/1/office?tab=tools&tool=facilities&record=0',
  '/clubs/1/office?tab=tools&tool=facilities&record=12&squad=0',
  '/clubs/1/office?tab=tools&tool=facilities&record=12&record=13',
  '/clubs/1/office?tab=tools&tool=staff-duties&record=12&next=https://evil.test',
  '/clubs/9007199254740992/office?tab=tools&tool=facilities&record=12',
  '/clubs/1/office?tab=tools&tool=facilities&record=9007199254740992',
  '/clubs/1/office?tab=tools&tool=facilities&record=12#private',
])('rejects unrelated or malformed ordinary-work destination %s', value => {
  expect(requestDestination(value)).toBeNull();
});
it('opens an assigned club task in its source without inventing an acceptance action', async () => {
  const work = { ...invitation, key: 'CLUB_OPERATION_WORK:14', family: 'CLUB_OPERATION_WORK', id: 14,
    title: 'Repair the gate', context: 'Dinamo · Ground work · Scheduled',
    destination: '/clubs/1/office?tab=tools&tool=facilities&record=14&squad=3', actionLabel: 'Open work' };
  vi.mocked(apiClient.get).mockResolvedValue({ data: { ...empty, items: [work], counts: { ...empty.counts, incoming: 1, actionable: 1 }, total: 1 } });
  render(<MemoryRouter><RequestsCentre /></MemoryRouter>);
  expect(await screen.findByRole('link', { name: 'Open work' })).toHaveAttribute('href', work.destination);
  expect(screen.queryByRole('button', { name: 'Accept invitation' })).toBeNull();
  expect(apiClient.post).not.toHaveBeenCalled();
});
it.each(['WELFARE_WORK', 'CLUB_OPERATION_WORK', 'UNKNOWN', ''])('uses the actual %s family for a sealed work link in Requests', async family => {
  const work = { ...invitation, key: `${family}:14`, family, id: 14,
    title: 'Welfare work', context: 'Dinamo · Welfare · Scheduled',
    destination: '/clubs/1/office?tab=tools&tool=welfare&record=14&squad=3', actionLabel: 'Open work' };
  vi.mocked(apiClient.get).mockResolvedValue({ data: { ...empty, items: [work], total: 1 } });
  render(<MemoryRouter><RequestsCentre /></MemoryRouter>);
  await screen.findByRole('heading', { name: work.title });
  if (family === 'WELFARE_WORK') {
    const link = screen.getByRole('link', { name: 'Open work' });
    expect(link).toHaveAttribute('href', work.destination);
    fireEvent.click(link);
  } else expect(screen.queryByRole('link', { name: 'Open work' })).toBeNull();
  expect(screen.queryByRole('button', { name: /invitation/i })).toBeNull();
  expect(apiClient.post).not.toHaveBeenCalled();
});
it('removes sealed work when a refreshed Requests read is denied', async () => {
  const work = { ...invitation, key: 'WELFARE_WORK:14', family: 'WELFARE_WORK', title: 'Welfare work',
    destination: '/clubs/1/office?tab=tools&tool=welfare&record=14', actionLabel: 'Open work' };
  vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { ...empty, items: [work], total: 1 } })
    .mockRejectedValue({ response: { status: 403 } });
  render(<MemoryRouter><RequestsCentre /></MemoryRouter>);
  await screen.findByRole('link', { name: 'Open work' });
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Requests could not load');
  expect(screen.queryByText(work.title)).toBeNull();
  expect(apiClient.post).not.toHaveBeenCalled();
});
it('accepts precise current-domain destinations and rejects malformed event destinations', () => {
  expect(requestDestination('/notifications?venueId=2&bookingId=9')).toBe('/requests?view=updates&venueId=2&bookingId=9');
  expect(requestDestination('/admin?tab=safety&itemId=7')).toBe('/admin?tab=safety&itemId=7');
  expect(requestDestination('/reports?itemId=7')).toBe('/reports?itemId=7');
  expect(requestDestination('/projects/12')).toBe('/projects/12');
  expect(requestDestination('/projects/12?club=3')).toBeNull();
  expect(requestDestination('/admin?tab=users&itemId=7')).toBeNull();
  expect(requestDestination('/admin?tab=safety&itemId=7&next=evil')).toBeNull();
  expect(eventDestination({ kind: 'SESSION', destination: '/clubs/1?tab=teams&squad=7' } as Parameters<typeof eventDestination>[0])).toBe('/clubs/1?tab=teams&squad=7');
  expect(eventDestination({ kind: 'SCHEDULE', destination: '/calendar?eventId=1&next=evil' } as Parameters<typeof eventDestination>[0])).toBeNull();
});

it('staff at another club leave it from the Inbox, then the same invitation is accepted again', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { ...empty, items: [invitation], total: 1 } });
  vi.mocked(apiClient.post).mockRejectedValueOnce({ isAxiosError: true, response: { status: 409, data: { code: 'STAFF_OF_ANOTHER_CLUB', otherClubId: 3, otherClubName: 'Saburtalo' } } }).mockResolvedValueOnce({ data: { clubId: '4', role: 'COACH' } });
  render(<MemoryRouter initialEntries={['/requests']}><Routes><Route path="/requests" element={<RequestsCentre />} /><Route path="/my-squads" element={<p>My squads page</p>} /></Routes></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Review invitation' }));
  fireEvent.click(screen.getByRole('button', { name: 'Accept invitation' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Leave Saburtalo' }));
  expect(await screen.findByText('My squads page')).toBeVisible();
  expect(vi.mocked(apiClient.post).mock.calls.map(([url]) => url)).toEqual(['/club-memberships/invites/7/accept', '/club-memberships/invites/7/accept']);
});
it('closing the invitation drops the leave notice, so leaving later can’t accept it', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { ...empty, items: [invitation], total: 1 } });
  vi.mocked(apiClient.post).mockRejectedValue({ isAxiosError: true, response: { status: 409, data: { code: 'STAFF_OF_ANOTHER_CLUB', otherClubId: 3, otherClubName: 'Saburtalo' } } });
  render(<MemoryRouter><RequestsCentre /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Review invitation' }));
  fireEvent.click(screen.getByRole('button', { name: 'Accept invitation' }));
  await screen.findByRole('button', { name: 'Leave Saburtalo' });
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Review invitation' }));
  expect(screen.queryByRole('button', { name: 'Leave Saburtalo' })).toBeNull();
});
it('a leave that finishes after the invitation was closed accepts nothing', async () => {
  leaving.hold = true;
  vi.mocked(apiClient.get).mockResolvedValue({ data: { ...empty, items: [invitation], total: 1 } });
  vi.mocked(apiClient.post).mockRejectedValue({ isAxiosError: true, response: { status: 409, data: { code: 'STAFF_OF_ANOTHER_CLUB', otherClubId: 3, otherClubName: 'Saburtalo' } } });
  render(<MemoryRouter><RequestsCentre /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Review invitation' }));
  fireEvent.click(screen.getByRole('button', { name: 'Accept invitation' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Leave Saburtalo' }));
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  await act(async () => { leaving.left?.(); });
  expect(apiClient.post).toHaveBeenCalledTimes(1);
});
it('no other invitation opens while an answer is on its way, so a late refusal can’t land in the wrong one', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { ...empty, items: [invitation], total: 1 } });
  vi.mocked(apiClient.post).mockImplementation(() => new Promise(() => {}));
  render(<MemoryRouter><RequestsCentre /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Review invitation' }));
  fireEvent.click(screen.getByRole('button', { name: 'Accept invitation' }));
  expect(screen.getByRole('button', { name: 'Review invitation' })).toBeDisabled();
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
  expect(requestDestination(value)).toBe(value.replace('/club-operations?', '/requests?'));
});
it.each(['/club-operations', '/club-operations?appointmentId=0', '/club-operations?appointmentId=7&appointmentId=8', '/club-operations?appointmentId=7&next=evil', '/club-operations?appointmentId=7#offer-1', '/map?plans=admin&plan=8', '/map?plans=staff&plan=8&next=evil', '/map?plans=staff&plan=8&plan=9', '/map?plans=family&plan=-1', '/map?plans=staff&plan=9007199254740992', '/account?appointmentId=7'])('rejects malformed or unrelated domain destination %s', value => {
  expect(requestDestination(value)).toBeNull();
});
it('offers an outcome link for a resolved personal staff appointment', async () => {
  const receipt = { ...invitation, key: 'STAFF_APPOINTMENT:7', family: 'STAFF_APPOINTMENT', title: 'Historical appointment', status: 'ENDED', actionable: false, destination: '/club-operations?appointmentId=7', actionLabel: 'Review appointment' };
  vi.mocked(apiClient.get).mockResolvedValue({ data: { ...empty, items: [receipt], counts: { ...empty.counts, history: 1 }, total: 1 } });
  render(<MemoryRouter initialEntries={['/requests?view=HISTORY']}><RequestsCentre /></MemoryRouter>);
  expect(await screen.findByRole('link', { name: 'View outcome' })).toHaveAttribute('href', '/requests?appointmentId=7');
});
