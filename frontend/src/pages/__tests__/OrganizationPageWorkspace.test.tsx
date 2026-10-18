import '../../i18n';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { OrganizationWorkspacePage } from '../OrganizationWorkspacePage';
import { makePage } from '../../features/pages/__tests__/fixtures';
import type { PageView } from '../../features/pages/api';

const auth = vi.hoisted(() => ({ sessionId: 'owner-a', status: 'authenticated', user: { id: 9502, role: 'OWNER' }, refreshNavigationCapabilities: vi.fn() }));
const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../api/axiosConfig', () => ({ apiClient: api }));
vi.mock('../../features/organizations/OrganizationPortfolio', () => ({ OrganizationPortfolio: () => <p>Existing venue portfolio</p> }));
vi.mock('../../features/organizations/setup/OrganizationTeam', () => ({ OrganizationTeam: () => <p>Stored organization team</p> }));
vi.mock('../../features/organizations/setup/OrganizationLifecycle', () => ({ OrganizationLifecycle: () => <p>Current organization responsibility</p> }));

const denied = (status: number, message = 'Server refused this request') => ({ response: { status, data: { message } } });
const page = (kind: PageView['kind'] = 'FAN_CLUB', role: PageView['viewer']['role'] = 'OWNER', canEdit = true) => makePage({ kind, viewer: { role, canEdit, editable: canEdit ? 'ALL' : [], canClaim: false } });
function Destination() { const location = useLocation(); return <p data-testid="destination">{location.pathname}{location.search}</p>; }
const tree = (query = '') => <MemoryRouter initialEntries={[`/organizations/7002/workspace${query}`]}><Routes><Route path="/organizations/:organizationId/workspace" element={<OrganizationWorkspacePage />} /><Route path="*" element={<Destination />} /></Routes></MemoryRouter>;
const pageReply = (reply: PageView) => api.get.mockImplementation(async (url: string) => {
  if (url === '/organizations/7002/page') return { data: reply };
  throw denied(404, 'No legacy workspace');
});
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
beforeEach(() => {
  vi.resetAllMocks(); sessionStorage.clear(); localStorage.clear();
  auth.sessionId = 'owner-a'; auth.status = 'authenticated'; auth.user.id = 9502;
  localStorage.setItem('gk-session-id', auth.sessionId);
});

it.each(['FAN_CLUB', 'BUSINESS', 'PAGE'] as const)('%s confirmed OWNER workspace enters its existing page editor', async kind => {
  pageReply(page(kind)); render(tree());
  expect(await screen.findByTestId('destination')).toHaveTextContent('/organizations/7002?edit=1');
  expect(api.get.mock.calls.map(args => args[0])).toEqual(['/organizations/7002/page']);
  expect(api.put).not.toHaveBeenCalled();
});

it('preserves the organization team destination and reads current operational access', async () => {
  api.get.mockImplementation(async (url: string) => {
    if (url === '/organizations/7002/page') return { data: page('BUSINESS', 'ADMIN') };
    if (url === '/organizations/7002/workspace') return { data: { id: 7002, displayName: 'Organization team workspace', clubId: null, organizationType: 'COMPANY', membershipRole: 'ADMIN', canManage: true, venueCount: 0, tournaments: [], capabilities: { enabledActivities: ['PROFILE'] } } };
    throw denied(404);
  });
  render(tree('?tab=team'));
  expect(await screen.findByText('Stored organization team')).toBeVisible();
  expect(api.get.mock.calls.map(args => args[0])).toEqual(['/organizations/7002/workspace']);
  expect(screen.queryByTestId('destination')).not.toBeInTheDocument();
});

it('ignores a retired-session operational response on the team destination', async () => {
  const reply = deferred<{ data: object }>(); api.get.mockReturnValue(reply.promise); render(tree('?tab=team'));
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/organizations/7002/workspace', expect.any(Object)));
  localStorage.setItem('gk-session-id', 'owner-b'); await act(async () => reply.resolve({ data: { id: 7002, displayName: 'Old private organization', canManage: true } }));
  expect(screen.queryByText('Old private organization')).not.toBeInTheDocument(); expect(screen.queryByText('Stored organization team')).not.toBeInTheDocument();
});

it.each([['OWNER', false], ['COACH', true], [null, false]] as const)('does not infer edit access from role %s with canEdit %s', async (role, canEdit) => {
  pageReply(page('PAGE', role, canEdit)); render(tree());
  expect(await screen.findByRole('alert')).toHaveTextContent('Only current owners and administrators can edit this profile.');
  expect(screen.queryByTestId('destination')).not.toBeInTheDocument();
  expect(api.get.mock.calls.map(args => args[0])).toEqual(['/organizations/7002/page']);
});

