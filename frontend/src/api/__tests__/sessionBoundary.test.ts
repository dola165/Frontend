import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
beforeEach(() => {
    vi.resetModules(); localStorage.clear();
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
    server.use(http.get('*/auth/csrf', () => HttpResponse.json({ headerName: 'X-XSRF-TOKEN', token: 'csrf' })));
});
afterEach(() => { server.resetHandlers(); vi.restoreAllMocks(); });
function latch() {
    let release!: () => void;
    const promise = new Promise<void>(resolve => { release = resolve; });
    return { promise, release };
}
const observe = <T,>(promise: Promise<T>) => promise.then(value => ({ value }), error => ({ error }));
const jwt = (sub: string, revision: number) => `header.${btoa(JSON.stringify({ sub, revision }))}.signature`;

it.each([
    ['B', 200], ['B', 401], ['logout', 200], ['logout', 401],
    ['A-again', 200], ['A-again', 401], ['A-new-login', 200], ['A-new-login', 401],
])('retires a pending refresh across %s, including its late %s response', async (transition, status) => {
    const started = latch(), finish = latch();
    const auth = await import('../../utils/authStorage');
    const { refreshAccessToken } = await import('../axiosConfig');
    auth.setStoredAccessToken('A-old');
    const originalSession = auth.getAuthSessionId();
    server.use(http.post('*/auth/refresh', async () => {
        started.release(); await finish.promise;
        return status === 200 ? HttpResponse.json({ accessToken: 'A-refreshed' }) : new HttpResponse(null, { status: 401 });
    }));
    const pending = observe(refreshAccessToken()); await started.promise;
    if (transition !== 'A-new-login') auth.clearStoredAuth();
    if (transition !== 'logout') auth.setStoredAccessToken(transition === 'B' ? 'B-login' : 'A-old');
    finish.release();
    expect(await pending).toHaveProperty('error');
    expect(auth.getAuthSessionId()).not.toBe(originalSession);
    expect(auth.getStoredAccessToken()).toBe(transition === 'logout' ? null : transition === 'B' ? 'B-login' : 'A-old');
});

it('never retries an old account mutation or refreshes the replacement session for its delayed 401', async () => {
    const started = latch(), finish = latch(); const writes: string[] = [];
    const auth = await import('../../utils/authStorage');
    const { apiClient } = await import('../axiosConfig');
    const refresh = vi.fn(() => HttpResponse.json({ accessToken: 'B-refreshed' }));
    auth.setStoredAccessToken('A-old');
    server.use(
        http.patch('*/clubs/10/store/1', async ({ request }) => {
            writes.push(request.headers.get('Authorization')!); started.release(); await finish.promise;
            return new HttpResponse(null, { status: 401 });
        }),
        http.post('*/auth/refresh', refresh),
    );
    const pending = observe(apiClient.patch('/clubs/10/store/1', { active: false, version: 0 }));
    await started.promise;
    auth.clearStoredAuth(); auth.setStoredAccessToken('B-login');
    finish.release();
    expect(await pending).toHaveProperty('error.code', 'AUTH_SESSION_CHANGED');
    expect(writes).toEqual(['Bearer A-old']); expect(refresh).not.toHaveBeenCalled();
    expect(auth.getStoredAccessToken()).toBe('B-login');
});

it('captures the account at the API call, before an immediate same-tick login change', async () => {
    const auth = await import('../../utils/authStorage');
    const { apiClient } = await import('../axiosConfig');
    const writes: string[] = [];
    server.use(http.post('*/posts', ({ request }) => {
        writes.push(request.headers.get('Authorization')!); return HttpResponse.json({ id: 1 });
    }));
    auth.setStoredAccessToken('A');
    const pending = observe(apiClient.post('/posts', { content: 'A draft' }));
    auth.setStoredAccessToken('B');
    expect(await pending).toHaveProperty('error.code', 'AUTH_SESSION_CHANGED');
    expect(writes).toEqual(['Bearer A']);
});

