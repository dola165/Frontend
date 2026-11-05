import '../../../i18n';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { OrganizationPresence } from './OrganizationPresence';

const auth = vi.hoisted(() => ({ sessionId: 'business-a', user: { id: 41 } }));
const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: api }));
const profile = { id: 7, clubId: null, publicPhone: '+995 555 123456', publicEmail: 'contact@example.test', website: 'https://example.test', canEdit: true };
const publication = { published: true, revision: 'before', verificationStatus: 'UNVERIFIED' };
function reads(published = true) {
  api.get.mockImplementation(async (url: string) => ({ data: url.endsWith('/publication') ? { ...publication, published } : profile }));
}
const tree = (canManage = true, blocked = false, id = 7) => <MemoryRouter><OrganizationPresence id={id} canManage={canManage} blocked={blocked} /></MemoryRouter>;
beforeEach(() => { vi.resetAllMocks(); localStorage.clear(); auth.sessionId = 'business-a'; auth.user.id = 41; localStorage.setItem('gk-session-id', auth.sessionId); reads(); });

it('uses real public contacts and the existing versioned page editor without inventing verification', async () => {
  render(tree());
  expect(await screen.findByRole('link', { name: /contact@example.test/ })).toHaveAttribute('href', 'mailto:contact@example.test');
  expect(screen.getByRole('link', { name: /example.test.*Website/ })).toHaveAttribute('href', 'https://example.test/');
  expect(screen.getByRole('link', { name: 'Edit page and contacts' })).toHaveAttribute('href', '/organizations/7?edit=1');
  expect(screen.queryByText('Verified organization')).not.toBeInTheDocument();
  expect(api.put).not.toHaveBeenCalled();
});

it('requires an explicit visibility decision and preserves the page when it is cancelled', async () => {
  render(tree()); fireEvent.click(await screen.findByRole('button', { name: 'Withdraw public page' }));
  expect(api.put).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('button', { name: 'Confirm visibility change' })).not.toBeInTheDocument();
  expect(api.put).not.toHaveBeenCalled();
});

it('withdraws with the displayed revision and current session, then permits a fresh publication decision', async () => {
  api.put.mockResolvedValue({ data: { ...publication, published: false, revision: 'after' } });
  render(tree()); fireEvent.click(await screen.findByRole('button', { name: 'Withdraw public page' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm visibility change' }));
  expect(await screen.findByText('Your public page is withdrawn. Your organization work remains available.')).toBeVisible();
  expect(api.put).toHaveBeenCalledWith('/organizations/7/publication', { expectedRevision: 'before', published: false }, { _authSessionId: 'business-a' });
  fireEvent.click(screen.getByRole('button', { name: 'Publish public page' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm visibility change' }));
  await waitFor(() => expect(api.put).toHaveBeenLastCalledWith('/organizations/7/publication', { expectedRevision: 'after', published: true }, { _authSessionId: 'business-a' }));
});

it.each([409, 403, 503])('does not claim success after %s and requires reloading before a new decision', async status => {
  api.put.mockRejectedValue({ response: { status, data: { message: 'Reload current authority and visibility.' } } });
  render(tree()); fireEvent.click(await screen.findByRole('button', { name: 'Withdraw public page' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm visibility change' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Reload current authority and visibility.');
  expect(screen.queryByText('Your public page is withdrawn. Your organization work remains available.')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Withdraw public page' })).not.toBeInTheDocument();
  reads(false); fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
  expect(await screen.findByRole('button', { name: 'Publish public page' })).toBeVisible();
});

it('current staff can inspect the saved presence without receiving edit or publication actions', async () => {
  render(tree(false)); await screen.findByRole('link', { name: /contact@example.test/ });
  expect(screen.queryByRole('link', { name: 'Edit page and contacts' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /public page/ })).not.toBeInTheDocument();
});

it('keeps restricted promotion quiet but allows an owner to withdraw the existing publication', async () => {
  render(tree(true, true)); expect(await screen.findByText('Public promotion is restricted. Organization work remains available.')).toBeVisible();
  expect(screen.queryByRole('link', { name: /contact@example.test/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Edit page and contacts' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Withdraw public page' })).toBeVisible();
});

it('rejects a mismatched organization response and never exposes club data in this home', async () => {
  api.get.mockImplementation(async (url: string) => ({ data: url.endsWith('/publication') ? publication : { ...profile, clubId: 22 } }));
  render(tree()); expect(await screen.findByRole('alert')).toBeVisible();
  expect(screen.queryByRole('link', { name: /contact@example.test/ })).not.toBeInTheDocument();
});

it('ignores a late read after the account session is retired', async () => {
  let finish!: (value: unknown) => void;
  api.get.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  render(tree()); localStorage.setItem('gk-session-id', 'business-b');
  await act(async () => { finish({ data: publication }); });
  expect(screen.queryByRole('button', { name: /public page/ })).not.toBeInTheDocument();
});

it('does not send a confirmed decision after logout or a switch to a different account', async () => {
  render(tree()); fireEvent.click(await screen.findByRole('button', { name: 'Withdraw public page' }));
  localStorage.setItem('gk-session-id', 'business-b'); fireEvent.click(screen.getByRole('button', { name: 'Confirm visibility change' }));
  expect(api.put).not.toHaveBeenCalled();
});

it('does not infer a private or published state from an incomplete visibility response', async () => {
  api.get.mockResolvedValue({ data: {} }); render(tree());
  expect(await screen.findByRole('alert')).toBeVisible();
  expect(screen.queryByRole('button', { name: /public page/ })).not.toBeInTheDocument();
});

it('captures the visibility token before requesting the profile the person will review', async () => {
  let finish!: (value: unknown) => void;
  api.get.mockImplementation((url: string) => url.endsWith('/publication') ? new Promise(resolve => { finish = resolve; }) : Promise.resolve({ data: profile }));
  render(tree()); await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
  expect(api.get.mock.calls[0][0]).toBe('/organizations/7/publication');
  await act(async () => { finish({ data: publication }); });
  await screen.findByRole('button', { name: 'Withdraw public page' });
  expect(api.get.mock.calls.map(args => args[0])).toEqual(['/organizations/7/publication', '/organizations/7']);
});
