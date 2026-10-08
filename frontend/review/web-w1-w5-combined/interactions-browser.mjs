// Combined W1-W4 return review: real App, provider, Axios and composer.
// HTTP responses are controlled fixtures; real media decoding is checked separately.
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const output = 'C:/Users/daddo/IdeaProjects/GrassKickZ/docs/review-reproductions/web-w1-w5-combined/interactions';
await mkdir(output, { recursive: true });
const origin = 'http://127.0.0.1:5196';
const server = await createServer({ root: process.cwd(),
    define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify(origin + '/api'), 'import.meta.env.VITE_ENABLE_MOCKS': '"false"' },
    server: { host: '127.0.0.1', port: 5196, strictPort: true, hmr: false } });
await server.listen();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
const latch = () => { let release; const promise = new Promise(resolve => { release = resolve; }); return { promise, release }; };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=', 'base64');
const jwt = (account, version) => 'review.' + Buffer.from(JSON.stringify({ sub: account, version })).toString('base64url') + '.fixture';
const tokenA = jwt('alpha', 1), renewedA = jwt('alpha', 2), tokenB = jwt('bravo', 1);
try {
    for (const scenario of ['switch-during-upload', 'switch-during-post-success', 'switch-during-post-401', 'renew-during-upload', 'real-login-ui'].filter(name => !process.argv[2] || name === process.argv[2])) {
        const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
        const writes = [], uploads = [], errors = [], refreshes = [], requests = [], consoleErrors = [];
        let page;
        const started = latch(), finish = latch();
        try {
            await context.route('**/*', async route => {
                const req = route.request(), url = new URL(req.url());
                if (url.origin !== origin || url.pathname.startsWith('/ws')) return route.abort();
                if (!url.pathname.startsWith('/api/')) return route.continue();
                requests.push({ path: url.pathname, method: req.method() });
                let body = [], status = 200;
                const authorization = req.headers().authorization;
                if (url.pathname === '/api/auth/csrf') body = { headerName: 'X-XSRF-TOKEN', token: 'synthetic' };
                else if (url.pathname === '/api/auth/login') body = { accessToken: tokenA };
                else if (url.pathname === '/api/auth/refresh') {
                    refreshes.push(authorization ?? null); status = 401; body = {};
                } else if (url.pathname.startsWith('/api/auth/')) { status = 401; body = {}; }
                else if (url.pathname === '/api/users/me') body = { id: authorization === `Bearer ${tokenB}` ? 2 : 1,
                    fullName: authorization === `Bearer ${tokenB}` ? 'Account Bravo' : 'Account Alpha', username: 'reviewer',
                    role: 'FAN', dob: '1990-01-01', profileComplete: true, onboardingRequired: false, emailVerified: true };
                else if (url.pathname === '/api/clubs/my-membership-context') body = { hasClubMembership: false, canCreateClub: false };
                else if (url.pathname.startsWith('/api/posts/feed/')) body = { posts: [], nextCursor: null };
                else if (url.pathname === '/api/media/upload') {
                    uploads.push({ authorization });
                    if (scenario.endsWith('during-upload')) { started.release(); await finish.promise; }
                    body = { id: 101 };
                } else if (url.pathname === '/api/posts' && req.method() === 'POST') {
                    writes.push({ authorization, body: req.postDataJSON() });
                    if (scenario.includes('during-post') && writes.length === 1) {
                        started.release(); await finish.promise;
                        if (scenario.endsWith('401')) status = 401;
                    }
                    body = { id: writes.length };
                } else if (url.pathname.includes('notifications') || url.pathname.includes('conversations')) body = { content: [], totalElements: 0 };
                return route.fulfill({ status, json: body });
            });
            page = await context.newPage();
            page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
            page.on('pageerror', e => errors.push(e.message));
            await page.goto(origin + '/login');
            await expect(page.getByRole('textbox', { name: /email/i }).first()).toBeVisible({ timeout: 20000 });
            const initialRefreshes = refreshes.length;
            if (scenario === 'real-login-ui') {
                await page.getByRole('textbox', { name: /email/i }).first().fill('review@example.invalid');
                await page.getByLabel('Password', { exact: true }).fill('synthetic-password');
                await page.locator('form button[type="submit"]').click();
                await expect(page).toHaveURL(origin + '/home');
            } else {
                await page.evaluate(async token => { const auth = await import('/src/utils/authStorage.ts'); auth.setStoredAccessToken(token); }, tokenA);
                await page.goto(origin + '/home');
            }
            await expect(page.getByText('Account Alpha', { exact: true }).first()).toBeVisible();
            const text = page.getByRole('textbox', { name: 'Create a post' });
            const picker = page.getByLabel('Choose photo');
            const publish = page.getByRole('button', { name: 'Publish post' });
            if (scenario === 'real-login-ui') {
                await text.fill('Alpha after login'); await publish.click();
                await expect(text).toHaveValue('');
                expect(writes).toEqual([{ authorization: `Bearer ${tokenA}`, body: { content: 'Alpha after login', clubId: null, isPublic: true, mediaIds: [] } }]);
            } else {
                await text.fill('Alpha private draft');
                // The current W4 picker and accepted MIME pass through the W3 pending lock.
                await expect(picker).toHaveAttribute('accept', 'image/jpeg,image/png,image/gif,image/webp');
                await picker.setInputFiles({ name: 'alpha.png', mimeType: 'image/png', buffer: png });
                await publish.click(); await started.promise;
                await expect(text).toBeDisabled(); await expect(picker).toBeDisabled();
                const tab = await context.newPage(); await tab.goto(origin + '/login');
                if (scenario === 'renew-during-upload') {
                    await tab.evaluate(async token => { const auth = await import('/src/utils/authStorage.ts'); auth.setRefreshedAccessToken(token, auth.getAuthSessionId()); }, renewedA);
                    await expect(text).toHaveValue('Alpha private draft'); await expect(text).toBeDisabled();
                    finish.release(); await expect(text).toBeEnabled(); await expect(text).toHaveValue('');
                    expect(writes).toEqual([{ authorization: `Bearer ${renewedA}`, body: { content: 'Alpha private draft', clubId: null, isPublic: true, mediaIds: [101] } }]);
                } else {
                    await tab.evaluate(async token => { const auth = await import('/src/utils/authStorage.ts'); auth.setStoredAccessToken(token); }, tokenB);
                    await expect(page.getByText('Account Bravo', { exact: true }).first()).toBeVisible();
                    await expect(text).toHaveValue(''); await expect(page.getByAltText('Upload preview')).toHaveCount(0);
                    await text.fill('Bravo new draft');
                    // Catch completion after Bravo's new composer has already become editable.
                    const oldResponse = page.waitForResponse(response => response.url().endsWith(scenario === 'switch-during-upload' ? '/api/media/upload' : '/api/posts'));
                    finish.release(); await oldResponse;
                    await expect(page.getByText(/Photo upload failed|Failed to publish this post/).first()).toBeVisible();
                    await expect(text).toHaveValue('Bravo new draft');
                    expect(writes.length).toBe(scenario === 'switch-during-upload' ? 0 : 1);
                    expect(writes.every(write => write.authorization === `Bearer ${tokenA}`)).toBe(true);
                    expect(refreshes.length).toBe(initialRefreshes);
                    await publish.click(); await expect(text).toHaveValue('');
                    expect(writes.at(-1)).toEqual({ authorization: `Bearer ${tokenB}`, body: { content: 'Bravo new draft', clubId: null, isPublic: true, mediaIds: [] } });
                }
                expect(uploads).toEqual([{ authorization: `Bearer ${tokenA}` }]);
                await tab.close();
            }
            expect(errors).toEqual([]);
            results.push({ scenario, passed: true, writes: writes.map(w => ({ account: w.authorization === `Bearer ${tokenB}` ? 'Bravo' : 'Alpha', body: w.body })), uploadCount: uploads.length, refreshCount: refreshes.length });
            await page.screenshot({ path: output + '/' + scenario + '.png' });
            console.log('PASS:', scenario);
        } catch (error) {
            await writeFile(output + '/' + scenario + '-failure.json', JSON.stringify({ requests, consoleErrors, errors, body: await page?.locator('body').innerText(), localStorage: await page?.evaluate(() => ({ ...localStorage })), error: String(error) }, null, 2));
            await page?.screenshot({ path: output + '/' + scenario + '-failure.png' });
            throw error;
        } finally { finish.release(); await context.close(); }
    }
} finally {
    await writeFile(output + '/browser-results.json', JSON.stringify({ results }, null, 2));
    await browser.close(); await server.close();
}
