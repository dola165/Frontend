import '../../../../i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { makePage } from '../../__tests__/fixtures';
import { PageEditContext, type PageEdit } from '../context';
import { StaffPanel } from '../panels/StaffPanel';
import { PlayersPanel } from '../panels/PlayersPanel';
import { JoinPage } from '../../links/JoinPage';
import { InvitePage } from '../../links/InvitePage';

const calls = vi.hoisted(() => ({ candidates: vi.fn(), invite: vi.fn(), links: vi.fn(), arrivals: vi.fn(), decide: vi.fn(), joinLink: vi.fn(), join: vi.fn(), kids: vi.fn(), fetchInvite: vi.fn(), accept: vi.fn(), navigate: vi.fn(), refresh: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../api', async original => ({ ...await original<typeof import('../../api')>(), fetchStaffCandidates: calls.candidates, inviteStaff: calls.invite, ensureJoinLinks: calls.links, fetchArrivals: calls.arrivals, decideArrival: calls.decide, fetchJoinLink: calls.joinLink, sendJoin: calls.join, fetchInvite: calls.fetchInvite, acceptInvite: calls.accept }));
vi.mock('../../../parents/api', () => ({ fetchJoiningChildren: calls.kids }));
vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => ({ sessionId: 'test-session', refreshNavigationCapabilities: calls.refresh }) }));
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
  calls.candidates.mockResolvedValue([{ id: 50, name: 'Coach Sample' }]); calls.invite.mockResolvedValue(page());
  calls.links.mockResolvedValue(page()); calls.arrivals.mockResolvedValue([]); calls.joinLink.mockResolvedValue(link); calls.kids.mockResolvedValue({ children: [] });
});

it('targets the selected real account and retains one request ID and all fields after an invitation failure', async () => {
  calls.invite.mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(page()); panel(<StaffPanel />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Find their account' }), { target: { value: 'Coach' } });
  fireEvent.click(await screen.findByRole('button', { name: 'Coach Sample' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Engagement' }), { target: { value: 'VOLUNTEER' } });
  fireEvent.click(screen.getByRole('button', { name: 'Make the invitation' }));
  await screen.findByRole('alert');expect(screen.getByRole('textbox', { name: 'Find their account' })).toHaveValue('Coach Sample');
  fireEvent.click(screen.getByRole('button', { name: 'Make the invitation' }));
  await waitFor(() => expect(calls.invite).toHaveBeenCalledTimes(2));
  expect(calls.invite.mock.calls[0][1]).toMatchObject({ userId: 50, role: 'COACH', squadId: 91, engagement: 'VOLUNTEER' });
  expect(calls.invite.mock.calls[1][1].requestId).toBe(calls.invite.mock.calls[0][1].requestId);
});
it('never creates an invitation from an arbitrary typed name', async () => {
  calls.candidates.mockResolvedValue([]);panel(<StaffPanel />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Find their account' }), { target: { value: 'Nobody registered' } });
  await screen.findByText(/No eligible account found/);
  expect(screen.getByRole('button', { name: 'Make the invitation' })).toBeDisabled();expect(calls.invite).not.toHaveBeenCalled();
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
it('blocks new child creation while the existing-family lookup failed', async () => {
  calls.kids.mockRejectedValue(new Error('Offline'));
  render(<MemoryRouter initialEntries={['/join/test-code']}><Routes><Route path="/join/:code" element={<JoinPage />} /></Routes></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: /I am a parent/ }));
  await screen.findByRole('alert');expect(screen.queryByRole('textbox', { name: 'Child’s first name' })).not.toBeInTheDocument();expect(calls.join).not.toHaveBeenCalled();
});
it('shows the exact invitation scope and sends the reviewed version on acceptance', async () => {
  calls.fetchInvite.mockResolvedValue({ code: 'test-invite', role: 'COACH', status: 'INVITED', version: 7, permissions: ['ATTENDANCE:WRITE'], startsOn: '2026-10-17', endsOn: null, engagement: 'VOLUNTEER', squad: link.squad, page: link.page });
  calls.accept.mockResolvedValue({ profilePath: '/squads/91' });
  render(<MemoryRouter initialEntries={['/invite/test-invite']}><Routes><Route path="/invite/:code" element={<InvitePage />} /></Routes></MemoryRouter>);
  expect(await screen.findByText('Record attendance')).toBeInTheDocument();expect(screen.getByText('Team: U12 mixed')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Join as coach' }));
  await waitFor(() => expect(calls.accept).toHaveBeenCalledWith('test-invite', { requestId: expect.any(String), expectedVersion: 7 }));
});
