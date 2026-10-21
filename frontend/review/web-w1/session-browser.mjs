import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';

const out = 'C:/Users/daddo/IdeaProjects/GrassKickZ/docs/review-reproductions/web-w1';
await mkdir(out, { recursive: true });
const origin = 'http://127.0.0.1:5190';
const server = await createServer({ configFile: process.cwd() + '/vite.config.ts',
    define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify(origin + '/api') },
    server: { host: '127.0.0.1', port: 5190, strictPort: true, hmr: false } });
await server.listen();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
const latch = () => { let release; const promise = new Promise(resolve => { release = resolve; }); return { promise, release }; };
try {
    for (const scenario of ['late-refresh-B', 'late-refresh-A-again', 'late-write-401', 'same-account-tabs']) {
        const context = await browser.newContext();
        const started = latch(), finish = latch(); let refreshes = 0; const writes = [];
        await context.route('**/*', async route => {
            const url = new URL(route.request().url());
            if (url.origin !== origin) return route.abort();
            if (url.pathname === '/api/auth/csrf') return route.fulfill({ json: { headerName: 'X-XSRF-TOKEN', token: 'csrf' } });
            if (url.pathname === '/api/auth/refresh') {
                refreshes++; started.release(); await finish.promise;
                // A retired XHR may already be cancelled by the storage event.
                return route.fulfill({ json: { accessToken: 'A-renewed' } }).catch(() => {});
            }
            if (url.pathname === '/api/posts') {
                writes.push(route.request().headers().authorization); started.release(); await finish.promise;
                return route.fulfill({ status: 401, body: '' });
            }
            if (url.pathname.startsWith('/api/')) throw new Error('Unexpected request: ' + url.pathname);
            return route.continue();
        });
        const a = await context.newPage(), b = await context.newPage();
        for (const page of [a, b]) {
            await page.goto(origin + '/review/web-w1/session.html');
            await page.waitForFunction(() => window.w1);
        }
        await a.evaluate(() => window.w1.auth.setStoredAccessToken('A-original'));
        const generation = await a.evaluate(() => window.w1.auth.getAuthSessionId());
        await a.evaluate(kind => {
            const pending = kind === 'late-write-401'
                ? window.w1.api.apiClient.post('/posts', { content: 'A draft' })
                : window.w1.api.refreshAccessToken();
            window.outcome = pending.then(value => ({ ok: true, value }), error => ({ ok: false, code: error.code, name: error.name }));
        }, scenario);
        await started.promise;
        if (scenario === 'same-account-tabs') {
            await b.evaluate(() => {
                window.outcome = window.w1.api.refreshAccessToken().then(value => ({ ok: true, value }));
            });
            await expect.poll(() => b.evaluate(async () => (await navigator.locks.query()).pending.length)).toBe(1);
            finish.release();
            expect(await a.evaluate(() => window.outcome)).toEqual({ ok: true, value: 'A-renewed' });
            expect(await b.evaluate(() => window.outcome)).toEqual({ ok: true, value: 'A-renewed' });
            expect(refreshes).toBe(1);
            expect(await a.evaluate(() => window.w1.auth.getAuthSessionId())).toBe(generation);
        } else {
            const nextToken = scenario === 'late-refresh-A-again' ? 'A-original' : 'B-login';
            await b.evaluate(token => { window.w1.auth.clearStoredAuth(); window.w1.auth.setStoredAccessToken(token); }, nextToken);
            finish.release();
            expect((await a.evaluate(() => window.outcome)).ok).toBe(false);
            expect(await a.evaluate(() => window.w1.auth.getStoredAccessToken())).toBe(nextToken);
            expect(await a.evaluate(() => window.w1.auth.getAuthSessionId())).not.toBe(generation);
            if (scenario === 'late-write-401') { expect(refreshes).toBe(0); expect(writes).toEqual(['Bearer A-original']); }
        }
        results.push({ scenario, passed: true, refreshes, writes, realBrowserLocksAndStorageEvents: true });
        await context.close();
    }
    console.log('PASS: four real two-tab session scenarios, including origin locking and account ABA.');
} finally {
    await writeFile(out + '/browser-results.json', JSON.stringify(results, null, 2));
    await browser.close(); await server.close();
}
