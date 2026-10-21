// Diagnostics assert the current BUG, not the desired safety contract.
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
beforeEach(() => {
  vi.resetModules(); localStorage.clear();
  Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
  server.use(http.get('*/auth/csrf', () => HttpResponse.json({ headerName: 'X-XSRF-TOKEN', token: 'synthetic-csrf' })));
});
afterEach(() => server.resetHandlers());
function latch() { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve; }); return { promise, release }; }
it('DIAGNOSTIC: a delayed refresh from A overwrites the token after login as B', async () => {
  const started = latch(), finish = latch();
  const { setStoredAccessToken, setStoredUserId, clearStoredAuth } = await import('../../src/utils/authStorage');
  const { refreshAccessToken } = await import('../../src/api/axiosConfig');
  setStoredUserId(1); setStoredAccessToken('A-old');
  server.use(http.post('*/auth/refresh', async () => { started.release(); await finish.promise; return HttpResponse.json({ accessToken: 'A-refreshed' }); }));
  const pending = refreshAccessToken(); await started.promise;
  clearStoredAuth(); setStoredUserId(2); setStoredAccessToken('B-login');
  finish.release(); await pending;
  expect(localStorage.getItem('userId')).toBe('2');
  expect(localStorage.getItem('accessToken')).toBe('A-refreshed');
});
it('DIAGNOSTIC: an old A mutation rejected after account switch is retried under B', async () => {
  const started = latch(), finish = latch(); const writes: string[] = [];
  const { setStoredAccessToken, setStoredUserId, clearStoredAuth } = await import('../../src/utils/authStorage');
  const { apiClient } = await import('../../src/api/axiosConfig');
  setStoredUserId(1); setStoredAccessToken('A-old');
  server.use(
    http.patch('*/clubs/10/store/1', async ({ request }) => {
      const auth = request.headers.get('Authorization')!; writes.push(auth);
      if (auth === 'Bearer A-old') { started.release(); await finish.promise; return new HttpResponse(null, { status: 401 }); }
      return HttpResponse.json({ active: false });
    }),
    http.post('*/auth/refresh', () => HttpResponse.json({ accessToken: 'B-refreshed' })),
  );
  const pending = apiClient.patch('/clubs/10/store/1', { active: false, version: 0 }); await started.promise;
  clearStoredAuth(); setStoredUserId(2); setStoredAccessToken('B-login');
  finish.release(); await pending;
  expect(writes).toEqual(['Bearer A-old', 'Bearer B-refreshed']);
});
