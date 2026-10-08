import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { AuthProvider, useAuth } from '../AuthContext';
import { getStoredAccessToken, setStoredAccessToken } from '../../utils/authStorage';

const csrf = () => HttpResponse.json({ headerName: 'X-XSRF-TOKEN', token: 'csrf' });
const user = (id: number) => HttpResponse.json({ id, fullName: id === 1 ? 'Alpha' : 'Bravo',
    profileComplete: true, emailVerified: true, onboardingRequired: false });
const server = setupServer(
    http.get('*/auth/csrf', csrf),
    http.get('*/users/me', ({ request }) => user(request.headers.get('Authorization') === 'Bearer B' ? 2 : 1)),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); server.resetHandlers(); });
function latch() {
    let release!: () => void;
    const promise = new Promise<void>(resolve => { release = resolve; });
    return { promise, release };
}
let auth!: ReturnType<typeof useAuth>;
function Probe() {
    const current = useAuth();
    useEffect(() => { auth = current; }, [current]);
    return <output>{current.status}:{current.user?.fullName ?? '-'}</output>;
}

it.each([200, 401])('does not restore or clear A after a late profile %s while login B completes', async status => {
    const started = latch(), finish = latch();
    const refresh = vi.fn(() => new HttpResponse(null, { status: 401 }));
    server.use(
        http.get('*/users/me', async ({ request }) => {
            if (request.headers.get('Authorization') === 'Bearer B') return user(2);
            started.release(); await finish.promise;
            return status === 200 ? user(1) : new HttpResponse(null, { status: 401 });
        }),
        http.post('*/auth/refresh', refresh),
    );
    setStoredAccessToken('A'); render(<AuthProvider><Probe /></AuthProvider>);
    await started.promise;
    const oldBootstrap = auth.bootstrapSession();
    await act(async () => { await auth.loginWithAccessToken('B'); });
    await screen.findByText('authenticated:Bravo');
    await act(async () => { finish.release(); await oldBootstrap; });
    expect(screen.getByText('authenticated:Bravo')).toBeInTheDocument();
    expect(getStoredAccessToken()).toBe('B'); expect(localStorage.getItem('userId')).toBe('2');
    expect(refresh).not.toHaveBeenCalled();
});

it.each([200, 401])('does not let silent bootstrap refresh %s undo a completed login', async status => {
    const started = latch(), finish = latch();
    server.use(http.post('*/auth/refresh', async () => {
        started.release(); await finish.promise;
        return status === 200 ? HttpResponse.json({ accessToken: 'A' }) : new HttpResponse(null, { status: 401 });
    }));
    render(<AuthProvider><Probe /></AuthProvider>);
    await started.promise;
    const oldBootstrap = auth.bootstrapSession();
    await act(async () => { await auth.loginWithAccessToken('B'); });
    await act(async () => { finish.release(); await oldBootstrap; });
    expect(screen.getByText('authenticated:Bravo')).toBeInTheDocument();
    expect(getStoredAccessToken()).toBe('B');
});

it('clears locally at logout and does not send delayed logout against a subsequent login', async () => {
    setStoredAccessToken('A'); render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText('authenticated:Alpha');
    const started = latch(), finish = latch(); let csrfRequests = 0;
    const logout = vi.fn(() => HttpResponse.json({ message: 'Logged out' }));
    server.use(
        http.get('*/auth/csrf', async () => {
            if (++csrfRequests === 1) { started.release(); await finish.promise; }
            return csrf();
        }),
        http.post('*/auth/logout', logout),
    );
    let pending!: Promise<void>;
    await act(async () => { pending = auth.logout(); await started.promise; });
    expect(screen.getByText('anonymous:-')).toBeInTheDocument();
    expect(getStoredAccessToken()).toBeNull();
    await act(async () => { await auth.loginWithAccessToken('B'); });
    await act(async () => { finish.release(); await pending; });
    await waitFor(() => expect(screen.getByText('authenticated:Bravo')).toBeInTheDocument());
    expect(getStoredAccessToken()).toBe('B'); expect(logout).not.toHaveBeenCalled();
});
