import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CreateOrganizationPage } from '../CreateOrganizationPage';
import { apiClient } from '../../api/axiosConfig';
import { useAuth } from '../../context/AuthContext';
vi.mock('../../api/axiosConfig', () => ({ apiClient: { post: vi.fn() } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../components/MiniMap', () => ({ MiniMap: () => <div>Map picker</div> }));
let auth: ReturnType<typeof useAuth>;
const result = { id: 91, clubId: null, profilePath: '/organizations/91', workspacePath: '/organizations/91/workspace' };
const tree = (kind = 'SPONSOR') => <MemoryRouter initialEntries={[`/organizations/create?kind=${kind}`]}><CreateOrganizationPage /></MemoryRouter>;
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  auth = { user: { id: 17, navigationCapabilities: { version: 1, workspaces: [{ id: 'organization.create', context: { id: 17, type: 'user', label: 'Create' } }] } }, sessionId: 'first', refreshNavigationCapabilities: vi.fn().mockResolvedValue(undefined) } as unknown as ReturnType<typeof useAuth>;
  vi.mocked(useAuth).mockImplementation(() => auth);
  vi.mocked(apiClient.post).mockResolvedValue({ data: result });
});
async function review(user: ReturnType<typeof userEvent.setup>, name = 'Our organization') {
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  await user.type(screen.getByRole('textbox', { name: 'Name' }), name);
  await user.click(screen.getByRole('button', { name: 'Continue' }));
}
it('creates a tournament-only sponsor with explicit profile and workspace destinations', async () => {
  const user = userEvent.setup(); render(tree());
  expect(screen.getByRole('radio', { name: /Sponsor/ })).toBeChecked();
  await user.click(screen.getByRole('checkbox', { name: 'Organize tournaments' }));
  await review(user); expect(apiClient.post).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Create organization' }));
  expect(apiClient.post).toHaveBeenCalledWith('/organizations/setup', expect.objectContaining({ organizationType: 'SPONSOR', tournamentEnabled: true, venueEnabled: false, displayName: 'Our organization', requestId: expect.any(String) }));
  expect(await screen.findByRole('link', { name: 'Open workspace' })).toHaveAttribute('href', '/organizations/91/workspace');
  expect(screen.getByRole('link', { name: 'View profile' })).toHaveAttribute('href', '/organizations/91');
  expect(auth.refreshNavigationCapabilities).toHaveBeenCalledOnce();
});
it('keeps the same request and payload after an uncertain response', async () => {
  const user = userEvent.setup(); vi.mocked(apiClient.post).mockRejectedValueOnce({ response: { status: 503 } }).mockResolvedValueOnce({ data: result });
  render(tree()); await review(user);
  await user.click(screen.getByRole('button', { name: 'Create organization' }));
  await user.click(await screen.findByRole('button', { name: 'Retry same request' }));
  await screen.findByRole('link', { name: 'Open workspace' });
  expect(vi.mocked(apiClient.post).mock.calls[0][1]).toEqual(vi.mocked(apiClient.post).mock.calls[1][1]);
});
it('requires a club category and supplies it without relying on a login role', async () => {
  const user = userEvent.setup(); render(tree('CLUB'));
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  await user.selectOptions(screen.getByRole('combobox', { name: 'Club category' }), 'YOUTH_DEVELOPMENT');
  await review(user, 'Youth Academy'); await user.click(screen.getByRole('button', { name: 'Create organization' }));
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/organizations/setup', expect.objectContaining({ organizationType: 'CLUB', clubCategory: 'YOUTH_DEVELOPMENT' })));
});
it('discards a completed creation response after the authenticated session changes', async () => {
  let complete!: (value: unknown) => void; vi.mocked(apiClient.post).mockReturnValue(new Promise(resolve => { complete = resolve; }));
  const user = userEvent.setup(); const view = render(tree()); await review(user); await user.click(screen.getByRole('button', { name: 'Create organization' }));
  auth = { ...auth, sessionId: 'different' }; view.rerender(tree());
  await act(async () => complete({ data: result }));
  expect(screen.queryByRole('link', { name: 'Open workspace' })).not.toBeInTheDocument();
  expect(auth.refreshNavigationCapabilities).not.toHaveBeenCalled();
});
it('blocks creation when the server capability projection denies it', () => {
  auth = { ...auth, user: { ...auth.user, navigationCapabilities: { version: 1, workspaces: [] } } } as ReturnType<typeof useAuth>;
  render(tree()); expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
});
afterEach(() => vi.restoreAllMocks());

it('restores an unfinished draft after leaving setup without sending a creation request', async () => {
  const user = userEvent.setup(); const view = render(tree());
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Resumable sponsor');
  await user.type(screen.getByRole('textbox', { name: 'Public email' }), 'contact@example.test');
  view.unmount(); render(tree());
  expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Resumable sponsor');
  expect(screen.getByRole('textbox', { name: 'Public email' })).toHaveValue('contact@example.test');
  expect(apiClient.post).not.toHaveBeenCalled();
});

it('recovers a creation interrupted before any response with the original request after reload', async () => {
  vi.mocked(apiClient.post).mockImplementationOnce(() => new Promise(() => undefined));
  const user = userEvent.setup(); const view = render(tree()); await review(user);
  await user.click(screen.getByRole('button', { name: 'Create organization' }));
  const original = vi.mocked(apiClient.post).mock.calls[0][1];
  view.unmount(); render(tree());
  expect(apiClient.post).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Retry same request' }));
  expect(vi.mocked(apiClient.post).mock.calls[1][1]).toEqual(original);
  expect(await screen.findByRole('link', { name: 'Open workspace' })).toHaveAttribute('href', '/organizations/91/workspace');
});

it('keeps the completed receipt on return and starts another organization only deliberately', async () => {
  const user = userEvent.setup(); const view = render(tree()); await review(user);
  await user.click(screen.getByRole('button', { name: 'Create organization' })); await screen.findByRole('link', { name: 'Open workspace' });
  view.unmount(); render(tree());
  expect(screen.getByRole('link', { name: 'Open workspace' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Import venues' })).toHaveAttribute('href', '/organizations/91/workspace?tab=imports');
  await user.click(screen.getByRole('button', { name: 'Create another organization' }));
  await review(user, 'A second sponsor'); await user.click(screen.getByRole('button', { name: 'Create organization' }));
  expect((vi.mocked(apiClient.post).mock.calls[0][1] as { requestId: string }).requestId).not.toBe((vi.mocked(apiClient.post).mock.calls[1][1] as { requestId: string }).requestId);
});

it('never shows another account’s saved draft or pending creation', async () => {
  const user = userEvent.setup(); const view = render(tree()); await review(user, 'Private setup name'); view.unmount();
  auth = { ...auth, user: { ...auth.user!, id: 18 }, sessionId: 'next-account' }; render(tree());
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('');
  expect(screen.queryByText('Private setup name')).not.toBeInTheDocument();
});

it('rejects a whitespace-only organization name before reaching review', async () => {
  const user = userEvent.setup(); render(tree());
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  await user.type(screen.getByRole('textbox', { name: 'Name' }), '   ');
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Enter a name');
  expect(apiClient.post).not.toHaveBeenCalled();
});

it('keeps creation usable and explains when the browser cannot save recovery data', async () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
  const user = userEvent.setup(); render(tree());
  expect(screen.getByText(/This browser could not save your progress/)).toBeInTheDocument();
  await review(user); await user.click(screen.getByRole('button', { name: 'Create organization' }));
  expect(await screen.findByRole('link', { name: 'Open workspace' })).toBeInTheDocument();
});
