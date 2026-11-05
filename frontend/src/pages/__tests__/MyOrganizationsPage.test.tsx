import '../../i18n';
import i18n from 'i18next';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MyOrganizationsPage } from '../MyOrganizationsPage';
import { hasClubNavigation, organizationNavigation } from '../../components/layout/organizationNavigation';
import type { NavigationCapabilities } from '../../context/navigationCapabilities';

const auth = vi.hoisted(() => ({ sessionId: 'owner-a', status: 'authenticated', user: { id: 9502, navigationCapabilities: { version: 1, workspaces: [] } as NavigationCapabilities } }));
const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../api/axiosConfig', () => ({ apiClient: api }));
const entry = (id: string, number: number, label = 'Sports Park') => ({ id, context: { type: id.startsWith('club.') ? 'club' : 'organization', id: number, label } });

beforeEach(async () => {
  await i18n.changeLanguage('en');
  vi.resetAllMocks(); localStorage.clear(); sessionStorage.clear();
  auth.sessionId = 'owner-a'; auth.status = 'authenticated'; auth.user.id = 9502;
  auth.user.navigationCapabilities = { version: 1, workspaces: [] };
  localStorage.setItem('gk-session-id', auth.sessionId);
  api.get.mockImplementation(async (url: string) => ({ data: url.startsWith('/venues/') ? null : [] }));
});

it('deduplicates venue organizations and separates public, management and settings links', () => {
  auth.user.navigationCapabilities = { version: 1, workspaces: [entry('venue.workspace', 133), entry('organization.workspace', 133), entry('organization.settings', 133), entry('venue.workspace', 134, 'Other ground')] };
  const { rerender } = render(<MemoryRouter initialEntries={['/my-organizations?kind=VENUE']}><MyOrganizationsPage /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: 'My venues' })).toBeInTheDocument();
  expect(screen.getAllByRole('article')).toHaveLength(2);
  const card = within(screen.getAllByRole('article')[0]);
  expect(card.getByRole('link', { name: 'Manage venue' })).toHaveAttribute('href', '/stadiums/133/manage');
  expect(card.getByRole('link', { name: 'View public page' })).toHaveAttribute('href', '/stadiums/133');
  expect(card.getByRole('link', { name: 'Organization settings' })).toHaveAttribute('href', '/organizations/133/workspace?tab=settings');
  expect(screen.queryByRole('link', { name: 'Add organization' })).not.toBeInTheDocument();
  auth.user.navigationCapabilities = { version: 1, workspaces: [] };
  rerender(<MemoryRouter initialEntries={['/my-organizations?kind=VENUE']}><MyOrganizationsPage /></MemoryRouter>);
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('don’t currently have');
});

it('supports other organization types and preserves mixed-role club navigation', () => {
  const capabilities: NavigationCapabilities = { version: 1, workspaces: [entry('organization.workspace', 15, 'Organizer'), entry('venue.workspace', 133), entry('club.workspace', 19)] };
  expect(organizationNavigation(capabilities)?.label).toBe('My organizations');
  expect(hasClubNavigation(capabilities)).toBe(true);
  expect(organizationNavigation(undefined)).toBeNull();
  expect(organizationNavigation({ version: 1, workspaces: [] })).toBeNull();
});

