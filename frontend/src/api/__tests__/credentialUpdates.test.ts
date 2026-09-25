import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { waitFor } from '@testing-library/react';

const server = setupServer();
const jwt = (revision: string, sub = '7') => `header.${btoa(JSON.stringify({ sub, revision }))}.signature`;
const codes = Array.from({ length: 10 }, (_, index) => `recovery-code-${index}`);
const changes = ['enable', 'disable', 'link', 'unlink', 'onboarding'] as const;
type Change = typeof changes[number];
const latch = () => {
    let release!: () => void;
    const promise = new Promise<void>(resolve => { release = resolve; });
    return { promise, release };
};
const observe = <T,>(promise: Promise<T>) => promise.then(value => ({ value }), error => ({ error }));
const pathFor = (change: Change) => change === 'onboarding' ? '/users/me/onboarding'
    : change === 'enable' || change === 'disable' ? `/users/me/two-factor/${change}` : `/users/me/providers/google/${change}`;
const resultFor = (change: Change) => ({ accessToken: jwt('updated'), enabled: change !== 'disable', recoveryCodes: codes,
    provider: 'google', linked: change !== 'unlink', linkedAccounts: change === 'unlink' ? [] : [{ provider: 'google' }] });
let lock: ReturnType<typeof vi.fn>;
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
beforeEach(async () => {
    vi.resetModules(); localStorage.clear();
    let tail: Promise<unknown> = Promise.resolve();
    lock = vi.fn((_name: string, _options: LockOptions, callback: () => Promise<unknown>) => {
        const result = tail.then(callback); tail = result.catch(() => undefined); return result;
    });
    Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: lock } });
    server.use(http.get('*/auth/csrf', () => HttpResponse.json({ headerName: 'X-XSRF-TOKEN', token: 'csrf' })));
    (await import('../../utils/authStorage')).setStoredAccessToken(jwt('old'));
});
afterEach(() => { server.resetHandlers(); Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined }); });

async function mutation(change: Change, signal = new AbortController().signal) {
    if (change === 'enable') return (await import('../../features/twoFactor/api')).saveTwoFactor('enable', 'password', '123456', signal);
    if (change === 'disable') return (await import('../../features/twoFactor/api')).disableTwoFactor('password', '123456', signal);
    if (change === 'link') return (await import('../../features/providers/api')).linkGoogleProvider(7, { currentPassword: 'password' }, 'google-proof', signal);
    if (change === 'unlink') return (await import('../../features/providers/api')).unlinkGoogleProvider(7, { currentPassword: 'password' }, signal);
    const { apiClient } = await import('../axiosConfig');
    const { credentialUpdate } = await import('../credentialUpdates');
    const auth = await import('../../utils/authStorage'); const session = auth.getAuthSessionId();
    return credentialUpdate(config => apiClient.put<{ accessToken: string }>(pathFor(change), { fullName: 'A Person' }, config),
        response => auth.setRefreshedAccessToken(response.data.accessToken, session), signal);
}

it.each(changes)('%s adopts its credentials before another tab can refresh a rejected old bearer', async change => {
    const started = latch(), finish = latch(), rejected = latch(); let refreshes = 0; let reads = 0;
    const handler = async () => { started.release(); await finish.promise; return HttpResponse.json(resultFor(change)); };
    server.use(change === 'onboarding' ? http.put(`*${pathFor(change)}`, handler) : http.post(`*${pathFor(change)}`, handler),
        http.get('*/protected', ({ request }) => {
            reads++;
            if (request.headers.get('Authorization') === `Bearer ${jwt('old')}`) { rejected.release(); return new HttpResponse(null, { status: 401 }); }
            expect(request.headers.get('Authorization')).toBe(`Bearer ${jwt('updated')}`); return HttpResponse.json({ ok: true });
        }), http.post('*/auth/refresh', () => { refreshes++; return new HttpResponse(null, { status: 401 }); }));
    const auth = await import('../../utils/authStorage'); const session = auth.getAuthSessionId();
    const updated = mutation(change); await started.promise;
    vi.resetModules(); const otherTab = await import('../axiosConfig');
    const read = otherTab.apiClient.get('/protected'); await rejected.promise;
    await waitFor(() => expect(lock).toHaveBeenCalledTimes(2)); expect(refreshes).toBe(0);
    finish.release(); const result = await updated; await read;
    expect(refreshes).toBe(0); expect(reads).toBe(2); expect(auth.getStoredAccessToken()).toBe(jwt('updated'));
    expect(auth.getAuthSessionId()).toBe(session);
    if (change === 'enable') expect(result).toEqual(codes);
});

