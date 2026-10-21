// Full application with actual composer/client and controlled synthetic HTTP.
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const output = 'C:/Users/daddo/IdeaProjects/GrassKickZ/docs/review-reproductions/web-w1-w5-combined/w3';
await mkdir(output, { recursive: true });
const origin = 'http://127.0.0.1:5193';
const server = await createServer({ root: process.cwd(),
    define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify(origin + '/api'), 'import.meta.env.VITE_ENABLE_MOCKS': '"false"' },
    server: { host: '127.0.0.1', port: 5193, strictPort: true, hmr: false } });
await server.listen();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
const latch = () => { let release; const promise = new Promise(resolve => { release = resolve; }); return { promise, release }; };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=', 'base64');
try {
    for (const scenario of ['pending-text-publication', 'pending-photo-and-replacement-retry']) {
        const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
        const writes = [], uploads = [], errors = [];
        const postStarted = latch(), postFinish = latch(), uploadStarted = latch(), uploadFinish = latch();
        await context.route('**/*', async route => {
            const req = route.request(), url = new URL(req.url());
            if (url.origin !== origin || url.pathname.startsWith('/ws')) return route.abort();
            if (!url.pathname.startsWith('/api/')) return route.continue();
            let body = [], status = 200;
            if (url.pathname === '/api/auth/csrf') body = { headerName: 'X-XSRF-TOKEN', token: 'synthetic' };
            else if (url.pathname.startsWith('/api/auth/')) { status = 401; body = {}; }
            else if (url.pathname === '/api/users/me') body = { id: 1, fullName: 'Account Alpha', username: 'alpha',
                role: 'FAN', dob: '1990-01-01', profileComplete: true, onboardingRequired: false, emailVerified: true };
            else if (url.pathname === '/api/clubs/my-membership-context') body = { hasClubMembership: false, canCreateClub: false };
            else if (url.pathname.startsWith('/api/posts/feed/')) body = { posts: [], nextCursor: null };
            else if (url.pathname === '/api/media/upload') {
                const filename = req.postDataBuffer().toString().match(/filename="([^"]+)"/)?.[1]; uploads.push(filename);
                if (uploads.length === 1) { uploadStarted.release(); await uploadFinish.promise; }
                body = { id: uploads.length === 1 ? 101 : 202 };
            } else if (url.pathname === '/api/posts' && req.method() === 'POST') {
                writes.push({ authorization: req.headers().authorization, body: req.postDataJSON() });
                if (writes.length === 1) { postStarted.release(); await postFinish.promise; }
                if (scenario === 'pending-photo-and-replacement-retry' && writes.length === 1) { status = 503; body = {}; }
                else body = { id: writes.length };
            } else if (url.pathname.includes('notifications') || url.pathname.includes('conversations')) body = { content: [], totalElements: 0 };
            return route.fulfill({ status, json: body });
        });
        const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
        await page.goto(origin + '/login');
        await expect(page.getByRole('textbox', { name: /email/i }).first()).toBeVisible({ timeout: 15000 });
        await page.evaluate(async () => { const auth = await import('/src/utils/authStorage.ts'); auth.setStoredAccessToken('A-token'); });
        await page.goto(origin + '/home');
        await expect(page.getByText('Account Alpha', { exact: true }).first()).toBeVisible();
        const text = page.getByRole('textbox', { name: 'Create a post' });
        const publish = page.getByRole('button', { name: 'Publish post' });
        const picker = page.getByLabel('Choose photo');
        await text.fill('Original submitted text');
        if (scenario === 'pending-photo-and-replacement-retry') await picker.setInputFiles({ name: 'first.png', mimeType: 'image/png', buffer: png });
        await publish.click();
        if (scenario === 'pending-photo-and-replacement-retry') {
            await uploadStarted.promise;
            await expect(text).toBeDisabled(); await expect(picker).toBeDisabled();
            await expect(page.getByRole('button', { name: 'Remove attachment' })).toBeDisabled();
            await expect(publish).toBeDisabled();
            expect(writes).toEqual([]);
            await page.screenshot({ path: output + '/pending-photo-locked.png' });
            uploadFinish.release();
        }
        await postStarted.promise;
        await expect(text).toBeDisabled(); await expect(picker).toBeDisabled(); await expect(publish).toBeDisabled();
        await expect(page.getByRole('button', { name: 'Photo', exact: true })).toBeDisabled();
        await expect(page.getByRole('button', { name: 'Video', exact: true })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Event', exact: true })).toBeDisabled();
        await page.keyboard.type('New text cannot enter a submitted draft');
        await expect(text).toHaveValue('Original submitted text');
        await expect(page.getByRole('status').filter({ hasText: 'Publishing your post' })).toBeVisible();
        postFinish.release();
        if (scenario === 'pending-text-publication') {
            await expect(text).toBeEnabled(); await expect(text).toHaveValue('');
            await text.fill('Fresh draft after successful publication');
            await expect(text).toHaveValue('Fresh draft after successful publication');
            expect(writes.map(write => write.body.content)).toEqual(['Original submitted text']);
        } else {
            await expect(page.getByRole('alert').filter({ hasText: 'Failed to publish this post' })).toBeVisible();
            await expect(text).toBeEnabled(); await expect(text).toHaveValue('Original submitted text');
            await page.getByRole('button', { name: 'Remove attachment' }).click();
            await picker.setInputFiles({ name: 'replacement.png', mimeType: 'image/png', buffer: png });
            await text.fill('Corrected text and replacement photo');
            await publish.click();
            await expect.poll(() => writes.length).toBe(2);
            await expect(text).toHaveValue('');
            expect(uploads).toEqual(['first.png', 'replacement.png']);
            expect(writes.map(write => write.body.mediaIds)).toEqual([[101], [202]]);
            expect(writes[1].body.content).toBe('Corrected text and replacement photo');
        }
        expect(errors).toEqual([]);
        results.push({ scenario, passed: true, fullApp: true, writes, uploads, errors });
        await context.close();
    }
    console.log('PASS: full-app delayed publication and delayed upload/failure/replacement/retry.');
} finally {
    await writeFile(output + '/browser-results.json', JSON.stringify(results, null, 2));
    await browser.close(); await server.close();
}
