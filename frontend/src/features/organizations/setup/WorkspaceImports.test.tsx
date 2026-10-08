import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiClient } from '../../../api/axiosConfig';
import { WorkspaceImports } from './WorkspaceImports';

const account = vi.hoisted(() => ({ id: 17, sessionId: 'first-session' }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: account.id }, sessionId: account.sessionId }) }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: { post: vi.fn() } }));
vi.mock('./ImportMapping', () => ({ ImportMapping: ({ onMapped }: { onMapped: (rows: Record<string, string>[], rowNumbers: number[]) => void }) => <button onClick={() => onMapped([{ name: 'Junior squad', category: 'U12', gender: 'MIXED' }], [7])}>Map file</button> }));
const preview = { fingerprint: 'a'.repeat(64), ready: 1, duplicates: 0, errors: 0, rows: [{ row: 1, values: { name: 'Junior squad' }, status: 'READY', issues: [] }] };
const tree = (id = 91, blocked = false) => <WorkspaceImports id={id} clubId={4} blocked={blocked} />;
beforeEach(() => {
  sessionStorage.clear(); vi.resetAllMocks(); account.id = 17; account.sessionId = 'first-session';
  vi.mocked(apiClient.post).mockImplementation(async url => ({ data: url.endsWith('/preview') ? preview : { created: 1, skipped: 0 } }));
});

it('restores reviewed rows and physical row numbers after leaving the import tab', async () => {
  const user = userEvent.setup(), view = render(tree()); await user.click(screen.getByRole('button', { name: 'Map file' }));
  await screen.findByRole('button', { name: 'Create 1 squads' }); view.unmount(); render(tree());
  expect(within(screen.getAllByRole('row')[1]).getByText('7')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Create 1 squads' })).toBeInTheDocument();
  expect(apiClient.post).toHaveBeenCalledTimes(1);
});

it('saves the request before commit and replays that exact body after interruption', async () => {
  const user = userEvent.setup(), view = render(tree()); await user.click(screen.getByRole('button', { name: 'Map file' }));
  await screen.findByRole('button', { name: 'Create 1 squads' });
  vi.mocked(apiClient.post).mockImplementationOnce(() => new Promise(() => undefined));
  await user.click(screen.getByRole('button', { name: 'Create 1 squads' }));
  const original = vi.mocked(apiClient.post).mock.calls[1]; view.unmount(); render(tree());
  expect(apiClient.post).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('button', { name: 'Change file or mapping' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Retry same import' }));
  expect(vi.mocked(apiClient.post).mock.calls[2]).toEqual(original);
  expect(await screen.findByRole('status')).toHaveTextContent('1 squads created. 0 duplicate rows skipped.');
});

it('persists the receipt and allows another import deliberately', async () => {
  const user = userEvent.setup(), view = render(tree()); await user.click(screen.getByRole('button', { name: 'Map file' }));
  await user.click(await screen.findByRole('button', { name: 'Create 1 squads' })); await screen.findByRole('status'); view.unmount(); render(tree());
  expect(screen.getByRole('status')).toHaveTextContent('1 squads created');
  await user.click(screen.getByRole('button', { name: 'Import another file' })); expect(screen.getByRole('button', { name: 'Map file' })).toBeInTheDocument();
});

it('keeps reviews private to the current account and organization', async () => {
  const user = userEvent.setup(), view = render(tree()); await user.click(screen.getByRole('button', { name: 'Map file' }));
  await screen.findByRole('button', { name: 'Create 1 squads' });
  view.rerender(tree(92)); expect(screen.queryByText('Junior squad')).not.toBeInTheDocument();
  account.id = 18; view.rerender(tree()); expect(screen.queryByText('Junior squad')).not.toBeInTheDocument();
});

it('blocks invalid rows with an actionable original-file row number', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({ data: { ...preview, ready: 0, errors: 1, rows: [{ ...preview.rows[0], status: 'INVALID', issues: ['Gender must be MALE, FEMALE or MIXED.'] }] } });
  const user = userEvent.setup(); render(tree()); await user.click(screen.getByRole('button', { name: 'Map file' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('No rows have been imported');
  expect(screen.getByRole('button', { name: 'Create 0 squads' })).toBeDisabled();
  expect(within(screen.getAllByRole('row')[1]).getByText('7')).toBeInTheDocument();
});

it('ignores a completed response from a retired account', async () => {
  const user = userEvent.setup(), view = render(tree()); await user.click(screen.getByRole('button', { name: 'Map file' }));
  let finish!: (value: unknown) => void;
  vi.mocked(apiClient.post).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  fireEvent.click(await screen.findByRole('button', { name: 'Create 1 squads' }));
  account.id = 18; account.sessionId = 'other-session'; view.rerender(tree());
  await act(async () => finish({ data: { created: 1, skipped: 0 } }));
  expect(screen.queryByText(/1 squads created/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Map file' })).toBeInTheDocument();
});
