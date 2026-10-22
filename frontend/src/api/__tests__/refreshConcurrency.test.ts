import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
    server.use(http.get('*/auth/csrf', () => HttpResponse.json({ headerName: 'X-XSRF-TOKEN', token: 'masked-request-token' })));
});
afterEach(() => server.resetHandlers());

describe('refresh coordination', () => {
    it.each(['PASSWORD_CHANGE_REQUIRED', 'DOB_REQUIRED', 'ONBOARDING_REQUIRED'])(
        'routes %s to account completion without refreshing or deleting the session', async code => {
            const auth = await import('../../utils/authStorage');
            auth.setRefreshedAccessToken('restricted-session', null);
            server.use(http.get('*/protected', () => HttpResponse.json({ code }, { status: 403 })));
            const { apiClient, setAccountRestrictionHandler, setAuthFailureHandler } = await import('../axiosConfig');
            const onRestriction = vi.fn();
            const onFailure = vi.fn();
            setAccountRestrictionHandler(onRestriction);
            setAuthFailureHandler(onFailure);
            await expect(apiClient.get('/protected')).rejects.toMatchObject({ response: { status: 403 } });
            expect(onRestriction).toHaveBeenCalledWith(code);
            expect(onFailure).not.toHaveBeenCalled();
            expect(auth.getStoredAccessToken()).toBe('restricted-session');
        },
    );
    it('shares refresh between direct callers and simultaneous rejected API requests', async () => {
        let refreshes = 0;
        server.use(
            http.post('*/auth/refresh', async ({ request }) => {
                expect(request.headers.get('X-XSRF-TOKEN')).toBe('masked-request-token');
                refreshes++;
                await delay(100);
                return HttpResponse.json({ accessToken: 'new-token' });
            }),
            http.get('*/protected', ({ request }) => request.headers.get('Authorization') === 'Bearer new-token'
                ? HttpResponse.json({ ok: true }) : new HttpResponse(null, { status: 401 })),
        );
        const { refreshAccessToken, apiClient } = await import('../axiosConfig');
        const direct = refreshAccessToken();
        expect(refreshAccessToken()).toBe(direct);
        const results = await Promise.all([direct, apiClient.get('/protected'), apiClient.get('/protected')]);
        expect(results[0]).toBe('new-token');
        expect(refreshes).toBe(1);
        expect((await import('../../utils/authStorage')).getStoredAccessToken()).toBe('new-token');
    });

    it('serializes independent tab modules so each renews its own memory token without a conflict', async () => {
        let tail: Promise<unknown> = Promise.resolve();
        const requestLock = vi.fn((_name: string, _options: LockOptions, callback: () => Promise<string>) => {
            const result = tail.then(callback);
            tail = result.catch(() => undefined);
            return result;
        });
        Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: requestLock } });
        let refreshes = 0, inFlight = 0, overlapped = false;
        server.use(http.post('*/auth/refresh', async () => {
            refreshes++;
            overlapped ||= ++inFlight > 1;
            await delay(50);
            inFlight--;
            return HttpResponse.json({ accessToken: `token-${refreshes}` });
        }));
        const tabOne = await import('../axiosConfig');
        vi.resetModules();
        const tabTwo = await import('../axiosConfig');

        // Tokens live in each tab's memory, so each tab renews with the shared cookie, one at a time.
        expect(await Promise.all([tabOne.refreshAccessToken(), tabTwo.refreshAccessToken()]))
            .toEqual(['token-1', 'token-2']);
        expect(requestLock).toHaveBeenCalledTimes(2);
        expect(refreshes).toBe(2);
        expect(overlapped).toBe(false);
    });

    it('fetches a fresh CSRF token and retries once when the renewal is refused with 403', async () => {
        // The XSRF cookie can change between the token fetch and the renewal (another tab, a
        // browser restart). That is never a sign-out.
        let csrfReads = 0, refreshes = 0;
        server.use(
            http.get('*/auth/csrf', () => HttpResponse.json({ headerName: 'X-XSRF-TOKEN', token: `masked-${++csrfReads}` })),
            http.post('*/auth/refresh', ({ request }) => {
                refreshes++;
                return request.headers.get('X-XSRF-TOKEN') === 'masked-2'
                    ? HttpResponse.json({ accessToken: 'renewed' })
                    : HttpResponse.json({ code: 'FORBIDDEN' }, { status: 403 });
            }),
        );
        const { refreshAccessToken } = await import('../axiosConfig');
        expect(await refreshAccessToken()).toBe('renewed');
        expect(refreshes).toBe(2);
        expect(csrfReads).toBe(2);
    });

    it('gives up after one CSRF retry without clearing the session', async () => {
        const auth = await import('../../utils/authStorage');
        auth.setStoredAccessToken('kept');
        let refreshes = 0;
        server.use(http.post('*/auth/refresh', () => { refreshes++; return new HttpResponse(null, { status: 403 }); }));
        const { refreshAccessToken, setAuthFailureHandler } = await import('../axiosConfig');
        const onFailure = vi.fn(); setAuthFailureHandler(onFailure);
        await expect(refreshAccessToken()).rejects.toMatchObject({ response: { status: 403 } });
        expect(refreshes).toBe(2);
        expect(onFailure).not.toHaveBeenCalled();
        expect(auth.getStoredAccessToken()).toBe('kept');
        expect(auth.isSignedInSession(auth.getAuthSessionId())).toBe(true);
    });

    it('retries the explicit duplicate response when browser locks are unavailable', async () => {
        let refreshes = 0;
        server.use(http.post('*/auth/refresh', () => ++refreshes === 1
            ? HttpResponse.json({ code: 'REFRESH_ALREADY_ROTATED' }, { status: 409 })
            : HttpResponse.json({ accessToken: 'winner-cookie-token' })));
        const { refreshAccessToken } = await import('../axiosConfig');
        expect(await refreshAccessToken()).toBe('winner-cookie-token');
        expect(refreshes).toBe(2);
    });

    it('bounds duplicate retries and does not erase stored auth on a transient conflict', async () => {
        const auth = await import('../../utils/authStorage');
        auth.setRefreshedAccessToken('existing-token', null);
        let refreshes = 0;
        server.use(
            http.get('*/protected', () => new HttpResponse(null, { status: 401 })),
            http.post('*/auth/refresh', () => {
                refreshes++;
                return HttpResponse.json({ code: 'REFRESH_ALREADY_ROTATED' }, { status: 409 });
            }),
        );
        const { apiClient, setAuthFailureHandler } = await import('../axiosConfig');
        const onFailure = vi.fn();
        setAuthFailureHandler(onFailure);
        await expect(apiClient.get('/protected')).rejects.toMatchObject({ response: { status: 409 } });
        expect(refreshes).toBe(3);
        expect(auth.getStoredAccessToken()).toBe('existing-token');
        expect(onFailure).not.toHaveBeenCalled();
    });

    it('clears rejected sessions on 401 and permits a later refresh attempt', async () => {
        const auth = await import('../../utils/authStorage');
        auth.setRefreshedAccessToken('old-token', null);
        server.use(
            http.get('*/protected', () => new HttpResponse(null, { status: 401 })),
            http.post('*/auth/refresh', () => new HttpResponse(null, { status: 401 })),
        );
        const { apiClient, refreshAccessToken, setAuthFailureHandler } = await import('../axiosConfig');
        const onFailure = vi.fn();
        setAuthFailureHandler(onFailure);
        await expect(apiClient.get('/protected')).rejects.toMatchObject({ response: { status: 401 } });
        expect(auth.getStoredAccessToken()).toBeNull();
        expect(onFailure).toHaveBeenCalledOnce();

        server.use(http.post('*/auth/refresh', () => HttpResponse.json({ accessToken: 'later-token' })));
        expect(await refreshAccessToken()).toBe('later-token');
    });

    it('retries each protected request only once if the new access token is also rejected', async () => {
        let refreshes = 0;
        server.use(
            http.get('*/protected', () => new HttpResponse(null, { status: 401 })),
            http.post('*/auth/refresh', async () => {
                refreshes++;
                await delay(50);
                return HttpResponse.json({ accessToken: 'still-rejected' });
            }),
        );
        const { apiClient } = await import('../axiosConfig');
        const results = await Promise.allSettled([apiClient.get('/protected'), apiClient.get('/protected')]);
        expect(results.every(result => result.status === 'rejected')).toBe(true);
        expect(refreshes).toBe(1);
    });
    it('never spends the shared refresh cookie once a newer build is known: the tab reloads into it, keeping the session', async () => {
        vi.stubGlobal('__BUILD_ID__', 'old-build');
        localStorage.setItem('gk-build', 'new-build');
        sessionStorage.clear();
        let refreshes = 0;
        server.use(http.post('*/auth/refresh', () => { refreshes++; return HttpResponse.json({ accessToken: 'new-token' }); }));
        const auth = await import('../../utils/authStorage');
        auth.setRefreshedAccessToken('old-token', null);
        const build = await import('../../utils/buildVersion');
        const reload = vi.spyOn(build.page, 'reload').mockImplementation(() => undefined);
        const { refreshAccessToken } = await import('../axiosConfig');
        await expect(refreshAccessToken()).rejects.toMatchObject({ name: 'CanceledError' });
        expect(refreshes).toBe(0);
        expect(reload).toHaveBeenCalledTimes(1);
        expect(auth.getStoredAccessToken()).toBe('old-token');
        vi.unstubAllGlobals();
    });
});
