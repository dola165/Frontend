// Real auth/router/Store editor and real media upload; controlled account/catalog
// responses and image display bytes. Hold the real server response during renewal.
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const fixture = JSON.parse(await readFile(process.argv[2], 'utf8'));
const output = 'C:/Users/daddo/IdeaProjects/GrassKickZ/docs/review-reproductions/c1-c2-return/combined';
await mkdir(output, { recursive: true });
const origin = 'http://127.0.0.1:5199';
const server = await createServer({ root: process.cwd(), define: {
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify(origin + '/api'), 'import.meta.env.VITE_ENABLE_MOCKS': '"false"',
}, server: { host: '127.0.0.1', port: 5199, strictPort: true, hmr: false, proxy: { '/api/media': { target: fixture.backend } } } });
await server.listen();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const jwt = (version) => 'review.' + Buffer.from(JSON.stringify({ sub: 'Alpha', version })).toString('base64') + '.fixture';
const png = Buffer.from(fixture.image, 'base64');
const results = [], errors = [], uploads = [];
let allowRefresh = false, refreshes = 0, serverResponded, releaseClient;
const serverReady = new Promise(resolve => { serverResponded = resolve; });
const clientReady = new Promise(resolve => { releaseClient = resolve; });
try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 960 } });
    await context.route('**/*', async route => {
        const req = route.request(), url = new URL(req.url());
        if (url.origin !== origin) return route.abort();
        if (url.pathname.startsWith('/uploads/')) return route.fulfill({ contentType: 'image/png', body: png });
        if (!url.pathname.startsWith('/api/')) return route.continue();
        if (url.pathname === '/api/media/upload') {
            const response = await route.fetch();
            uploads.push({ status: response.status(), body: await response.json() });
            if (uploads.length === 1) { serverResponded(); await clientReady; }
            return route.fulfill({ response });
        }
        let body = [], status = 200;
        if (url.pathname === '/api/auth/csrf') body = { headerName: 'X-XSRF-TOKEN', token: 'synthetic' };
        else if (url.pathname === '/api/auth/refresh') {
            if (allowRefresh) { refreshes++; body = { accessToken: jwt(2) }; }
            else { status = 401; body = {}; }
        } else if (url.pathname === '/api/auth/logout') body = {};
        else if (url.pathname === '/api/users/me') body = { id: 42, fullName: 'Alpha', profileComplete: true, emailVerified: true };
        else if (url.pathname === '/api/review-expired') { status = req.headers().authorization === 'Bearer ' + jwt(2) ? 200 : 401; body = {}; }
        return route.fulfill({ status, json: body });
    });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin + '/review/web-c1/fixture.html');
    await expect(page.getByLabel('Account')).toHaveText('anonymous:-');
    await page.getByRole('button', { name: 'Sign in Alpha' }).click();
    await expect(page.getByRole('button', { name: 'Add product' })).toBeVisible();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page.getByLabel('Account')).toHaveText('anonymous:-');
    await page.getByRole('button', { name: 'Sign in Alpha' }).click();
    await expect(page.getByLabel('Account')).toHaveText('authenticated:Alpha');
    allowRefresh = true;
    const generation = await page.evaluate(() => localStorage.getItem('gk-session-id'));
    await page.getByRole('button', { name: 'Add product' }).click();
    await page.getByLabel('Product name').fill('Boundary photo draft');
    await page.getByLabel('Price', { exact: true }).fill('12.34');
    await page.getByLabel('Add product photo (up to 8)').setInputFiles({ name: 'exact.png', mimeType: 'image/png', buffer: Buffer.concat([png, Buffer.alloc(10 * 1024 * 1024 - png.length)]) });
    await serverReady;
    expect(uploads[0].status).toBe(200); expect(uploads[0].body.type).toBe('image/jpeg');
    await expect(page.getByLabel('Product name')).toBeDisabled();
    const other = await context.newPage(); await other.goto(origin + '/review/web-c1/fixture.html');
    await expect(other.getByLabel('Account')).toHaveText('authenticated:Alpha');
    await other.getByRole('button', { name: 'Renew session' }).click();
    await expect(other.getByText('Renewed', { exact: true })).toBeVisible();
    expect(refreshes).toBe(1);
    expect(await page.evaluate(() => localStorage.getItem('gk-session-id'))).toBe(generation);
    await page.getByRole('link', { name: 'Overview tab' }).click();
    await page.getByRole('link', { name: 'Store tab', exact: true }).click();
    await expect(page.getByLabel('Product name')).toHaveValue('Boundary photo draft');
    await expect(page.getByLabel('Product name')).toBeDisabled();
    let warning = false;
    page.once('dialog', async dialog => { warning = dialog.type() === 'beforeunload'; await dialog.dismiss(); });
    await page.reload({ timeout: 2500 }).catch(() => {}); expect(warning).toBe(true);
    releaseClient();
    await expect(page.getByAltText('Product photo 1')).toBeVisible();
    await expect(page.getByLabel('Product name')).toBeEnabled();
    await page.getByRole('link', { name: 'Overview tab' }).click();
    await page.getByRole('link', { name: 'Store tab', exact: true }).click();
    await expect(page.getByAltText('Product photo 1')).toBeVisible();
    await expect(page.getByLabel('Product name')).toHaveValue('Boundary photo draft');
    await expect(page.getByLabel('Price', { exact: true })).toHaveValue('12.34');
    results.push({ scenario: 'exact-limit-upload-survives-remote-renewal-navigation-and-cancelled-reload', passed: true, bytes: 10485760, refreshes, nativeReloadWarning: warning, singleUpload: uploads.length === 1 });
    await page.getByRole('button', { name: 'Remove photo 1' }).click();
    await page.getByLabel('Add product photo (up to 8)').setInputFiles({ name: 'over.png', mimeType: 'image/png', buffer: Buffer.concat([png, Buffer.alloc(10 * 1024 * 1024 + 1 - png.length)]) });
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByLabel('Product name')).toBeEnabled();
    expect(uploads).toHaveLength(2); expect(uploads[1].status).toBe(413);
    await page.getByRole('link', { name: 'Overview tab' }).click();
    await page.getByRole('link', { name: 'Store tab', exact: true }).click();
    await expect(page.getByLabel('Product name')).toHaveValue('Boundary photo draft');
    await expect(page.getByAltText('Product photo 1')).toHaveCount(0);
    results.push({ scenario: 'oversized-upload-is-rejected-and-retains-renewed-draft', passed: true, bytes: 10485761, status: uploads[1].status });
    await page.screenshot({ path: output + '/retained-draft-after-limit-checks.png' });
    expect(errors).toEqual([]);
    console.log('PASS: real exact-limit upload retained across remote renewal and navigation; oversized failure retains draft.');
} finally {
    releaseClient();
    await writeFile(output + '/browser-results.json', JSON.stringify({ results, uploads, errors, limits: fixture.limits }, null, 2));
    await browser.close(); await server.close();
}