it.each([200, 403])('does not apply a late %s response or restriction to a new account', async status => {
    const started = latch(), finish = latch();
    const auth = await import('../../utils/authStorage');
    const { apiClient, setAccountRestrictionHandler } = await import('../axiosConfig');
    const restriction = vi.fn(); setAccountRestrictionHandler(restriction);
    server.use(http.get('*/protected', async () => {
        started.release(); await finish.promise;
        return HttpResponse.json({ code: 'DOB_REQUIRED' }, { status });
    }));
    auth.setStoredAccessToken('A');
    const pending = observe(apiClient.get('/protected')); await started.promise;
    auth.setStoredAccessToken('B'); finish.release();
    expect(await pending).toHaveProperty('error.code', 'AUTH_SESSION_CHANGED');
    expect(restriction).not.toHaveBeenCalled();
});

it('does not let an old refresh failure clear a newer login or invoke its failure handler', async () => {
    const started = latch(), finish = latch();
    const auth = await import('../../utils/authStorage');
    const { apiClient, setAuthFailureHandler } = await import('../axiosConfig');
    const failure = vi.fn(); setAuthFailureHandler(failure);
    server.use(
        http.get('*/protected', () => new HttpResponse(null, { status: 401 })),
        http.post('*/auth/refresh', async () => {
            started.release(); await finish.promise; return new HttpResponse(null, { status: 401 });
        }),
    );
    auth.setStoredAccessToken('A');
    const pending = observe(apiClient.get('/protected')); await started.promise;
    auth.setStoredAccessToken('B'); finish.release(); await pending;
    expect(auth.getStoredAccessToken()).toBe('B'); expect(failure).not.toHaveBeenCalled();
});

it('keeps a new session refresh independent and coalesced after the old flight settles', async () => {
    const firstStarted = latch(), secondStarted = latch(), firstFinish = latch(), secondFinish = latch();
    const auth = await import('../../utils/authStorage');
    const { refreshAccessToken } = await import('../axiosConfig');
    let refreshes = 0;
    server.use(http.post('*/auth/refresh', async () => {
        if (++refreshes === 1) { firstStarted.release(); await firstFinish.promise; return HttpResponse.json({ accessToken: 'A-new' }); }
        secondStarted.release(); await secondFinish.promise; return HttpResponse.json({ accessToken: 'B-new' });
    }));
    auth.setStoredAccessToken('A');
    const old = observe(refreshAccessToken()); await firstStarted.promise;
    auth.setStoredAccessToken('B');
    const current = refreshAccessToken(); await secondStarted.promise;
    firstFinish.release(); await old;
    expect(refreshAccessToken()).toBe(current);
    secondFinish.release(); expect(await current).toBe('B-new');
    expect(refreshes).toBe(2); expect(auth.getStoredAccessToken()).toBe('B-new');
});

it('rejects a retired origin-lock waiter instead of reusing the other account token', async () => {
    const waiting = latch(), releaseLock = latch();
    Object.defineProperty(navigator, 'locks', { configurable: true, value: {
        request: vi.fn(async (_name: string, _options: LockOptions, callback: () => Promise<string>) => {
            waiting.release(); await releaseLock.promise; return callback();
        }),
    } });
    const auth = await import('../../utils/authStorage');
    const { refreshAccessToken } = await import('../axiosConfig');
    const refresh = vi.fn(() => HttpResponse.json({ accessToken: 'unexpected' }));
    server.use(http.post('*/auth/refresh', refresh));
    auth.setStoredAccessToken('A'); const pending = observe(refreshAccessToken()); await waiting.promise;
    // A separate module shares storage, like a second tab, without sharing the promise.
    vi.resetModules(); const otherTab = await import('../../utils/authStorage');
    otherTab.setStoredAccessToken('B'); releaseLock.release();
    expect(await pending).toHaveProperty('error.code', 'AUTH_SESSION_CHANGED');
    expect(refresh).not.toHaveBeenCalled(); expect(auth.getStoredAccessToken()).toBe('B');
});

it('does not send refresh after its CSRF request crosses logout', async () => {
    const started = latch(), finish = latch();
    const auth = await import('../../utils/authStorage');
    const { refreshAccessToken } = await import('../axiosConfig');
    const refresh = vi.fn(() => HttpResponse.json({ accessToken: 'unexpected' }));
    server.use(
        http.get('*/auth/csrf', async () => { started.release(); await finish.promise; return HttpResponse.json({ headerName: 'X-XSRF-TOKEN', token: 'csrf' }); }),
        http.post('*/auth/refresh', refresh),
    );
    auth.setStoredAccessToken('A'); const pending = observe(refreshAccessToken()); await started.promise;
    auth.clearStoredAuth(); finish.release(); expect(await pending).toHaveProperty('error');
    expect(refresh).not.toHaveBeenCalled(); expect(auth.getStoredAccessToken()).toBeNull();
});

