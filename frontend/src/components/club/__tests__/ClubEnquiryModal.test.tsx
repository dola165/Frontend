import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ClubEnquiryModal } from '../ClubEnquiryModal';
import { apiClient } from '../../../api/axiosConfig';
import { useAuth } from '../../../context/AuthContext';
vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: vi.fn() }));
const props = { clubId: 1, clubName: 'Our academy', context: { name: 'U12 training', path: '/clubs/1?tab=teams&programme=22', squadIds: [9] }, onClose: vi.fn() };
const contacts = [{ userId: 12, fullName: 'Sam Coach', title: 'Team coach', role: 'COACH', responsibilities: [] }];
function LoginReturn() { return <output data-testid="login-return">{new URLSearchParams(useLocation().search).get('next')}</output>; }
const view = (from = '/clubs/1?tab=teams&programme=22') => render(<MemoryRouter initialEntries={[from]}><Routes><Route path="/clubs/1" element={<ClubEnquiryModal {...props}/>}/><Route path="/messages" element={<p>Conversation opened</p>}/><Route path="/login" element={<LoginReturn/>}/></Routes></MemoryRouter>);
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear();
  vi.mocked(useAuth).mockReturnValue({ sessionId: null, status: 'authenticated', user: { id: 7 } } as ReturnType<typeof useAuth>);
  vi.mocked(apiClient.get).mockResolvedValue({ data: contacts });
  vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 80 } });
});
async function fill() { fireEvent.change(await screen.findByLabelText('Enquiry reason'),{target:{value:'Arrange a first visit'}}); await screen.findByRole('option', { name: /Sam Coach/ }); fireEvent.change(screen.getByLabelText('Send to'), { target: { value: '12' } }); fireEvent.change(screen.getByLabelText('Your question'), { target: { value: 'Can we arrange a visit?' } }); }
it('sends only after explicit submission and includes the programme context', async () => {
  view(); await fill(); expect(apiClient.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Send enquiry' }));
  expect(await screen.findByRole('heading', { name: 'Enquiry sent' })).toBeVisible();
  expect(apiClient.post).toHaveBeenNthCalledWith(1, '/chat/conversations', { contextType: 'DIRECT', participantIds: [12] }, { _authSessionId: null });
  expect(apiClient.post).toHaveBeenNthCalledWith(2, '/chat/conversations/80/messages', { content: expect.stringContaining('Enquiry: U12 training\nOur academy\n'), clientMessageId: expect.any(String) }, { _authSessionId: null });
  expect(vi.mocked(apiClient.post).mock.calls[1][1]).toEqual(expect.objectContaining({ content: expect.stringContaining('/clubs/1?tab=teams&programme=22\nReason: Arrange a first visit\n\nCan we arrange a visit?') }));
});
it('reuses the message id after uncertain delivery and prevents double submissions', async () => {
  vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { id: 80 } }).mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ data: { id: 80 } });
  view(); await fill(); fireEvent.click(screen.getByRole('button', { name: 'Send enquiry' }));
  await screen.findByRole('alert'); const first = vi.mocked(apiClient.post).mock.calls[1][1];
  const send = screen.getByRole('button', { name: 'Send enquiry' }); fireEvent.click(send); fireEvent.click(send);
  await screen.findByRole('heading', { name: 'Enquiry sent' });
  expect(apiClient.post).toHaveBeenCalledTimes(4); expect(vi.mocked(apiClient.post).mock.calls[3][1]).toEqual(first);
});
it('does not send from a changed account after conversation creation', async () => {
  let finish!: (v: { data: { id: number } }) => void;
  vi.mocked(apiClient.post).mockReturnValueOnce(new Promise(r => { finish = r; }));
  view(); await fill(); fireEvent.click(screen.getByRole('button', { name: 'Send enquiry' }));
  localStorage.setItem('gk-session-id', 'another-account');
  await act(async () => finish({ data: { id: 80 } }));
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(1));
});
it('requires guest sign-in before any conversation or message is created', async () => {
  vi.mocked(useAuth).mockReturnValue({ sessionId: null, status: 'anonymous', user: null } as ReturnType<typeof useAuth>);
  view(); expect(screen.getByRole('button', { name: 'Sign in to enquire' })).toBeVisible();
  expect(screen.queryByLabelText('Your question')).not.toBeInTheDocument(); expect(apiClient.post).not.toHaveBeenCalled();
});
it('returns sign-in to the enquiry programme when opened over another tab', () => {
  vi.mocked(useAuth).mockReturnValue({ sessionId: null, status: 'anonymous', user: null } as ReturnType<typeof useAuth>);
  view('/clubs/1?tab=overview');
  fireEvent.click(screen.getByRole('button', { name: 'Sign in to enquire' }));
  expect(screen.getByTestId('login-return')).toHaveTextContent('/clubs/1?tab=teams&programme=22&enquire=1');
  expect(apiClient.post).not.toHaveBeenCalled();
});
