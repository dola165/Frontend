// Actual auth/client/router/commerce components; synthetic accounts and controlled HTTP.
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const output = 'C:/Users/daddo/IdeaProjects/GrassKickZ/docs/review-reproductions/c1-c2-return/c1';
await mkdir(output, { recursive: true });
const origin = 'http://127.0.0.1:5197';
const fixture = origin + '/review/web-c1/fixture.html';
const server = await createServer({ root: process.cwd(), define: {
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify(origin + '/api'), 'import.meta.env.VITE_ENABLE_MOCKS': '"false"',
}, server: { host: '127.0.0.1', port: 5197, strictPort: true, hmr: false } });
await server.listen();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [], errors = [];
const jwt = (account, version) => 'review.' + Buffer.from(JSON.stringify({ sub: account, version })).toString('base64') + '.fixture';
const latch = () => { let release; const promise = new Promise(resolve => { release = resolve; }); return { promise, release }; };
const fields = [['Store', 'Product name', 'Add product'], ['Campaigns', 'Campaign title', 'Create campaign'], ['Jobs', 'Job title', /Post.*(job|opening)|New.*(job|posting)/i]];
async function cancelReload(page) {
    let warned = false;
    page.once('dialog', async dialog => { warned = dialog.type() === 'beforeunload'; await dialog.dismiss(); });
    await page.reload({ timeout: 2500 }).catch(() => {});
    expect(warned).toBe(true);
}
try {
    for (const scenario of ['three-feature-drafts', 'pending-photo']) {
        const context = await browser.newContext({ viewport: { width: 1280, height: 980 } });
        let renewAllowed = false, expiredRequests = 0, refreshes = 0, uploads = 0;
        const uploadStarted = latch(), uploadFinish = latch();
        try {
            await context.route('**/*', async route => {
                const req = route.request(), url = new URL(req.url());
                if (url.origin !== origin) return route.abort();
                if (!url.pathname.startsWith('/api/')) return route.continue();
                let body = [], status = 200;
                if (url.pathname === '/api/auth/csrf') body = { headerName: 'X-XSRF-TOKEN', token: 'synthetic' };
                else if (url.pathname === '/api/auth/refresh') {
                    if (renewAllowed) body = { accessToken: jwt('Alpha', ++refreshes + 1) };
                    else { status = 401; body = {}; }
                } else if (url.pathname === '/api/auth/logout') body = {};
                else if (url.pathname === '/api/users/me') {
                    const bravo = req.headers().authorization === 'Bearer ' + jwt('Bravo', 1);
                    body = { id: bravo ? 2 : 1, fullName: bravo ? 'Bravo' : 'Alpha', profileComplete: true, emailVerified: true };
                } else if (url.pathname === '/api/review-expired') {
                    expiredRequests++; status = expiredRequests % 2 === 1 ? 401 : 200; body = {};
                } else if (url.pathname === '/api/media/upload') {
                    uploads++; uploadStarted.release(); await uploadFinish.promise;
                    body = { url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=' };
                }
                return route.fulfill({ status, json: body });
            });
            const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
            await page.goto(fixture); await expect(page.getByLabel('Account')).toHaveText('anonymous:-');
            await page.getByRole('button', { name: 'Sign in Alpha' }).click();
            await expect(page.getByRole('button', { name: 'Add product' })).toBeVisible();
            await page.getByRole('button', { name: 'Sign out', exact: true }).click();
            await expect(page.getByLabel('Account')).toHaveText('anonymous:-');
            await page.getByRole('button', { name: 'Sign in Alpha' }).click();
            await expect(page.getByLabel('Account')).toHaveText('authenticated:Alpha');
            renewAllowed = true;
            if (scenario === 'three-feature-drafts') {
                for (const [feature, field, create] of fields) {
                    await page.getByRole('link', { name: feature + ' tab', exact: true }).click();
                    await page.getByRole('button', { name: create }).click();
                    await page.getByLabel(field, { exact: true }).fill('Retained ' + feature);
                }
                await page.getByRole('button', { name: 'Renew session' }).click();
                await expect(page.getByText('Renewed', { exact: true })).toBeVisible();
                expect(refreshes).toBe(1); expect(expiredRequests).toBe(2);
                for (const [feature, field] of fields) {
                    await page.getByRole('link', { name: feature + ' tab', exact: true }).click();
                    await expect(page.getByLabel(field, { exact: true })).toHaveValue('Retained ' + feature);
                }
                await cancelReload(page);
                await expect(page.getByLabel('Job title')).toHaveValue('Retained Jobs');
                await page.screenshot({ path: output + '/renewed-draft-and-warning.png', fullPage: true });
                const other = await context.newPage(); await other.goto(fixture);
                await expect(other.getByLabel('Account')).toHaveText('authenticated:Alpha');
                await other.getByRole('button', { name: 'Sign in Alpha' }).click();
                await expect(page.getByRole('button', { name: fields[2][2] })).toBeVisible();
                await expect(page.getByLabel('Job title')).toHaveCount(0);
                for (const [feature, field, create] of fields) {
                    await page.getByRole('link', { name: feature + ' tab', exact: true }).click();
                    await page.getByRole('button', { name: create }).click();
                    await expect(page.getByLabel(field, { exact: true })).toHaveValue('');
                }
                await other.close();
            } else {
                await page.getByRole('button', { name: 'Add product' }).click();
                await page.getByLabel('Product name').fill('Pending Alpha photo');
                await page.getByLabel('Add product photo (up to 8)').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('fixture') });
                await uploadStarted.promise;
                const other = await context.newPage(); await other.goto(fixture);
                await expect(other.getByLabel('Account')).toHaveText('authenticated:Alpha');
                await other.evaluate(async token => { const auth = await import('/src/utils/authStorage.ts'); auth.setRefreshedAccessToken(token, auth.getAuthSessionId()); }, jwt('Alpha', 2));
                await page.getByRole('link', { name: 'Overview tab' }).click();
                await page.getByRole('link', { name: 'Store tab', exact: true }).click();
                await expect(page.getByLabel('Product name')).toHaveValue('Pending Alpha photo');
                await expect(page.getByLabel('Product name')).toBeDisabled();
                await cancelReload(page);
                uploadFinish.release();
                await expect(page.getByAltText('Product photo 1')).toBeVisible();
                await expect(page.getByLabel('Product name')).toBeEnabled();
                await page.getByRole('link', { name: 'Overview tab' }).click();
                await page.getByRole('link', { name: 'Store tab', exact: true }).click();
                await expect(page.getByAltText('Product photo 1')).toBeVisible();
                await expect(page.getByLabel('Product name')).toHaveValue('Pending Alpha photo');
                expect(uploads).toBe(1);
                await page.screenshot({ path: output + '/retained-upload-after-remote-renewal.png', fullPage: true });
                await other.close();
            }
            expect(errors).toEqual([]);
            results.push({ scenario, passed: true, nativeReloadCancelled: true, refreshes, uploads });
            console.log('PASS:', scenario);
        } finally { uploadFinish.release(); await context.close(); }
    }
} finally {
    await writeFile(output + '/browser-results.json', JSON.stringify({ results, errors }, null, 2));
    await browser.close(); await server.close();
}
