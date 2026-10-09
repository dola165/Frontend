import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ClubEnquiryModal } from '../ClubEnquiryModal';
import { useAuth } from '../../../context/AuthContext';
const api = vi.hoisted(() => ({ fetchJoiningChildren: vi.fn(), fetchClubJoiningOptions: vi.fn(), submitClubEnquiry: vi.fn(), fetchAdmissionHome: vi.fn() }));
vi.mock('../../../features/joining-contract/api', () => api);
vi.mock('../../../features/admissions/api', () => api);
vi.mock('../../../context/AuthContext', () => ({ useAuth: vi.fn() }));
const props = { clubId: 1, clubName: 'Dinamo Academy', context: { name: 'U12 training', path: '/clubs/1?tab=teams&programme=22', squadIds: [9] }, onClose: vi.fn() };
const receipt = { id: 81, playerId: null, playerName: null, conversationId: 80, applicantDestination: '/admissions/inquiries/81', conversationDestination: '/messages?conversationId=80' };
function LoginReturn() { return <output data-testid="login-return">{new URLSearchParams(useLocation().search).get('next')}</output>; }
const view = (from = '/clubs/1?tab=teams&programme=22') => render(<MemoryRouter initialEntries={[from]}><Routes><Route path="/clubs/1" element={<ClubEnquiryModal {...props} />} /><Route path="/messages" element={<p>Conversation opened</p>} /><Route path="/login" element={<LoginReturn />} /></Routes></MemoryRouter>);
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear(); sessionStorage.clear();
  vi.mocked(useAuth).mockReturnValue({ sessionId: null, status: 'authenticated', user: { id: 7 } } as ReturnType<typeof useAuth>);
  api.fetchJoiningChildren.mockResolvedValue({ children: [{ playerId: 23, identity: { fullName: 'First child' } }, { playerId: 24, identity: { fullName: 'Sibling' } }] });
  api.fetchAdmissionHome.mockResolvedValue({ participants: [] });
  api.fetchClubJoiningOptions.mockResolvedValue({ clubId: 1, options: [{ squadId: 9, programmeIds: [22], squadName: 'U12', opportunity: { id: 90 } }] });
  api.submitClubEnquiry.mockResolvedValue(receipt);
});
async function fill(reason = 'Training timetable') {
  await screen.findByRole('option', { name: 'First child' });
  fireEvent.change(screen.getByLabelText('Enquiry reason'), { target: { value: reason } });
  fireEvent.change(screen.getByLabelText(reason === 'Arrange a first visit' ? 'Anything else? (optional)' : 'Your question'), { target: { value: 'Can we discuss training?' } });
  await waitFor(() => expect(screen.getByRole('button', { name: /Send question|Request a first visit/ })).toBeEnabled());
}
it('persists a general enquiry without choosing or sharing a child', async () => {
  view(); await fill(); expect(api.submitClubEnquiry).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Enquiry player')).toHaveValue('');
  fireEvent.click(screen.getByRole('button', { name: /Send question|Request a first visit/ }));
  await screen.findByText('Conversation opened');
  expect(api.submitClubEnquiry).toHaveBeenCalledWith(1, expect.objectContaining({ playerId: null, programmeId: 22, squadId: 9, groupId: 90, requestId: expect.any(String) }), null);
  expect(screen.getByText('Conversation opened')).toBeInTheDocument();
});
it('requires explicit player selection for a first visit and keeps siblings separate', async () => {
  view(); await fill('Arrange a first visit'); fireEvent.click(screen.getByRole('button', { name: /Send question|Request a first visit/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Select the player'); expect(api.submitClubEnquiry).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Enquiry player'), { target: { value: '24' } });
  fireEvent.click(screen.getByRole('button', { name: /Send question|Request a first visit/ })); await screen.findByText('Conversation opened');
  expect(api.submitClubEnquiry).toHaveBeenCalledWith(1, expect.objectContaining({ playerId: 24 }), null);
});
it('reuses the whole command after an interrupted reply and suppresses double submission', async () => {
  api.submitClubEnquiry.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(receipt);
  view(); await fill(); fireEvent.click(screen.getByRole('button', { name: /Send question|Request a first visit/ })); await screen.findByRole('alert');
  const first = api.submitClubEnquiry.mock.calls[0][1]; const retry = screen.getByRole('button', { name: 'Retry saved enquiry' }); fireEvent.click(retry); fireEvent.click(retry);
  await screen.findByText('Conversation opened'); expect(api.submitClubEnquiry).toHaveBeenCalledTimes(2); expect(api.submitClubEnquiry.mock.calls[1][1]).toEqual(first);
});
it('recovers the saved enquiry after reopening without sending a new request', async () => {
  api.submitClubEnquiry.mockRejectedValueOnce(new Error('reply lost')).mockResolvedValue(receipt);
  const firstView = view(); await fill(); fireEvent.click(screen.getByRole('button', {name: /Send question|Request a first visit/}));
  await screen.findByRole('button', {name:'Retry saved enquiry'});
  const first = api.submitClubEnquiry.mock.calls[0][1]; firstView.unmount();
  view(); fireEvent.click(screen.getByRole('button', {name:'Retry saved enquiry'}));
  await screen.findByText('Conversation opened');
  expect(api.submitClubEnquiry.mock.calls[1][1]).toEqual(first);
});
it('selects a standalone programme group without inventing a squad', async () => {
  api.fetchClubJoiningOptions.mockResolvedValue({clubId:1,options:[
    {squadId:null,programmeIds:[22],squadName:'Beginner mornings',opportunity:{id:91}},
    {squadId:null,programmeIds:[22],squadName:'Beginner evenings',opportunity:{id:92}},
  ]});
  view(); await fill(); fireEvent.change(screen.getByLabelText(/Training group/),{target:{value:'group:92'}});
  fireEvent.click(screen.getByRole('button',{name: /Send question|Request a first visit/})); await screen.findByText('Conversation opened');
  expect(api.submitClubEnquiry).toHaveBeenCalledWith(1,expect.objectContaining({groupId:92,squadId:null,programmeId:22}),null);
});
it('does not display a late receipt after the account changes', async () => {
  let finish!: (value: typeof receipt) => void; api.submitClubEnquiry.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  view(); await fill(); fireEvent.click(screen.getByRole('button', { name: /Send question|Request a first visit/ })); localStorage.setItem('gk-session-id', 'another-account');
  await act(async () => finish(receipt)); expect(screen.queryByText('Conversation opened')).not.toBeInTheDocument();
});
it('returns guests to the same programme enquiry after sign-in without sending', () => {
  vi.mocked(useAuth).mockReturnValue({ sessionId: null, status: 'anonymous', user: null } as ReturnType<typeof useAuth>);
  view('/clubs/1?tab=overview'); fireEvent.click(screen.getByRole('button', { name: 'Sign in to enquire' }));
  expect(screen.getByTestId('login-return')).toHaveTextContent('/clubs/1?tab=teams&programme=22&enquire=1'); expect(api.submitClubEnquiry).not.toHaveBeenCalled();
});
it('shows the explicitly chosen player from Parent Hub and permits a deliberate general question instead', async () => {
  view('/clubs/1?tab=teams&programme=22&player=24'); await fill();
  expect(screen.getByLabelText('Enquiry player')).toHaveValue('24');
  fireEvent.change(screen.getByLabelText('Enquiry player'),{target:{value:''}});fireEvent.click(screen.getByRole('button',{name: /Send question|Request a first visit/}));
  await screen.findByText('Conversation opened');expect(api.submitClubEnquiry).toHaveBeenCalledWith(1,expect.objectContaining({playerId:null}),null);
});
it('does not substitute a sibling when the requested player is outside current authority', async () => {
  view('/clubs/1?tab=teams&programme=22&player=999'); await fill();
  expect(screen.getByLabelText('Enquiry player')).toHaveValue('');
  expect(screen.getByText(/selected player is unavailable/)).toBeInTheDocument();
});
