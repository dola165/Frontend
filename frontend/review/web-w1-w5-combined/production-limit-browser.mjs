import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const fixture = JSON.parse(await readFile(process.argv[2], 'utf8'));
const output = 'C:/Users/daddo/IdeaProjects/GrassKickZ/docs/review-reproductions/web-w1-w5-combined/production-limit';
await mkdir(output, { recursive: true });
const origin = 'http://127.0.0.1:5194';
const server = await createServer({ root: process.cwd(),
    define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify(origin + '/api'), 'import.meta.env.VITE_ENABLE_MOCKS': '"false"' },
    server: { host: '127.0.0.1', port: 5194, strictPort: true, hmr: false,
        proxy: { '/api/media': { target: fixture.backend } } } });
await server.listen();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [], writes = [], errors = [], failures = []; let uploads = 0;
const png = Buffer.from(fixture.image, 'base64');
try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    await context.route('**/*', async route => {
        const req = route.request(), url = new URL(req.url());
        if (url.origin !== origin || url.pathname.startsWith('/ws')) return route.abort();
        if (url.pathname === '/api/media/upload') { uploads++; return route.continue(); }
        if (!url.pathname.startsWith('/api/')) return route.continue();
        let body = [], status = 200;
        if (url.pathname === '/api/auth/csrf') body = { headerName: 'X-XSRF-TOKEN', token: 'synthetic' };
        else if (url.pathname.startsWith('/api/auth/')) { status = 401; body = {}; }
        else if (url.pathname === '/api/users/me') body = { id: 42, fullName: 'Upload Reviewer', username: 'reviewer',
            role: 'FAN', dob: '1990-01-01', profileComplete: true, onboardingRequired: false, emailVerified: true };
        else if (url.pathname === '/api/clubs/my-membership-context') body = { hasClubMembership: false, canCreateClub: false };
        else if (url.pathname.startsWith('/api/posts/feed/')) body = { posts: [], nextCursor: null };
        else if (url.pathname === '/api/posts' && req.method() === 'POST') {
            writes.push(req.postDataJSON()); body = { id: writes.length };
        } else if (url.pathname.includes('notifications') || url.pathname.includes('conversations')) body = { content: [], totalElements: 0 };
        return route.fulfill({ status, json: body });
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    page.on('requestfailed', req => failures.push({ url: req.url(), failure: req.failure() }));
    await page.goto(origin + '/login');
    await expect(page.getByRole('textbox', { name: /email/i }).first()).toBeVisible({ timeout: 15000 });
    await page.evaluate(async () => { const auth = await import('/src/utils/authStorage.ts'); auth.setStoredAccessToken('synthetic-upload'); });
    await page.goto(origin + '/home');
    const text = page.getByRole('textbox', { name: 'Create a post' });
    const picker = page.getByLabel('Choose photo');
    const publish = page.getByRole('button', { name: 'Publish post' });
    await expect(page.getByText('Upload Reviewer', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /video/i })).toHaveCount(0);
    await expect(picker).toHaveAttribute('accept', 'image/jpeg,image/png,image/gif,image/webp');
    await text.click();
    await expect(page.getByText(/Max 10 MB/)).toBeVisible();
    for (const [name, mimeType, buffer, message] of [
        ['video.mp4', 'video/mp4', Buffer.from('video'), 'Videos are not supported'],
        ['too-large.png', 'image/png', Buffer.alloc(10 * 1024 * 1024 + 1), '10 MB or smaller'],
        ['vector.svg', 'image/svg+xml', Buffer.from('<svg/>'), 'Choose a JPEG'],
    ]) {
        await picker.setInputFiles({ name, mimeType, buffer });
        await expect(page.getByRole('alert').filter({ hasText: message })).toBeVisible();
        await expect(page.getByAltText('Upload preview')).toHaveCount(0);
        await expect(publish).toBeDisabled(); expect(uploads).toBe(0);
        results.push({ scenario: `client-rejects-${name}`, passed: true, networkUploads: 0 });
    }
    // Production application.yaml is loaded unchanged by the server fixture.
    // First prove a small valid image reaches real storage; then assert the defect.
    for (const [name, bytes, expectedStatus] of [
        ['small.png', png, 200],
        ['exact-10-MiB.png', Buffer.concat([png, Buffer.alloc(10 * 1024 * 1024 - png.length)]), 413],
    ]) {
        await picker.setInputFiles({ name, mimeType: 'image/png', buffer: bytes });
        await text.fill(`Publishing ${name}`);
        await expect(page.getByAltText('Upload preview')).toBeVisible();
        const upload = Promise.race([page.waitForResponse(response => response.url().endsWith('/api/media/upload')), page.waitForEvent('requestfailed', req => req.url().endsWith('/api/media/upload')).then(req => ({ status: () => 0, json: async () => req.failure() }))]);
        await publish.click(); const response = await upload;
        if (expectedStatus === 200) expect(response.status()).toBe(200);
        else expect([0, 413, 500]).toContain(response.status());
        if (expectedStatus === 200) await expect(text).toHaveValue('');
        else {
            await expect(page.getByRole('alert').filter({ hasText: /10 MB or smaller|Photo upload failed/ })).toBeVisible();
            await expect(text).toHaveValue(`Publishing ${name}`);
        }
        results.push({ scenario: name, clientAccepted: true, bytes: bytes.length, status: response.status(), response: await response.json(), defectReproduced: expectedStatus === 413 });
    }
    expect(writes).toHaveLength(1);
    await page.screenshot({ path: output + '/image-only-composer.png' });
    expect(errors).toEqual([]);
    console.log('REPRODUCED: production total-request cap prevents a valid exactly-10-MiB photo accepted by the composer.');
} finally {
    await writeFile(output + '/browser-results.json', JSON.stringify({ results, writes, errors, failures, uploads, fixtureLimits: fixture.limits }, null, 2));
    await browser.close(); await server.close();
}