it.each(changes)('%s waits for another tab refresh before sending its mutation with the new bearer', async change => {
    const started = latch(), finish = latch(); let writes = 0;
    server.use(http.post('*/auth/refresh', async () => { started.release(); await finish.promise; return HttpResponse.json({ accessToken: jwt('refreshed') }); }));
    const handler = ({ request }: { request: Request }) => {
        writes++; expect(request.headers.get('Authorization')).toBe(`Bearer ${jwt('refreshed')}`); return HttpResponse.json(resultFor(change));
    };
    server.use(change === 'onboarding' ? http.put(`*${pathFor(change)}`, handler) : http.post(`*${pathFor(change)}`, handler));
    const firstTab = await import('../axiosConfig'); const refresh = firstTab.refreshAccessToken(); await started.promise;
    vi.resetModules(); const pending = mutation(change);
    await waitFor(() => expect(lock).toHaveBeenCalledTimes(2)); expect(writes).toBe(0);
    finish.release(); await refresh; await pending;
    expect(writes).toBe(1); expect((await import('../../utils/authStorage')).getStoredAccessToken()).toBe(jwt('updated'));
});

it('releases the mutation lock before its 401 renewal and retries the write only once', async () => {
    let writes = 0; let refreshes = 0;
    server.use(http.post('*/users/me/two-factor/enable', ({ request }) => {
        writes++;
        return request.headers.get('Authorization') === `Bearer ${jwt('refreshed')}`
            ? HttpResponse.json(resultFor('enable')) : new HttpResponse(null, { status: 401 });
    }), http.post('*/auth/refresh', () => { refreshes++; return HttpResponse.json({ accessToken: jwt('refreshed') }); }));
    expect(await mutation('enable')).toEqual(codes); expect(refreshes).toBe(1); expect(writes).toBe(2);
    expect(lock).toHaveBeenCalledTimes(3);
});

it('does not clear a newer same-account credential publication when an old refresh returns late', async () => {
    for (const status of [200, 401]) {
        const started = latch(), finish = latch();
        const auth = await import('../../utils/authStorage'); auth.setStoredAccessToken(jwt('old'));
        const session = auth.getAuthSessionId();
        server.use(http.post('*/auth/refresh', async () => {
            started.release(); await finish.promise;
            return status === 200 ? HttpResponse.json({ accessToken: jwt('stale') }) : new HttpResponse(null, { status: 401 });
        }));
        const pending = (await import('../axiosConfig')).refreshAccessToken(); await started.promise;
        // An already-open older client may publish outside the new lock; its newer bearer still wins.
        auth.setRefreshedAccessToken(jwt('updated'), session); finish.release();
        expect(await pending).toBe(jwt('updated')); expect(auth.getStoredAccessToken()).toBe(jwt('updated'));
    }
});

it('cancels a waiting mutation without a write and permits a later current-account operation', async () => {
    const started = latch(), finish = latch(); let writes = 0;
    server.use(http.post('*/auth/refresh', async () => { started.release(); await finish.promise; return HttpResponse.json({ accessToken: jwt('refreshed') }); }),
        http.post('*/users/me/two-factor/enable', () => { writes++; return HttpResponse.json(resultFor('enable')); }));
    const refresh = (await import('../axiosConfig')).refreshAccessToken(); await started.promise;
    const controller = new AbortController(); const pending = observe(mutation('enable', controller.signal));
    await waitFor(() => expect(lock).toHaveBeenCalledTimes(2)); controller.abort(); finish.release();
    await refresh; expect(await pending).toHaveProperty('error.code', 'ERR_CANCELED'); expect(writes).toBe(0);
    await mutation('enable'); expect(writes).toBe(1);
});

it('rejects an in-flight mutation and its queued old refresh after account replacement', async () => {
    const started = latch(), finish = latch(); const auth = await import('../../utils/authStorage');
    server.use(http.post('*/users/me/two-factor/enable', async () => { started.release(); await finish.promise; return HttpResponse.json(resultFor('enable')); }));
    const pending = observe(mutation('enable')); await started.promise;
    const refresh = observe((await import('../axiosConfig')).refreshAccessToken());
    auth.setStoredAccessToken(jwt('other', '8')); finish.release();
    expect(await pending).toHaveProperty('error.code', 'AUTH_SESSION_CHANGED'); expect(await refresh).toHaveProperty('error');
    expect(auth.getStoredAccessToken()).toBe(jwt('other', '8'));
});

it.each(['/auth/change-password', '/auth/sessions/revoke-others'])('serializes %s without expecting replacement credentials or blocking ordinary reads', async path => {
    const started = latch(), finish = latch(); const order: string[] = [];
    server.use(http.post(`*${path}`, async () => { order.push('write'); started.release(); await finish.promise; order.push('saved'); return HttpResponse.json({ message: 'Saved' }); }),
        http.post('*/auth/refresh', () => { order.push('refresh'); return HttpResponse.json({ accessToken: jwt('refreshed') }); }),
        http.get('*/ordinary-read', () => HttpResponse.json({ ok: true })));
    const { apiClient, refreshAccessToken } = await import('../axiosConfig'); const { credentialUpdate } = await import('../credentialUpdates');
    const write = credentialUpdate(config => apiClient.post(path, {}, config), response => response.data); await started.promise;
    const refresh = refreshAccessToken(); expect((await apiClient.get('/ordinary-read')).data.ok).toBe(true);
    expect(order).toEqual(['write']); finish.release(); expect(await write).toEqual({ message: 'Saved' }); await refresh;
    expect(order).toEqual(['write', 'saved', 'refresh']);
});
