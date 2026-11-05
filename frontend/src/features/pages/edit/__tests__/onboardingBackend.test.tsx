import '../../../../i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { makePage } from '../../__tests__/fixtures';
import { PageEditContext, type PageEdit } from '../context';
import { StaffPanel } from '../panels/StaffPanel';
import { PlayersPanel } from '../panels/PlayersPanel';
import { JoinPage } from '../../links/JoinPage';
import { InvitePage } from '../../links/InvitePage';

const calls = vi.hoisted(() => ({ links: vi.fn(), arrivals: vi.fn(), decide: vi.fn(), joinLink: vi.fn(), join: vi.fn(), kids: vi.fn(), fetchInvite: vi.fn(), accept: vi.fn(), navigate: vi.fn(), refresh: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../api', async original => ({ ...await original<typeof import('../../api')>(), ensureJoinLinks: calls.links, fetchArrivals: calls.arrivals, decideArrival: calls.decide, fetchJoinLink: calls.joinLink, sendJoin: calls.join, fetchInvite: calls.fetchInvite, acceptInvite: calls.accept }));
vi.mock('../../../parents/api', () => ({ fetchJoiningChildren: calls.kids }));
vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => ({ sessionId: 'test-session', isAuthenticated: true, isBootstrapping: false, refreshNavigationCapabilities: calls.refresh }) }));
vi.mock('react-router-dom', async original => ({ ...await original<typeof import('react-router-dom')>(), useNavigate: () => calls.navigate }));

function page() {
  const value = makePage({ kind: 'CLUB', status: 'LIVE', ref: { type: 'club', id: 10 }, clubId: 10 });
  value.boxes.squads.items = [{ id: 91, name: 'U12 mixed', ageGroup: 'U12', gender: 'MIXED', format: '7v7', days: [], time: null, groundId: null, players: 0, coach: null }];
  value.boxes.players.links = { '91': 'durable-join-code' };
  return value;
}
function panel(element: React.ReactNode, value = page()) {
  const replace = vi.fn();
  render(<MemoryRouter><PageEditContext.Provider value={{ page: value, replace, closePanel: vi.fn(), openPanel: vi.fn(), saveBox: vi.fn().mockResolvedValue(true) } as unknown as PageEdit}>{element}</PageEditContext.Provider></MemoryRouter>);
  return replace;
}
const link = { code: 'durable-join-code', page: { ref: { type: 'club', id: 10 }, name: 'Test FC', town: 'Tbilisi', crestUrl: null, profilePath: '/clubs/10', live: true }, squad: { id: 91, name: 'U12 mixed', ageGroup: 'U12', gender: 'MIXED' } };
beforeEach(() => {
  Object.values(calls).forEach(fn => fn.mockReset()); calls.refresh.mockResolvedValue(undefined);
  calls.links.mockResolvedValue(page()); calls.arrivals.mockResolvedValue([]); calls.joinLink.mockResolvedValue(link); calls.kids.mockResolvedValue({ children: [] });
});

it('sends staff invitations to Club office and makes no codes of its own, keeping codes already sent', () => {
  const value = page();
  value.boxes.staff.invites = [{ id: 7, name: 'Nino', phone: '', role: 'COACH', squadId: 91, status: 'INVITED', code: 'sent-code' }] as typeof value.boxes.staff.invites;
  panel(<StaffPanel />, value);
  expect(screen.getByRole('link', { name: /Invite in Club office/ })).toHaveAttribute('href', '/clubs/10/office?invite=1');
  expect(screen.getByRole('link', { name: 'Open Staff' })).toHaveAttribute('href', '/clubs/10/office');
  expect(screen.queryByRole('textbox', { name: 'Find their account' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Make the invitation' })).not.toBeInTheDocument();
  expect(decodeURIComponent(screen.getByRole('link', { name: /WhatsApp/ }).getAttribute('href')!)).toContain('/invite/sent-code');
});
it('shows a failed arrivals read as an error instead of claiming nobody joined', async () => {
  calls.arrivals.mockRejectedValue(new Error('Offline'));panel(<PlayersPanel />);
  await screen.findByRole('alert');expect(screen.queryByText('No joining requests waiting.')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
});
it('offers a place using the current enquiry version and does not claim immediate enrolment', async () => {
  calls.arrivals.mockResolvedValue([{ id: 62, version: 4, childFirstName: 'Nino', childLastName: 'Test', birthYear: 2015, squadId: 91, squadName: 'U12 mixed', guardianName: 'Parent Test', at: '2026-10-17', destination: '/admissions/inquiries/62', groups: [{ id: 81, version: 11, name: 'Autumn group', method: 'DIRECT' }] }]);
  calls.decide.mockResolvedValue({ page: page(), outcome: 'PLACE_OFFERED', destination: '/admissions/cases/71' });panel(<PlayersPanel />);
  fireEvent.click(await screen.findByRole('button', { name: 'Offer a place' }));
  await waitFor(() => expect(calls.decide).toHaveBeenCalledWith({ type: 'club', id: 10 }, 62, expect.objectContaining({ expectedVersion: 4, action: 'APPROVE', groupId: 81, groupVersion: 11, requestId: expect.any(String) })));
  expect(screen.queryByText('Nino is in')).not.toBeInTheDocument();
});
it('does not expose an empty join URL while link creation is still loading', async () => {
  calls.links.mockImplementation(() => new Promise(() => undefined));const value = page();value.boxes.players.links = {};panel(<PlayersPanel />, value);
  expect(screen.getByRole('button', { name: 'Copy link' })).toBeDisabled();expect(screen.queryByRole('link', { name: 'WhatsApp' })).not.toBeInTheDocument();
});
it('a failed family lookup offers to try again, never a second card for a child who may exist', async () => {
  calls.kids.mockRejectedValue(new Error('Offline'));
  render(<MemoryRouter initialEntries={['/join/test-code?who=child']}><Routes><Route path="/join/:code" element={<JoinPage />} /></Routes></MemoryRouter>);
  expect(await screen.findByText('Your children couldn’t load.')).toBeInTheDocument();expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();expect(screen.queryByLabelText('Child’s full name')).not.toBeInTheDocument();expect(screen.queryByRole('group', { name: 'Your children' })).not.toBeInTheDocument();expect(calls.join).not.toHaveBeenCalled();
});
it('shows the exact invitation scope and sends the reviewed version on acceptance', async () => {
  calls.fetchInvite.mockResolvedValue({ code: 'test-invite', role: 'COACH', status: 'INVITED', version: 7, permissions: ['ATTENDANCE:WRITE'], startsOn: '2026-10-17', endsOn: null, engagement: 'VOLUNTEER', squad: link.squad, page: link.page });
  calls.accept.mockResolvedValue({ profilePath: '/squads/91' });
  render(<MemoryRouter initialEntries={['/invite/test-invite']}><Routes><Route path="/invite/:code" element={<InvitePage />} /></Routes></MemoryRouter>);
  expect(await screen.findByText('Record attendance')).toBeInTheDocument();expect(screen.getByText('Team: U12 mixed')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Join as coach' }));
  await waitFor(() => expect(calls.accept).toHaveBeenCalledWith('test-invite', { requestId: expect.any(String), expectedVersion: 7 }));
});
