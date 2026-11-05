import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { beforeAll, afterAll, afterEach, beforeEach, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import '../../i18n';
import { makePage } from '../../features/pages/__tests__/fixtures';

const auth = vi.hoisted(() => ({ signedIn: false }));
vi.mock('../../context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => ({ status: auth.signedIn ? 'authenticated' : 'anonymous', isAuthenticated: auth.signedIn, isBootstrapping: false, sessionId: 'public-business-route',
    user: auth.signedIn ? { id: 41, role: 'OWNER', fullName: 'Synthetic unrelated owner', profileComplete: true, onboardingRequired: false, mustChangePassword: false } : null, logout: vi.fn() }),
}));
vi.mock('../../features/clubs/api', () => ({ fetchMyClubMembershipContext: vi.fn().mockResolvedValue({ hasClubMembership: false }) }));
vi.mock('../LoginPage', () => ({ LoginPage: () => <h1>Sign in first</h1> }));
import App from '../../App';

let visibility: 'PUBLIC' | 'DRAFT' | 'WITHDRAWN' | 'RESTRICTED' = 'PUBLIC';
const requests: string[] = [];
const base = makePage({ kind: 'BUSINESS', status: 'LIVE', verification: 'NONE', viewer: { role: null, canEdit: false, editable: [] } });
const publicPage = { ...base, identity: { ...base.identity, name: 'Synthetic public business', contact: { phone: '+995555123456', email: 'public@example.test' }, social: { website: 'https://example.test', instagram: '', facebook: '' } } };
const unavailable = () => HttpResponse.json({ detail: 'This page is not available.', error: 'This page is not available.' }, { status: 404 });
const server = setupServer(
  http.get('*/api/organizations/7002/page', () => { requests.push('page'); return visibility === 'PUBLIC' ? HttpResponse.json(publicPage) : unavailable(); }),
  http.get('*/api/organizations/7002/presentation', () => { requests.push('presentation'); return unavailable(); }),
  http.get('*/api/posts/organization/7002', () => HttpResponse.json({ posts: [], nextCursor: null, hasMore: false })),
  http.get('*/api/version', () => HttpResponse.json({})),
);
beforeAll(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined); server.listen({ onUnhandledRequest: 'error' }); });
afterAll(() => { server.close(); vi.restoreAllMocks(); });
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('gk-session-id', 'public-business-route'); auth.signedIn = false; visibility = 'PUBLIC'; requests.length = 0; });
afterEach(() => { cleanup(); server.resetHandlers(); window.history.replaceState({}, '', '/'); });
const open = (path = '/organizations/7002') => { window.history.replaceState({}, '', path); render(<App />); };

it.each(['', '?edit=1'])('renders the real organization page and contacts signed out%s without edit authority', async query => {
  open('/organizations/7002' + query);
  expect(await screen.findByRole('heading', { name: 'Synthetic public business' })).toBeVisible();
  expect(screen.getByRole('link', { name: /public@example.test/ })).toHaveAttribute('href', 'mailto:public@example.test');
  expect(screen.getByRole('link', { name: /example.test.*Website/ })).toHaveAttribute('href', 'https://example.test/');
  expect(window.location.pathname).toBe('/organizations/7002');
  expect(screen.queryByRole('heading', { name: 'Sign in first' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Go live' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Edit page' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Manage your organization team' })).not.toBeInTheDocument();
  expect(screen.queryByText('Verified')).not.toBeInTheDocument();
});

it.each(['DRAFT', 'WITHDRAWN', 'RESTRICTED'] as const)('does not expose a server-refused %s page through its now-public route', async state => {
  visibility = state; open('/organizations/7002?edit=1');
  expect(await screen.findByRole('alert')).toHaveTextContent('This page is not available.');
  expect(screen.queryByRole('heading', { name: 'Synthetic public business' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /public@example.test/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Go live' })).not.toBeInTheDocument();
});

it.each(['/organizations/7002/workspace', '/organizations/create', '/my-organizations'])('keeps the signed-out work/create destination %s protected', async path => {
  open(path);
  expect(await screen.findByRole('heading', { name: 'Sign in first' })).toBeVisible();
  expect(new URLSearchParams(window.location.search).get('next')).toBe(path);
  expect(requests).toEqual([]);
});

it('a signed-in owner elsewhere still receives only this page’s public projection', async () => {
  auth.signedIn = true; open('/organizations/7002?edit=1');
  await screen.findByRole('heading', { name: 'Synthetic public business' });
  expect(screen.queryByRole('button', { name: 'Go live' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Manage your organization team' })).not.toBeInTheDocument();
});