it('offers no venue creation while venues are out, and a route back to every organization', () => {
  auth.user.navigationCapabilities = { version: 1, workspaces: [entry('organization.workspace', 15, 'Organizer')] };
  render(<MemoryRouter initialEntries={['/my-organizations?kind=VENUE']}><MyOrganizationsPage /></MemoryRouter>);
  expect(screen.queryByRole('link', { name: 'Add venue' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Create a page' })).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Create a venue organization');
  expect(screen.getByRole('link', { name: 'All my organizations' })).toHaveAttribute('href', '/my-organizations');
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
});

const tree = () => <MemoryRouter initialEntries={['/my-organizations']}><MyOrganizationsPage /></MemoryRouter>;
const row = (id: number, displayName: string, extra = {}) => ({ id, displayName, clubId: null, venueCount: 0, organizationType: 'OTHER', ...extra });
const reply = (data: unknown) => api.get.mockImplementation(async (url: string) => ({ data: url === '/organizations/workspaces' ? data : [] }));
const denied = (status: number) => ({ response: { status, data: { message: status === 403 ? 'Access refused' : 'Directory unavailable' } } });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}

it.each(['DRAFT', 'LIVE'])('returns all owned page kinds with their %s state and existing destinations', async status => {
  const rows = [row(7000, 'My academy', { clubId: 400, organizationType: 'CLUB', status }), row(7001, 'Our supporters', { organizationType: 'PARTNER', status }), row(7002, 'Local sponsor', { organizationType: 'COMPANY', status }), row(7003, 'Our page', { status })];
  reply(rows); render(tree());
  expect(await screen.findAllByRole('article')).toHaveLength(4);
  for (const item of rows) {
    const card = within(screen.getByRole('heading', { name: item.displayName }).closest('article')!);
    const profile = item.clubId ? `/clubs/${item.clubId}` : `/organizations/${item.id}`;
    expect(card.getByText(status === 'DRAFT' ? 'Draft' : 'Live')).toBeInTheDocument();
    expect(card.getByRole('link', { name: 'View profile' })).toHaveAttribute('href', profile);
    expect(card.getByRole('link', { name: item.clubId ? 'Club office' : 'Open workspace' })).toHaveAttribute('href', item.clubId ? `${profile}/office` : `${profile}/workspace`);
  }
  expect(screen.queryByText('FC Dinamo Tbilisi Academy')).not.toBeInTheDocument();
});

it('keeps legacy club and other organization links without inventing a publication state', async () => {
  reply([row(901, 'Legacy club', { clubId: 1, kinds: ['CLUB', 'VENUE'], venueCount: 2 }), row(54, 'Legacy organizer', { organizationType: 'OTHER' })]);
  render(tree());
  const cards = await screen.findAllByRole('article');
  expect(within(cards[0]).getByRole('link', { name: 'Club office' })).toHaveAttribute('href', '/clubs/1/office');
  expect(within(cards[0]).getByText(/2 venues listed/)).toBeInTheDocument();
  expect(within(cards[1]).getByRole('link', { name: 'View profile' })).toHaveAttribute('href', '/organizations/54');
  expect(within(cards[1]).getByRole('link', { name: 'Open workspace' })).toHaveAttribute('href', '/organizations/54/workspace');
  expect(screen.queryByText('Draft')).not.toBeInTheDocument();
  expect(screen.queryByText('Live')).not.toBeInTheDocument();
});

it('does not offer a nonclub staff workspace when the directory explicitly refuses it', async () => {
  reply([row(7002, 'Staff page', { status: 'DRAFT', canOpenWorkspace: false })]);
  render(tree());
  const card = within((await screen.findByRole('heading', { name: 'Staff page' })).closest('article')!);
  expect(card.getByRole('link', { name: 'View profile' })).toHaveAttribute('href', '/organizations/7002');
  expect(card.queryByRole('link', { name: 'Open workspace' })).not.toBeInTheDocument();
});

it('keeps loading distinct from a successfully confirmed empty directory', async () => {
  const pending = deferred<{ data: unknown[] }>();
  api.get.mockImplementation((url: string) => url === '/organizations/workspaces' ? pending.promise : Promise.resolve({ data: [] }));
  render(tree());
  expect(screen.getByText('Loading organizations…')).toBeInTheDocument();
  expect(screen.queryByText(/don’t currently have an organization workspace/)).not.toBeInTheDocument();
  await act(async () => pending.resolve({ data: [] }));
  expect(screen.getByText(/don’t currently have an organization workspace/)).toBeInTheDocument();
  expect(screen.queryByText('Loading organizations…')).not.toBeInTheDocument();
});

it.each([403, 503])('shows a %s directory failure honestly and retries the same existing collection', async status => {
  let directoryCalls = 0;
  api.get.mockImplementation(async (url: string) => {
    if (url !== '/organizations/workspaces') return { data: [] };
    if (++directoryCalls === 1) throw denied(status);
    return { data: [row(7002, 'Recovered page', { status: 'DRAFT' })] };
  });
  render(tree());
  expect(await screen.findByRole('alert')).toHaveTextContent(status === 403 ? 'Access refused' : 'Directory unavailable');
  expect(screen.queryByText(/don’t currently have an organization workspace/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByRole('heading', { name: 'Recovered page' })).toBeInTheDocument();
  expect(directoryCalls).toBe(2);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('ignores the old account response after the next authenticated account loads', async () => {
  const old = deferred<{ data: unknown[] }>(); let directoryCalls = 0;
  api.get.mockImplementation((url: string) => url !== '/organizations/workspaces' ? Promise.resolve({ data: [] }) : ++directoryCalls === 1 ? old.promise : Promise.resolve({ data: [row(7003, 'B private page')] }));
  const view = render(tree());
  auth.sessionId = 'owner-b'; auth.user.id = 9503; localStorage.setItem('gk-session-id', auth.sessionId);
  view.rerender(tree());
  expect(await screen.findByRole('heading', { name: 'B private page' })).toBeInTheDocument();
  await act(async () => old.resolve({ data: [row(7002, 'A private page')] }));
  expect(screen.queryByRole('heading', { name: 'A private page' })).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'B private page' })).toBeInTheDocument();
});

it('ignores a retired session reply even before React receives the account change', async () => {
  const old = deferred<{ data: unknown[] }>();
  api.get.mockImplementation((url: string) => url === '/organizations/workspaces' ? old.promise : Promise.resolve({ data: [] }));
  render(tree()); localStorage.setItem('gk-session-id', 'next-login');
  await act(async () => old.resolve({ data: [row(7002, 'Retired private draft')] }));
  expect(screen.queryByRole('heading', { name: 'Retired private draft' })).not.toBeInTheDocument();
});

it('does not dispatch a directory read from an already retired login', () => {
  localStorage.setItem('gk-session-id', 'next-login'); render(tree());
  expect(api.get.mock.calls.some(args => args[0] === '/organizations/workspaces')).toBe(false);
});

it('locale changes retain loaded data, existing destinations and explicit workspace refusal without refetching', async () => {
  const rows = [row(7000, 'Draft', { clubId: 400, organizationType: 'CLUB', status: 'LIVE' }), row(7001, 'Live', { organizationType: 'PARTNER', status: 'DRAFT', canOpenWorkspace: false }), row(7002, 'Company', { organizationType: 'COMPANY', status: 'DRAFT' }), row(54, 'Legacy organization', { venueCount: 2 })];
  reply(rows); render(tree());
  const cards = await screen.findAllByRole('article');
  const requests = [...api.get.mock.calls];
  const createPath = screen.getByRole('link', { name: 'Create a page' }).getAttribute('href');
  const paths = screen.getAllByRole('link').map(link => link.getAttribute('href'));
  await act(async () => { await i18n.changeLanguage('ka'); });
  expect(screen.getByRole('heading', { name: 'ჩემი ორგანიზაციები' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'გვერდის შექმნა' })).toHaveAttribute('href', createPath);
  expect(screen.getByText('თქვენი კლუბები და სხვა ორგანიზაციები, მათი საქმიანობა, მოედნები და გუნდი.')).toBeInTheDocument();
  for (let index = 0; index < rows.length; index++) {
    expect(screen.getByRole('heading', { name: rows[index].displayName }).closest('article')).toBe(cards[index]);
  }
  expect(within(cards[0]).getByText('კლუბი')).toBeInTheDocument();
  expect(within(cards[0]).getByText('გამოქვეყნებული')).toBeInTheDocument();
  expect(within(cards[1]).getByText('მონახაზი')).toBeInTheDocument();
  expect(within(cards[1]).getByText('საზოგადოება ან პარტნიორი')).toBeInTheDocument();
  expect(within(cards[1]).queryByRole('link', { name: 'სამუშაო სივრცის გახსნა' })).not.toBeInTheDocument();
  expect(within(cards[2]).getByText('კომპანია')).toBeInTheDocument();
  expect(within(cards[3]).getByText('სხვა ორგანიზაცია')).toBeInTheDocument();
  expect(within(cards[3]).getByText(/2 მოედანია მითითებული/)).toHaveTextContent('პროფილი, საქმიანობა და გუნდი.');
  expect(within(cards[3]).queryByText('მონახაზი')).not.toBeInTheDocument();
  expect(screen.getAllByRole('link').map(link => link.getAttribute('href'))).toEqual(paths);
  expect(api.get.mock.calls).toEqual(requests);
  await act(async () => { await i18n.changeLanguage('en'); });
  expect(within(cards[0]).getByText('Live')).toBeInTheDocument();
  expect(within(cards[1]).getByText('Draft')).toBeInTheDocument();
  expect(api.get.mock.calls).toEqual(requests);
});

it('locale changes preserve a pending read and distinguish loading from confirmed empty', async () => {
  const pending = deferred<{ data: unknown[] }>();
  api.get.mockImplementation((url: string) => url === '/organizations/workspaces' ? pending.promise : Promise.resolve({ data: [] }));
  render(tree());
  expect(screen.getByText('Loading organizations…')).toBeInTheDocument();
  const requests = [...api.get.mock.calls];
  await act(async () => { await i18n.changeLanguage('ka'); });
  expect(screen.getByText('ორგანიზაციები იტვირთება…')).toBeInTheDocument();
  expect(screen.queryByText(/ამჟამად ორგანიზაციის სამუშაო სივრცე არ გაქვთ/)).not.toBeInTheDocument();
  expect(api.get.mock.calls).toEqual(requests);
  await act(async () => pending.resolve({ data: [] }));
  expect(screen.getByText(/ამჟამად ორგანიზაციის სამუშაო სივრცე არ გაქვთ/)).toBeInTheDocument();
  expect(screen.queryByText('ორგანიზაციები იტვირთება…')).not.toBeInTheDocument();
  await act(async () => { await i18n.changeLanguage('en'); });
  expect(screen.getByText(/don’t currently have an organization workspace/)).toBeInTheDocument();
  expect(api.get.mock.calls).toEqual(requests);
});

it.each([['fallback', null], ['server', 'Could not load your organizations.']] as const)('locale changes retain the %s failure and retry only on explicit action', async (_origin, serverMessage) => {
  const pending = deferred<{ data: unknown[] }>(); let directoryCalls = 0;
  api.get.mockImplementation(async (url: string) => {
    if (url !== '/organizations/workspaces') return { data: [] };
    if (++directoryCalls === 1) throw serverMessage === null ? new Error('Offline') : { response: { status: 503, data: { message: serverMessage } } };
    return pending.promise;
  });
  render(tree());
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your organizations.');
  const requests = [...api.get.mock.calls];
  await act(async () => { await i18n.changeLanguage('ka'); });
  expect(screen.getByRole('alert')).toHaveTextContent(serverMessage ?? 'თქვენი ორგანიზაციები ვერ ჩაიტვირთა.');
  expect(api.get.mock.calls).toEqual(requests);
  expect(screen.queryByText(/ამჟამად ორგანიზაციის სამუშაო სივრცე არ გაქვთ/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'ხელახლა ცდა' }));
  expect(directoryCalls).toBe(2);
  expect(screen.getByText('ორგანიზაციები იტვირთება…')).toBeInTheDocument();
  await act(async () => pending.resolve({ data: [row(7002, 'Live', { status: 'DRAFT' })] }));
  const card = (await screen.findByRole('heading', { name: 'Live' })).closest('article')!;
  expect(within(card).getByText('მონახაზი')).toBeInTheDocument();
  expect(within(card).getByRole('link', { name: 'სამუშაო სივრცის გახსნა' })).toHaveAttribute('href', '/organizations/7002/workspace');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  await act(async () => { await i18n.changeLanguage('en'); });
  expect(screen.getByRole('heading', { name: 'Live' }).closest('article')).toBe(card);
  expect(within(card).getByText('Draft')).toBeInTheDocument();
  expect(directoryCalls).toBe(2);
});

it('lists every other workspace under the cards, so the account menu’s one line reaches them all', async () => {
  auth.user.navigationCapabilities = { version: 1, workspaces: [
    { id: 'squad.workspace', context: { type: 'squad', id: 105, label: 'U16 Boys' } }, { id: 'tournament.workspace', context: { type: 'tournament', id: 301, label: 'Tbilisi Cup' } },
    { id: 'referee.workspace', context: { type: 'user', id: 9502, label: 'Me' } }, { id: 'club.workspace', context: { type: 'club', id: 400, label: 'My academy' } },
  ] };
  reply([row(7000, 'My academy', { clubId: 400, organizationType: 'CLUB' })]); render(tree());
  const other = within(await screen.findByRole('region', { name: 'Squads, tournaments and other work' }));
  expect(other.getByRole('link', { name: /U16 Boys/ })).toHaveAttribute('href', '/squads/105');
  expect(other.getByRole('link', { name: /Tbilisi Cup/ })).toHaveAttribute('href', '/tournaments/301/workspace');
  expect(other.getByRole('link', { name: /Referee workspace/ })).toHaveAttribute('href', '/referees/me');
  // The club already has its card.
  expect(other.queryByRole('link', { name: /My academy/ })).not.toBeInTheDocument();
});
