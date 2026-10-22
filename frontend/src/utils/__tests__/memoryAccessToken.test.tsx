import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// The access token lives only in memory; a reload asks for a fresh one with the refresh cookie.
const refresh = vi.fn(() => HttpResponse.json({ accessToken: 'from-cookie' }));
const server = setupServer(
    http.get('*/auth/csrf', () => HttpResponse.json({ headerName: 'X-XSRF-TOKEN', token: 'csrf' })),
    http.post('*/auth/refresh', refresh),
    http.get('*/users/me', ({ request }) => request.headers.get('Authorization') === 'Bearer from-cookie'
        ? HttpResponse.json({ id: 1, fullName: 'Alpha', profileComplete: true, emailVerified: true })
        : new HttpResponse(null, { status: 401 })),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
beforeEach(() => { vi.resetModules(); localStorage.clear(); refresh.mockClear(); });
afterEach(() => { cleanup(); server.resetHandlers(); });

const storedTokenKeys = () => Object.keys(localStorage).filter(key => key === 'accessToken' || key.startsWith('gk-session-token:'));

it('never writes an access token to browser storage', async () => {
    const auth = await import('../authStorage');
    auth.setStoredAccessToken('signed-in');
    auth.setRefreshedAccessToken('renewed', auth.getAuthSessionId());
    expect(auth.getStoredAccessToken()).toBe('renewed');
    expect(storedTokenKeys()).toEqual([]);
    expect(JSON.stringify({ ...localStorage })).not.toContain('renewed');
    expect(auth.isSignedInSession(auth.getAuthSessionId())).toBe(true);
    auth.clearStoredAuth();
    expect(auth.getStoredAccessToken()).toBeNull();
    expect(auth.isSignedInSession(auth.getAuthSessionId())).toBe(false);
});

it('marks a new sign-in before announcing its session id to other tabs', async () => {
    const auth = await import('../authStorage');
    const writes: string[] = [];
    const original = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
        writes.push(key); original.call(this, key, value);
    });
    auth.setStoredAccessToken('signed-in');
    spy.mockRestore();
    expect(writes.indexOf('gk-signed-in-session')).toBeGreaterThanOrEqual(0);
    expect(writes.indexOf('gk-signed-in-session')).toBeLessThan(writes.indexOf('gk-session-id'));
});

it('deletes tokens stored before the switch on first load and keeps that session signed in', async () => {
    localStorage.setItem('gk-session-id', 'session-1');
    localStorage.setItem('gk-session-token:session-1', 'old-token');
    localStorage.setItem('gk-session-token:retired', 'older-token');
    localStorage.setItem('accessToken', 'old-token');
    const auth = await import('../authStorage');
    expect(storedTokenKeys()).toEqual([]);
    expect(auth.getStoredAccessToken()).toBeNull();
    expect(auth.isSignedInSession('session-1')).toBe(true);
});

it('restores a signed-in session after a reload from the refresh cookie alone', async () => {
    localStorage.setItem('gk-session-id', 'session-2');
    localStorage.setItem('gk-signed-in-session', 'session-2');
    const { AuthProvider, useAuth } = await import('../../context/AuthContext');
    function Probe() { const auth = useAuth(); return <output>{auth.status}:{auth.user?.fullName ?? '-'}</output>; }
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText('authenticated:Alpha');
    expect(refresh).toHaveBeenCalledOnce();
    expect((await import('../authStorage')).getStoredAccessToken()).toBe('from-cookie');
    expect(storedTokenKeys()).toEqual([]);
});

it('stays signed out after a reload of a signed-out session without asking for a token', async () => {
    localStorage.setItem('gk-session-id', 'session-3');
    const { AuthProvider, useAuth } = await import('../../context/AuthContext');
    function Probe() { const auth = useAuth(); return <output>{auth.status}</output>; }
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText('anonymous');
    expect(refresh).not.toHaveBeenCalled();
});

it('keeps the sign-in when a reload meets a refresh conflict instead of signing every tab out', async () => {
    localStorage.setItem('gk-session-id', 'session-4');
    localStorage.setItem('gk-signed-in-session', 'session-4');
    server.use(http.post('*/auth/refresh', () => HttpResponse.json({ code: 'REFRESH_ALREADY_ROTATED' }, { status: 409 })));
    const { AuthProvider } = await import('../../context/AuthContext');
    render(<AuthProvider><output>signed-in shell</output></AuthProvider>);
    await screen.findByRole('alert', {}, { timeout: 5000 });
    expect(localStorage.getItem('gk-signed-in-session')).toBe('session-4');
    expect(localStorage.getItem('gk-session-id')).toBe('session-4');
});

it('keeps the sign-in when a reload meets a refused CSRF check twice instead of signing every tab out', async () => {
    localStorage.setItem('gk-session-id', 'session-5');
    localStorage.setItem('gk-signed-in-session', 'session-5');
    server.use(http.post('*/auth/refresh', () => new HttpResponse(null, { status: 403 })));
    const { AuthProvider } = await import('../../context/AuthContext');
    render(<AuthProvider><output>signed-in shell</output></AuthProvider>);
    await screen.findByRole('alert', {}, { timeout: 5000 });
    expect(localStorage.getItem('gk-signed-in-session')).toBe('session-5');
    expect(localStorage.getItem('gk-session-id')).toBe('session-5');
});
