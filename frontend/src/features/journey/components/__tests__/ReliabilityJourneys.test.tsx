import '../../../../i18n';
import i18n from 'i18next';
import { beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ClubRelationships } from '../ClubRelationships';
import { OrganizationInvitationInbox } from '../../../organizations/setup/OrganizationInvitationInbox';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), refresh: vi.fn() }));
vi.mock('../../../../api/axiosConfig', () => ({ apiClient: { get: mocks.get, post: mocks.post } }));
// The inbox drops results from a retired login: it compares the auth session id it rendered with
// against the stored one. No id is stored in this test, so the rendered id is null too.
vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => ({ sessionId: null, refreshNavigationCapabilities: mocks.refresh }) }));
beforeEach(async () => { await i18n.changeLanguage('en'); vi.clearAllMocks(); mocks.get.mockResolvedValue({ data: [] }); mocks.post.mockResolvedValue({}); mocks.refresh.mockResolvedValue(undefined); });
const mount = (element: React.ReactNode, path = '/account') => render(<MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>);

it('asks before leaving a place and names what stays', async () => {
  mocks.get.mockResolvedValue({ data: [{ clubId: 1, clubName: 'Dinamo', staffRole: 'COACH', playerStatus: 'ACTIVE', departureSnapshots: { STAFF: 'staff', PLAYER: 'player' } }] });
  mount(<ClubRelationships />);
  fireEvent.click(await screen.findByRole('button', { name: 'Leave the squad' }));
  expect(screen.getByText(/Any staff job there stays/)).toBeVisible();
  expect(mocks.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Yes, leave' }));
  await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/clubs/1/relationships/PLAYER/leave', { requestId: expect.any(String), snapshot: 'player' }));
  await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
});

it('lets the Owner leave the squad but hand the club over instead of leaving the staff', async () => {
  mocks.get.mockResolvedValue({ data: [{ clubId: 1, clubName: 'Dinamo', staffRole: 'OWNER', playerStatus: 'ACTIVE', departureSnapshots: {} }] });
  mount(<ClubRelationships />);
  expect(await screen.findByRole('button', { name: 'Leave the squad' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Hand the club over' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Leave the staff' })).not.toBeInTheDocument();
});

it('accepts a venue invitation through its own endpoint and refreshes workspace navigation', async () => {
  mocks.get.mockImplementation(async (path: string) => ({ data: path === '/organizations/invitations/mine' ? [{ id: 9, organizationId: 8, organizationName: 'Sports Park', status: 'PENDING', canRespond: true }] : [] }));
  const accepted = vi.fn(); mount(<OrganizationInvitationInbox onAccepted={accepted} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Accept responsibility' }));
  await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/organizations/invitations/9/response', { action: 'ACCEPT' }));
  await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
  expect(accepted).toHaveBeenCalledOnce();
});

it('opens an expired notification as a receipt without offering stale acceptance', async () => {
  mocks.get.mockImplementation(async (path: string) => ({ data: path.includes('/invitation-notices/') ? { id: 9, organizationName: 'Sports Park', role: 'STAFF', status: 'EXPIRED', recipient: true } : [] }));
  mount(<OrganizationInvitationInbox />, '/account?tab=profile&itemId=9');
  expect(await screen.findByText(/Invitation expired/)).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Accept responsibility' })).not.toBeInTheDocument();
});

it('shows actionable invitations even if the other invitation source fails', async () => {
  mocks.get.mockImplementation(async (path: string) => {
    if (path === '/organizations/invitations/mine') throw new Error('offline');
    return { data: [{ id: 9, organizationId: 8, organizationName: 'Sports Park', role: 'STAFF', status: 'PENDING', canRespond: true }] };
  });
  mount(<OrganizationInvitationInbox />);
  expect(await screen.findByRole('button', { name: 'Accept responsibility' })).toBeEnabled();
  expect(await screen.findByRole('alert')).toHaveTextContent('Some invitations could not be loaded');
  const reads = [...mocks.get.mock.calls];
  await act(async () => { await i18n.changeLanguage('ka'); });
  expect(screen.getByRole('alert')).toHaveTextContent('ზოგი მოწვევა ვერ ჩაიტვირთა. ხელახლა სცადეთ მომლოდინე მოწვევების შესამოწმებლად.');
  expect(screen.getByRole('button', { name: 'პასუხისმგებლობის მიღება' })).toBeEnabled();
  expect(mocks.get.mock.calls).toEqual(reads);
  expect(mocks.post).not.toHaveBeenCalled(); expect(mocks.refresh).not.toHaveBeenCalled();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}

it('invitation locale changes preserve pending names, known and unknown roles, and the locked acceptance request', async () => {
  const response = deferred<unknown>(); let answered = false;
  mocks.get.mockImplementation(async (path: string) => ({ data: answered ? [] : path === '/organizations/team-invitations/mine' ? [
    { id: 9, organizationId: 8, organizationName: 'Draft', role: 'ADMIN', status: 'PENDING', canRespond: true },
    { id: 10, organizationId: 18, organizationName: 'Live', role: 'CUSTOM_Admin', status: 'PENDING', canRespond: false },
  ] : [{ id: 11, organizationId: 28, organizationName: 'Invitation', status: 'PENDING', canRespond: false }] }));
  mocks.post.mockImplementation(() => response.promise.then(() => { answered = true; return {}; }));
  mocks.refresh.mockRejectedValueOnce(new Error('navigation offline'));
  const accepted = vi.fn(); mount(<OrganizationInvitationInbox onAccepted={accepted} />);
  await screen.findByRole('button', { name: 'Accept responsibility' });
  const cards = screen.getAllByRole('article'), reads = [...mocks.get.mock.calls];
  await act(async () => { await i18n.changeLanguage('ka'); });
  expect(screen.getByRole('region', { name: 'ორგანიზაციის მოწვევები' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'ორგანიზაციის მოწვევები' })).toBeInTheDocument();
  expect(within(cards[0]).getByRole('heading', { name: 'Draft' })).toBeInTheDocument();
  expect(within(cards[0]).getByText('მოწვეული ხართ: ადმინისტრატორი')).toBeInTheDocument();
  expect(within(cards[1]).getByRole('heading', { name: 'Live' })).toBeInTheDocument();
  expect(within(cards[1]).getByText('მოწვეული ხართ: CUSTOM_Admin')).toBeInTheDocument();
  expect(within(cards[1]).queryByRole('button')).not.toBeInTheDocument();
  expect(within(cards[2]).getByText('მოწვეული ხართ: ობიექტის ოპერატორი')).toBeInTheDocument();
  expect(mocks.get.mock.calls).toEqual(reads);
  expect(mocks.post).not.toHaveBeenCalled(); expect(mocks.refresh).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'პასუხისმგებლობის მიღება' }));
  expect(mocks.post).toHaveBeenCalledExactlyOnceWith('/organizations/team-invitations/9/response', { action: 'ACCEPT' });
  await act(async () => { await i18n.changeLanguage('en'); });
  const button = screen.getByRole('button', { name: 'Accept responsibility' });
  expect(button).toBeDisabled(); fireEvent.click(button);
  expect(mocks.post).toHaveBeenCalledTimes(1); expect(mocks.get.mock.calls).toEqual(reads);
  expect(accepted).not.toHaveBeenCalled(); expect(mocks.refresh).not.toHaveBeenCalled();
  await act(async () => response.resolve({}));
  await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
  expect(accepted).toHaveBeenCalledOnce();
  expect(screen.getByRole('status')).toHaveTextContent('Your response was saved. Check your current access below.');
  expect(screen.getByRole('alert')).toHaveTextContent('Invitation accepted. Reload to refresh your navigation.');
  const settledReads = [...mocks.get.mock.calls];
  expect(settledReads).toHaveLength(6);
  await act(async () => { await i18n.changeLanguage('ka'); });
  expect(screen.getByRole('status')).toHaveTextContent('თქვენი პასუხი შენახულია. მიმდინარე წვდომა ქვემოთ შეამოწმეთ.');
  expect(screen.getByRole('alert')).toHaveTextContent('მოწვევა მიღებულია. ნავიგაციის გასაახლებლად განაახლეთ გვერდი.');
  expect(screen.getByRole('link', { name: 'ჩემი ორგანიზაციები' })).toHaveAttribute('href', '/my-organizations');
  expect(mocks.get.mock.calls).toEqual(settledReads); expect(mocks.post).toHaveBeenCalledTimes(1);
  expect(accepted).toHaveBeenCalledOnce(); expect(mocks.refresh).toHaveBeenCalledOnce();
});

