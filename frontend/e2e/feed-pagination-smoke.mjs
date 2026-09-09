import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';

const fixture = JSON.parse(await readFile(process.argv[2], 'utf8'));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(path.dirname(process.argv[2]), 'feed-browser');
await mkdir(output, { recursive: true });
const server = await createServer({ root, configFile: path.join(root, 'vite.config.ts'),
    define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify(fixture.backend + '/api'), 'import.meta.env.VITE_ENABLE_MOCKS': '"false"' },
    server: { host: '127.0.0.1', port: 5177, strictPort: true, hmr: false } });
await server.listen();
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const results = {};
try {
    const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    context.setDefaultTimeout(12000);
    await context.addInitScript(account => {
        localStorage.setItem('accessToken', account.token);
        localStorage.setItem('userId', String(account.id));
        localStorage.setItem('user', JSON.stringify({ id: account.id, fullName: 'Feed Reader', userType: 'FAN' }));
    }, fixture.viewer);
    const page = await context.newPage();
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.url().includes('/posts/feed/')) requests.push(new URL(request.url()).search); });
    const cards = page.locator('article p.whitespace-pre-line');
    const more = page.getByRole('button', { name: 'Load more posts', exact: true });
    const url = 'http://127.0.0.1:5177/e2e/fixtures/feed-pagination.html';
    await page.goto(url);
    await expect(cards).toHaveCount(20);
    expect(await cards.allTextContents()).toEqual(fixture.discoveryOrder.slice(0, 20));
    let fail = true;
    await page.route('**/posts/feed/for-you?**', async route => {
        if (fail && new URL(route.request().url()).searchParams.has('cursor')) {
            fail = false; await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
        } else await route.continue();
    });
    await more.click();
    await expect(page.getByRole('alert')).toContainText('Older posts could not load');
    await expect(cards).toHaveCount(20);
    await page.getByRole('button', { name: 'Retry older posts' }).click();
    await expect(cards).toHaveCount(40);
    const created = await context.request.post(fixture.backend + '/api/posts', {
        headers: { Authorization: 'Bearer ' + fixture.discovery.token }, data: { content: 'New arrival during pagination', isPublic: true } });
    expect(created.ok()).toBe(true);
    await more.click();
    await expect(cards).toHaveCount(45);
    expect(await cards.allTextContents()).toEqual(fixture.discoveryOrder);
    await expect(page.getByRole('status')).toContainText('all caught up');
    await page.screenshot({ path: path.join(output, 'discovery-complete.png'), fullPage: false });
    await page.getByRole('button', { name: 'Refresh feed' }).click();
    await expect(cards.first()).toHaveText('New arrival during pagination');
    results.discovery = { initialPosts: 45, pages: 3, exactOrder: true, retryRetainedPosts: true, newArrivalAppearsOnRefresh: true };
    console.log('PASS: discovery traverses three pages in exact order, retains posts on failure, retries, and sees new arrivals on refresh');

    const followingResponse = page.waitForResponse(response => response.url().includes('/posts/feed/following'));
    await page.getByRole('link', { name: /Following/i }).click();
    const firstFollowing = await (await followingResponse).json();
    await expect(cards).toHaveCount(20);
    expect(await cards.allTextContents()).toEqual(fixture.followingOrder.slice(0, 20));
    const deleted = await context.request.delete(`${fixture.backend}/api/posts/${firstFollowing.nextCursor}`, {
        headers: { Authorization: 'Bearer ' + fixture.followed.token } });
    expect(deleted.ok()).toBe(true);
    await more.click(); await expect(cards).toHaveCount(40);
    await more.click(); await expect(cards).toHaveCount(45);
    expect(await cards.allTextContents()).toEqual(fixture.followingOrder);
    await expect(page.getByRole('status')).toContainText('all caught up');
    expect(requests.some(query => query.includes('cursorTime='))).toBe(true);
    results.following = { initialPosts: 45, pages: 3, exactOrder: true, deletedBoundaryDidNotBlockPagination: true };
    console.log('PASS: Following traverses three pages, remains separate from discovery and survives deletion of its page boundary');

    // The real HTTP response from an old view must never replace the current one.
    await page.unroute('**/posts/feed/for-you?**');
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    let arrived;
    const waiting = new Promise(resolve => { arrived = resolve; });
    await page.route('**/posts/feed/for-you?**', async route => {
        arrived(); await gate;
        try { await route.continue(); } catch { /* The browser may already have aborted the obsolete request. */ }
    });
    await page.getByRole('link', { name: /For You/i }).click(); await waiting;
    await page.getByRole('link', { name: /Following/i }).click();
    await expect(cards).toHaveCount(20);
    release(); await page.waitForTimeout(500);
    expect((await cards.allTextContents()).every(text => text.startsWith('Following post '))).toBe(true);
    await expect(page.getByText('Home could not load')).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: path.join(output, 'following-narrow.png') });
    results.viewSwitch = { oldResponseIgnored: true, narrowLayoutFits: true };
    console.log('PASS: switching views ignores a delayed old request; narrow web layout has no horizontal overflow');
    expect(errors).toEqual([]);
} finally {
    await writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
    await browser.close(); await server.close();
}