it('stops duplicate-rotation retry after an account change', async () => {
    const duplicate = latch(); let refreshes = 0;
    const auth = await import('../../utils/authStorage');
    const { refreshAccessToken } = await import('../axiosConfig');
    server.use(http.post('*/auth/refresh', () => {
        refreshes++; duplicate.release(); return HttpResponse.json({ code: 'REFRESH_ALREADY_ROTATED' }, { status: 409 });
    }));
    auth.setStoredAccessToken('A'); const pending = observe(refreshAccessToken()); await duplicate.promise;
    await new Promise(resolve => setTimeout(resolve, 50));
    auth.setStoredAccessToken('B'); expect(await pending).toHaveProperty('error');
    expect(refreshes).toBe(1); expect(auth.getStoredAccessToken()).toBe('B');
});

it('checks the account claim even when a late cookie produces a response in the current generation', async () => {
    const auth = await import('../../utils/authStorage');
    const { apiClient, setAuthFailureHandler } = await import('../axiosConfig');
    const failure = vi.fn(); const writes: string[] = []; setAuthFailureHandler(failure);
    auth.setStoredAccessToken(jwt('B', 1));
    server.use(
        http.post('*/posts', ({ request }) => { writes.push(request.headers.get('Authorization')!); return new HttpResponse(null, { status: 401 }); }),
        http.post('*/auth/refresh', () => HttpResponse.json({ accessToken: jwt('A', 2) })),
    );
    await expect(apiClient.post('/posts', { content: 'B draft' })).rejects.toThrow('different account');
    expect(writes).toEqual([`Bearer ${jwt('B', 1)}`]);
    expect(auth.getStoredAccessToken()).toBeNull(); expect(failure).toHaveBeenCalledOnce();
});

it('preserves the generation and retries normally for renewal of the same account', async () => {
    const auth = await import('../../utils/authStorage');
    const { apiClient } = await import('../axiosConfig');
    auth.setStoredAccessToken(jwt('A', 1)); const sessionId = auth.getAuthSessionId();
    server.use(
        http.post('*/posts', ({ request }) => request.headers.get('Authorization') === `Bearer ${jwt('A', 2)}`
            ? HttpResponse.json({ id: 42 }) : new HttpResponse(null, { status: 401 })),
        http.post('*/auth/refresh', () => HttpResponse.json({ accessToken: jwt('A', 2) })),
    );
    expect((await apiClient.post('/posts', { content: 'A draft' })).data.id).toBe(42);
    expect(auth.getAuthSessionId()).toBe(sessionId); expect(auth.getStoredAccessToken()).toBe(jwt('A', 2));
});

it('cannot overwrite B if its login interleaves between the refresh guard and token write', async () => {
    const auth = await import('../../utils/authStorage');
    auth.setStoredAccessToken('A'); const retiredId = auth.getAuthSessionId();
    const originalSet = Storage.prototype.setItem;
    let interleaved = false;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
        if (key === `gk-session-token:${retiredId}` && value === 'A-renewed' && !interleaved) {
            interleaved = true; auth.setStoredAccessToken('B');
        }
        originalSet.call(this, key, value);
    });
    expect(() => auth.setRefreshedAccessToken('A-renewed', retiredId)).toThrow('session changed');
    expect(auth.getStoredAccessToken()).toBe('B');
    expect(localStorage.getItem(`gk-session-token:${retiredId}`)).toBeNull();
});

it('cannot read B credentials into A when login interleaves with request token selection', async () => {
    const auth = await import('../../utils/authStorage');
    const { apiClient } = await import('../axiosConfig');
    auth.setStoredAccessToken('A'); const retiredId = auth.getAuthSessionId();
    const originalGet = Storage.prototype.getItem;
    let interleaved = false;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key) {
        if (key === `gk-session-token:${retiredId}` && !interleaved) {
            interleaved = true; auth.setStoredAccessToken('B');
        }
        return originalGet.call(this, key);
    });
    const writes = vi.fn(() => HttpResponse.json({ id: 1 }));
    server.use(http.post('*/posts', writes));
    await expect(apiClient.post('/posts', { content: 'A draft' })).rejects.toThrow('session changed');
    expect(writes).not.toHaveBeenCalled(); expect(auth.getStoredAccessToken()).toBe('B');
});