it.each(['EXPIRED', 'ACCEPTED', 'Mixed_STATUS'])('invitation locale changes retain the %s receipt without granting an action', async status => {
  mocks.get.mockImplementation(async (path: string) => ({ data: path.includes('/invitation-notices/') ? { id: 9, organizationName: 'Draft', role: 'STAFF', status, recipient: true } : [] }));
  mount(<OrganizationInvitationInbox standalone />, '/my-organizations?itemId=9');
  const card = (await screen.findByRole('heading', { name: 'Draft' })).closest('article')!;
  const reads = [...mocks.get.mock.calls];
  await act(async () => { await i18n.changeLanguage('ka'); });
  expect(screen.getByRole('heading', { name: 'Draft' }).closest('article')).toBe(card);
  expect(within(card).getByText(status === 'EXPIRED' ? /მოწვევა: ვადაგასულია/ : status === 'ACCEPTED' ? /მოწვევა: მიღებულია/ : /მოწვევა: Mixed_STATUS/)).toBeInTheDocument();
  // An expired receipt states only its outcome; guidance is shown for pending and accepted ones.
  if (status === 'ACCEPTED') expect(card).toHaveTextContent('სამუშაო სივრცეზე წვდომა თქვენს მიმდინარე პასუხისმგებლობებზეა დამოკიდებული.');
  expect(screen.getByRole('link', { name: 'ჩემი ორგანიზაციები' })).toHaveAttribute('href', '/my-organizations');
  expect(screen.queryByRole('button', { name: 'პასუხისმგებლობის მიღება' })).not.toBeInTheDocument();
  expect(mocks.get.mock.calls).toEqual(reads); expect(mocks.post).not.toHaveBeenCalled(); expect(mocks.refresh).not.toHaveBeenCalled();
});

