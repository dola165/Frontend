import '../../../i18n';
import i18n from 'i18next';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OrganizationInvitationInbox } from './OrganizationInvitationInbox';
import { InvitePage } from '../../pages/links/InvitePage';
import { Route, Routes } from 'react-router-dom';
import { apiClient } from '../../../api/axiosConfig';

const auth = vi.hoisted(() => ({ sessionId: 'recipient-a', user: { id: 123 }, refreshNavigationCapabilities: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
const pending = { id: 51, organizationId: 7, organizationName: 'Organization invitation synthetic', role: 'STAFF', status: 'PENDING', recipient: true, canRespond: true, canDecline: true, canOpenWorkspace: false };
function tree(id = '51') { return <MemoryRouter><OrganizationInvitationInbox targetId={id} standalone /></MemoryRouter>; }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
beforeEach(async () => { vi.resetAllMocks(); localStorage.clear(); auth.sessionId = 'recipient-a'; auth.user.id = 123; localStorage.setItem('gk-session-id', auth.sessionId); await i18n.changeLanguage('en'); auth.refreshNavigationCapabilities.mockResolvedValue(undefined); });

it('loads one receipt without depending on either capped invitation list and routes an operator decision correctly', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { ...pending, role: 'VENUE_OPERATOR' } });
  vi.mocked(apiClient.post).mockResolvedValue({ data: null });
  render(tree()); await screen.findByRole('button', { name: 'Accept responsibility' });
  expect(apiClient.get).toHaveBeenCalledTimes(1);
  expect(apiClient.get).toHaveBeenCalledWith('/organizations/invitation-notices/51', expect.any(Object));
  const requests = vi.fn(), notices = vi.fn(); window.addEventListener('requests-updated', requests); window.addEventListener('talanti:notifications-changed', notices);
  vi.mocked(apiClient.get).mockResolvedValue({ data: { ...pending, role: 'VENUE_OPERATOR', status: 'ACCEPTED', canRespond: false, canDecline: false, canOpenWorkspace: true } });
  fireEvent.click(screen.getByRole('button', { name: 'Accept responsibility' }));
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/organizations/invitations/51/response', { action: 'ACCEPT' }));
  expect(await screen.findByRole('link', { name: 'Open workspace' })).toHaveAttribute('href', '/organizations/7/workspace?tab=team');
  expect(auth.refreshNavigationCapabilities).toHaveBeenCalledTimes(1); expect(requests).toHaveBeenCalled(); expect(notices).toHaveBeenCalled();
  window.removeEventListener('requests-updated', requests); window.removeEventListener('talanti:notifications-changed', notices);
});

it('the current recipient can decline an unauthorized pending invitation without being offered acceptance', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { ...pending, canRespond: false } }); vi.mocked(apiClient.post).mockResolvedValue({});
  render(tree()); fireEvent.click(await screen.findByRole('button', { name: 'Decline' }));
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/organizations/team-invitations/51/response', { action: 'DECLINE' }));
  expect(screen.queryByRole('button', { name: 'Accept responsibility' })).not.toBeInTheDocument();
});

it.each(['CANCELLED', 'EXPIRED', 'DECLINED'])('renders the saved %s receipt without decision buttons', async status => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { ...pending, status, canRespond: false, canDecline: false } }); render(tree());
  expect(await screen.findByText(`Invitation ${status.toLowerCase()}.`)).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Accept responsibility' })).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Decline' })).not.toBeInTheDocument();
});

it('does not turn a sender receipt into recipient actions', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { ...pending, recipient: false, canRespond: false, canDecline: false } }); render(tree());
  expect(await screen.findByText('Invitation pending.')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Decline' })).not.toBeInTheDocument();
  expect(screen.queryByText(/no longer grants access/)).not.toBeInTheDocument();
});

it('refreshes current access on focus and preserves the accepted history after revocation', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { ...pending, status: 'ACCEPTED', canRespond: false, canDecline: false, canOpenWorkspace: true } }); render(tree());
  await screen.findByRole('link', { name: 'Open workspace' });
  vi.mocked(apiClient.get).mockResolvedValue({ data: { ...pending, status: 'ACCEPTED', canRespond: false, canDecline: false, canOpenWorkspace: false } });
  fireEvent(window, new Event('focus'));
  expect(await screen.findByText('Organization access has ended. Ask the current leadership for a new invitation.')).toBeVisible();
  expect(screen.getByText('Invitation accepted.')).toBeVisible(); expect(screen.queryByRole('link', { name: 'Open workspace' })).not.toBeInTheDocument();
});

it('clears the previous receipt immediately when the selected invitation changes and ignores its late response', async () => {
  const first = deferred<{ data: typeof pending }>(); vi.mocked(apiClient.get).mockReturnValueOnce(first.promise).mockResolvedValue({ data: { ...pending, id: 52, organizationName: 'Second organization' } });
  const view = render(tree()); view.rerender(tree('52')); await screen.findByText('Second organization');
  await act(async () => first.resolve({ data: pending })); expect(screen.queryByText(pending.organizationName)).not.toBeInTheDocument();
});

it('does not retain a loaded receipt or its actions while a different receipt is loading', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: pending }); const view = render(tree()); await screen.findByRole('button', { name: 'Accept responsibility' });
  const next = deferred<{ data: typeof pending }>(); vi.mocked(apiClient.get).mockReturnValue(next.promise); view.rerender(tree('52'));
  expect(screen.queryByText(pending.organizationName)).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Accept responsibility' })).not.toBeInTheDocument();
  await act(async () => next.resolve({ data: { ...pending, id: 52, organizationName: 'Second organization' } })); expect(await screen.findByText('Second organization')).toBeVisible();
});

it('rejects an old storage session response before React has received the new login', async () => {
  const reply = deferred<{ data: typeof pending }>(); vi.mocked(apiClient.get).mockReturnValue(reply.promise); render(tree());
  localStorage.setItem('gk-session-id', 'recipient-b'); await act(async () => reply.resolve({ data: pending }));
  expect(screen.queryByText(pending.organizationName)).not.toBeInTheDocument(); expect(apiClient.post).not.toHaveBeenCalled();
});

it('the direct organization invite alias reads a receipt instead of the club token API', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: pending });
  render(<MemoryRouter initialEntries={['/invite/org-51']}><Routes><Route path="/invite/:code" element={<InvitePage />} /></Routes></MemoryRouter>);
  await screen.findByRole('button', { name: 'Accept responsibility' }); expect(apiClient.get).toHaveBeenCalledWith('/organizations/invitation-notices/51', expect.any(Object));
  expect(vi.mocked(apiClient.get).mock.calls.some(([path]) => String(path).startsWith('/invite/'))).toBe(false);
});

it('renders Georgian receipt actions', async () => {
  await i18n.changeLanguage('ka'); vi.mocked(apiClient.get).mockResolvedValue({ data: pending }); render(tree());
  expect(await screen.findByRole('button', { name: 'პასუხისმგებლობის მიღება' })).toBeVisible(); expect(screen.getByText('მოწვევა: მოლოდინში.')).toBeVisible();
});
