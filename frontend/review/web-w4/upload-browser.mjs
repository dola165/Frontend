import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const fixture = JSON.parse(await readFile(process.argv[2], 'utf8'));
const output = 'C:/Users/daddo/IdeaProjects/GrassKickZ/docs/review-reproductions/web-w4';
await mkdir(output, { recursive: true });
const origin = 'http://127.0.0.1:5194';
const server = await createServer({ root: process.cwd(),
    define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify(origin + '/api'), 'import.meta.env.VITE_ENABLE_MOCKS': '"false"' },
    server: { host: '127.0.0.1', port: 5194, strictPort: true, hmr: false,
        proxy: { '/api/media': { target: fixture.backend } } } });
await server.listen();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [], writes = [], errors = []; let uploads = 0;
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
    // A valid MIME label cannot establish that the bytes are an actual image.
    await picker.setInputFiles({ name: 'damaged.png', mimeType: 'image/png', buffer: Buffer.from('not an image') });
    const rejected = page.waitForResponse(response => response.url().endsWith('/api/media/upload'));
    await publish.click(); const rejectedResponse = await rejected;
    expect(rejectedResponse.status()).toBe(400);
    await expect(page.getByRole('alert').filter({ hasText: 'Export it as JPEG' })).toBeVisible();
    expect(writes).toEqual([]);
    results.push({ scenario: 'real-server-rejects-damaged-image', passed: true, status: rejectedResponse.status() });
    for (const [name, bytes] of [['supported.png', png], ['exact-10-MiB.png', Buffer.concat([png, Buffer.alloc(10 * 1024 * 1024 - png.length)])]]) {
        await picker.setInputFiles({ name, mimeType: 'image/png', buffer: bytes });
        await text.fill(`Publishing ${name}`);
        const uploaded = page.waitForResponse(response => response.url().endsWith('/api/media/upload'));
        await publish.click(); const response = await uploaded; const media = await response.json();
        expect(response.status()).toBe(200); expect(media.id).toBe(101); expect(media.type).toBe('image/jpeg');
        await expect(text).toHaveValue('');
        expect(writes.at(-1).mediaIds).toEqual([101]);
        results.push({ scenario: `real-client-server-${name}`, passed: true, bytes: bytes.length, status: 200, mediaId: media.id });
        await text.click();
    }
    for (const [name, mimeType, buffer, expectedStatus] of [
        ['video.mp4', 'video/mp4', Buffer.from('video'), 400],
        ['over-limit.png', 'image/png', Buffer.alloc(10 * 1024 * 1024 + 1), 413],
    ]) {
        const response = await context.request.post(origin + '/api/media/upload', { multipart: { file: { name, mimeType, buffer } } });
        expect(response.status()).toBe(expectedStatus);
        results.push({ scenario: `server-enforces-${name}-without-client-validation`, passed: true, status: response.status() });
    }
    await page.screenshot({ path: output + '/image-only-composer.png' });
    expect(errors).toEqual([]);
    console.log('PASS: eight client/server upload checks using the real media controller and bounded decoder.');
} finally {
    await writeFile(output + '/browser-results.json', JSON.stringify({ results, writes, errors }, null, 2));
    await browser.close(); await server.close();
}