it('invitation locale changes preserve literal server error text of an unavailable receipt', async () => {
  mocks.get.mockImplementation(async (path: string) => {
    if (path.includes('/invitation-notices/')) throw { response: { status: 503, data: { message: 'Invitation 99 was withdrawn by the organization.' } } };
    return { data: path === '/organizations/team-invitations/mine' ? [{ id: 9, organizationName: 'Live', role: 'STAFF', status: 'PENDING', canRespond: false }] : [] };
  });
  mount(<OrganizationInvitationInbox />, '/my-organizations?itemId=99');
  expect(await screen.findByRole('alert')).toHaveTextContent('Invitation 99 was withdrawn by the organization.');
  // The server text is shown as sent, in either language (only the inbox's own copy is translated).
  // An item id opens that receipt alone; the pending list is not read alongside it.
  expect(screen.queryByRole('heading', { name: 'Live' })).not.toBeInTheDocument();
  const reads = [...mocks.get.mock.calls];
  await act(async () => { await i18n.changeLanguage('ka'); });
  expect(screen.getByRole('alert')).toHaveTextContent('Invitation 99 was withdrawn by the organization.');
  expect(mocks.get.mock.calls).toEqual(reads);
  fireEvent.click(screen.getByRole('button', { name: 'ხელახლა ცდა' }));
  await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(reads.length + 1));
  expect(await screen.findByRole('alert')).toHaveTextContent('Invitation 99 was withdrawn by the organization.');
  expect(mocks.post).not.toHaveBeenCalled(); expect(mocks.refresh).not.toHaveBeenCalled();
});

it('invitation locale changes retain a failed decline and retry reads without submitting another response', async () => {
  mocks.get.mockImplementation(async (path: string) => ({ data: path === '/organizations/invitations/mine' ? [{ id: 9, organizationName: 'Company', status: 'PENDING', canRespond: true }] : [] }));
  mocks.post.mockRejectedValueOnce(new Error('offline'));
  mount(<OrganizationInvitationInbox />);
  fireEvent.click(await screen.findByRole('button', { name: 'Decline' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not respond to this invitation.');
  await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(4));
  const reads = [...mocks.get.mock.calls];
  await act(async () => { await i18n.changeLanguage('ka'); });
  expect(screen.getByRole('alert')).toHaveTextContent('მოწვევაზე პასუხის გაგზავნა ვერ მოხერხდა.');
  expect(screen.getByRole('heading', { name: 'Company' })).toBeInTheDocument();
  expect(mocks.get.mock.calls).toEqual(reads);
  expect(mocks.post).toHaveBeenCalledExactlyOnceWith('/organizations/invitations/9/response', { action: 'DECLINE' });
  fireEvent.click(screen.getByRole('button', { name: 'ხელახლა ცდა' }));
  await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(6));
  expect(mocks.post).toHaveBeenCalledTimes(1); expect(mocks.refresh).not.toHaveBeenCalled();
});
