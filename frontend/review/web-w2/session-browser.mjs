// Full App, real AuthProvider/Axios/storage events; synthetic accounts and HTTP only.
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const output = 'C:/Users/daddo/IdeaProjects/GrassKickZ/docs/review-reproductions/web-w2';
await mkdir(output, { recursive: true });
const origin = 'http://127.0.0.1:5192';
const server = await createServer({ root: process.cwd(),
    define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify(origin + '/api'), 'import.meta.env.VITE_ENABLE_MOCKS': '"false"' },
    server: { host: '127.0.0.1', port: 5192, strictPort: true, hmr: false } });
await server.listen();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
const latch = () => { let release; const promise = new Promise(resolve => { release = resolve; }); return { promise, release }; };
try {
    for (const scenario of ['account-replacement', 'remote-logout', 'same-session-refresh', 'same-account-new-login']) {
        const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
        const writes = [], errors = []; let refreshes = 0, holdBravo = false;
        const profileStarted = latch(), profileFinish = latch();
        await context.route('**/*', async route => {
            const req = route.request(), url = new URL(req.url());
            if (url.origin !== origin || url.pathname.startsWith('/ws')) return route.abort();
            if (!url.pathname.startsWith('/api/')) return route.continue();
            const isBravo = req.headers().authorization === 'Bearer B-token';
            let body = [], status = 200;
            if (url.pathname === '/api/auth/csrf') body = { headerName: 'X-XSRF-TOKEN', token: 'synthetic' };
            else if (url.pathname === '/api/auth/refresh') { refreshes++; status = 401; body = {}; }
            else if (url.pathname.startsWith('/api/auth/')) { status = 401; body = {}; }
            else if (url.pathname === '/api/users/me') {
                if (isBravo && holdBravo) { profileStarted.release(); await profileFinish.promise; }
                body = { id: isBravo ? 2 : 1, fullName: isBravo ? 'Account Bravo' : 'Account Alpha',
                    username: isBravo ? 'bravo' : 'alpha', role: 'FAN', dob: '1990-01-01',
                    profileComplete: true, onboardingRequired: false, emailVerified: true };
            } else if (url.pathname === '/api/clubs/my-membership-context') body = { hasClubMembership: false, canCreateClub: false };
            else if (url.pathname.startsWith('/api/posts/feed/')) body = { posts: [], nextCursor: null };
            else if (url.pathname === '/api/posts' && req.method() === 'POST') {
                writes.push({ authorization: req.headers().authorization, body: req.postDataJSON() }); body = { id: 1 };
            } else if (url.pathname.includes('notifications') || url.pathname.includes('conversations')) body = { content: [], totalElements: 0 };
            return route.fulfill({ status, json: body });
        });
        const first = await context.newPage(), second = await context.newPage();
        for (const page of [first, second]) page.on('pageerror', error => errors.push(error.message));
        await first.goto(origin + '/login');
        await expect(first.getByRole('textbox', { name: /email/i }).first()).toBeVisible({ timeout: 15000 });
        await first.evaluate(async () => { const a = await import('/src/utils/authStorage.ts'); a.setStoredAccessToken('A-token'); });
        await first.goto(origin + '/home');
        await expect(first.getByText('Account Alpha', { exact: true }).first()).toBeVisible();
        await second.goto(origin + '/home');
        await expect(second.getByText('Account Alpha', { exact: true }).first()).toBeVisible();
        const composer = first.getByRole('textbox', { name: 'Create a post' });
        await composer.fill('Private Alpha draft');
        const generation = await first.evaluate(() => localStorage.getItem('gk-session-id'));
        const initialRefreshes = refreshes;
        if (scenario === 'account-replacement') {
            holdBravo = true;
            await second.evaluate(async () => { const a = await import('/src/utils/authStorage.ts'); a.clearStoredAuth(); a.setStoredAccessToken('B-token'); });
            await profileStarted.promise;
            await expect(first.getByText('Loading your account…')).toBeVisible();
            await expect(composer).toHaveCount(0);
            await expect(first.getByText('Account Alpha', { exact: true })).toHaveCount(0);
            await first.screenshot({ path: output + '/account-change-loading.png' });
            profileFinish.release();
            for (const page of [first, second]) await expect(page.getByText('Account Bravo', { exact: true }).first()).toBeVisible();
            await expect(composer).toHaveValue('');
            await composer.fill('New Bravo draft');
            await first.getByRole('button', { name: 'Publish post' }).click();
            await expect.poll(() => writes.length).toBe(1);
            expect(writes[0].authorization).toBe('Bearer B-token');
            expect(JSON.stringify(writes[0].body)).toContain('New Bravo draft');
            expect(JSON.stringify(writes)).not.toContain('Private Alpha draft');
            await first.screenshot({ path: output + '/account-bravo-shell.png' });
        } else if (scenario === 'remote-logout') {
            const logoutGeneration = await second.evaluate(async () => { const a = await import('/src/utils/authStorage.ts'); a.clearStoredAuth(); return a.getAuthSessionId(); });
            for (const page of [first, second]) {
                await expect(page.getByRole('textbox', { name: /email/i }).first()).toBeVisible();
                expect(await page.evaluate(() => localStorage.getItem('gk-session-id'))).toBe(logoutGeneration);
                await expect(page.getByText('Account Alpha', { exact: true })).toHaveCount(0);
            }
            expect(refreshes).toBe(initialRefreshes); expect(writes).toEqual([]);
        } else if (scenario === 'same-session-refresh') {
            await second.evaluate(async () => { const a = await import('/src/utils/authStorage.ts'); a.setRefreshedAccessToken('A-renewed', a.getAuthSessionId()); });
            await expect.poll(() => first.evaluate(async () => (await import('/src/utils/authStorage.ts')).getStoredAccessToken())).toBe('A-renewed');
            await expect(composer).toHaveValue('Private Alpha draft');
            expect(await first.evaluate(() => localStorage.getItem('gk-session-id'))).toBe(generation);
            await first.getByRole('button', { name: 'Publish post' }).click();
            await expect.poll(() => writes.length).toBe(1);
            expect(writes[0].authorization).toBe('Bearer A-renewed');
        } else {
            await second.evaluate(async () => { const a = await import('/src/utils/authStorage.ts'); a.setStoredAccessToken('A-token'); });
            await expect(composer).toHaveValue('');
            await expect(first.getByText('Account Alpha', { exact: true }).first()).toBeVisible();
            expect(await first.evaluate(() => localStorage.getItem('gk-session-id'))).not.toBe(generation);
        }
        expect(errors).toEqual([]);
        results.push({ scenario, passed: true, fullApp: true, realTwoTabStorageEvents: true, writes, errors });
        await context.close();
    }
    console.log('PASS: four full-app two-tab scenarios: replacement, logout, renewal and a new login to the same account.');
} finally {
    await writeFile(output + '/browser-results.json', JSON.stringify(results, null, 2));
    await browser.close(); await server.close();
}