it('a page 404 and a local OWNER claim do not grant editor access', async () => {
  api.get.mockRejectedValue(denied(404, 'Not available in the sandbox yet.'));
  render(tree());
  expect(await screen.findByRole('alert')).toHaveTextContent('Not available in the sandbox yet.');
  expect(api.get.mock.calls.map(args => args[0])).toEqual(['/organizations/7002/page', '/organizations/7002/workspace']);
  expect(screen.queryByTestId('destination')).not.toBeInTheDocument();
});

it('does not treat an explicit page authorization refusal as a legacy page', async () => {
  api.get.mockRejectedValue(denied(403)); render(tree());
  expect(await screen.findByRole('alert')).toHaveTextContent('Server refused this request');
  expect(api.get.mock.calls.map(args => args[0])).toEqual(['/organizations/7002/page']);
  expect(screen.queryByTestId('destination')).not.toBeInTheDocument();
});

it('keeps a failed permission read honest and retries that read before redirecting', async () => {
  api.get.mockRejectedValueOnce(denied(503)).mockResolvedValueOnce({ data: page('PAGE') });
  render(tree());
  expect(await screen.findByRole('alert')).toHaveTextContent('Server refused this request');
  expect(screen.queryByTestId('destination')).not.toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByTestId('destination')).toHaveTextContent('/organizations/7002?edit=1');
  expect(api.get.mock.calls.map(args => args[0])).toEqual(['/organizations/7002/page', '/organizations/7002/page']);
});

it('does not redirect on an owner response for a different organization', async () => {
  const other = page(); other.ref = { type: 'organization', id: 7003 }; other.organizationId = 7003;
  pageReply(other); render(tree());
  expect(await screen.findByRole('alert')).toBeVisible();
  expect(screen.queryByTestId('destination')).not.toBeInTheDocument();
  expect(api.get.mock.calls.map(args => args[0])).toEqual(['/organizations/7002/page']);
});

it.each(['owner response', '404 refusal'] as const)('ignores an old %s when storage retires the session before React updates', async outcome => {
  const reply = deferred<{ data: PageView }>(); api.get.mockReturnValue(reply.promise);
  render(tree()); await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
  localStorage.setItem('gk-session-id', 'owner-b');
  await act(async () => {
    if (outcome === 'owner response') reply.resolve({ data: page() });
    else reply.reject(denied(404));
  });
  expect(screen.queryByTestId('destination')).not.toBeInTheDocument();
  expect(api.get).toHaveBeenCalledTimes(1);
});

it('ignores a late owner response after the workspace belongs to the next login', async () => {
  const oldReply = deferred<{ data: PageView }>();
  api.get.mockReturnValueOnce(oldReply.promise).mockResolvedValueOnce({ data: page('PAGE', null, false) });
  const view = render(tree()); await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
  auth.sessionId = 'owner-b'; auth.user.id = 9503; localStorage.setItem('gk-session-id', auth.sessionId);
  view.rerender(tree());
  expect(await screen.findByRole('alert')).toHaveTextContent('Only current owners and administrators can edit this profile.');
  await act(async () => { oldReply.resolve({ data: page() }); });
  expect(screen.queryByTestId('destination')).not.toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('Only current owners and administrators can edit this profile.');
  expect(api.get).toHaveBeenCalledTimes(2);
});

it.each([false, true])('keeps the existing legacy organization workspace with venueAvailable=%s', async venueAvailable => {
  api.get.mockImplementation(async (url: string) => {
    if (url.endsWith('/page')) throw denied(404);
    return { data: { id: 7002, displayName: 'Legacy organization', clubId: null, organizationType: 'COMPANY', identityRevision: 1, membershipRole: 'OPERATOR', canManage: false,
      promotionBlocked: false, venueCount: 0, tournaments: [], capabilities: { venueAvailable, enabledActivities: venueAvailable ? ['PROFILE', 'VENUE'] : ['PROFILE'] } } };
  });
  render(tree());
  expect(await screen.findByRole('heading', { name: 'Legacy organization', level: 1 })).toBeVisible();
  expect(screen.getByRole('link', { name: venueAvailable ? '← My venues' : '← My organizations' })).toHaveAttribute('href', venueAvailable ? '/my-organizations?kind=VENUE' : '/my-organizations');
  expect(screen.queryByTestId('destination')).not.toBeInTheDocument();
});
