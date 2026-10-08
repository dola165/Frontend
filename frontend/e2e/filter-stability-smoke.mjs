import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';

// Exercise the real app/router with controlled HTTP timing, independently of Redis.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'review/filter-stability');
await mkdir(output, { recursive: true });
const server = await createServer({ root, configFile: path.join(root, 'vite.config.ts'),
    define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/api'), 'import.meta.env.VITE_ENABLE_MOCKS': '"false"' },
    server: { host: '127.0.0.1', port: 5186, strictPort: true, hmr: false } });
await server.listen();
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const errors = [];
const requests = { clubs: 0, feed: 0, documents: 0 };
const results = {};
let releaseClubs, releaseFeed;
let clubGate, feedGate;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    page.on('pageerror', error => { errors.push(error.message); console.error('Browser error:', error.message); });
    page.on('console', message => { if (message.type() === 'error') console.error('Browser console:', message.text()); });
    page.on('request', request => { if (request.resourceType() === 'document') requests.documents++; });
    await context.addInitScript(() => {
        localStorage.setItem('accessToken', 'browser-test-token');
        localStorage.setItem('i18nextLng', 'en');
    });
    await context.route('**/api/**', async route => {
        const url = new URL(route.request().url());
        if (!url.pathname.startsWith('/api/')) return route.continue();
        let body = [];
        if (url.pathname === '/api/auth/csrf') body = { headerName: 'X-XSRF-TOKEN', token: 'test' };
        else if (url.pathname === '/api/auth/refresh') body = { accessToken: 'browser-test-token' };
        else if (url.pathname === '/api/users/me') body = { id: 1, fullName: 'Meeting rehearsal', profileComplete: true, emailVerified: true };
        else if (url.pathname.includes('membership-context')) body = { canCreateClub: true };
        else if (url.pathname === '/api/clubs') {
            requests.clubs++;
            if (clubGate) await clubGate;
            else await pause(120);
            const content = url.searchParams.get('search') === 'empty' ? [] : Array.from({ length: 12 }, (_, index) => ({
                id: index + 1, name: `Rehearsal club ${index + 1}`, description: 'Club directory stability check',
                type: 'ACADEMY', followerCount: 10, memberCount: 20, isOfficial: false, isFollowedByMe: false,
            }));
            body = { content, pageNumber: 0, pageSize: 12, totalElements: content.length, totalPages: content.length ? 1 : 0 };
        } else if (url.pathname.startsWith('/api/posts/feed/')) {
            requests.feed++;
            if (feedGate) await feedGate;
            else await pause(120);
            const following = url.pathname.endsWith('following');
            body = { posts: Array.from({ length: 6 }, (_, index) => ({ id: (following ? 100 : 200) + index,
                authorName: 'Rehearsal author', content: `${following ? 'Following' : 'Discover'} post ${index}`,
                createdAt: '2026-09-10T10:00:00Z', likeCount: 0, commentCount: 0, isLikedByMe: false,
            })), nextCursor: null };
        }
        await route.fulfill({ json: body }).catch(() => {}); // Obsolete requests may have been aborted.
    });
    await page.goto('http://127.0.0.1:5186/clubs');
    await expect(page.getByText('Rehearsal club 1', { exact: true })).toBeVisible({ timeout: 15000 }).catch(async error => {
        console.error('Rendered page:', await page.locator('body').innerText());
        console.error('Requests:', requests);
        throw error;
    });
    const directoryBaseline = requests.clubs;
    const heading = await page.getByRole('heading', { name: 'Club Directory' }).elementHandle();
    const card = await page.getByText('Rehearsal club 1', { exact: true }).elementHandle();
    clubGate = new Promise(resolve => { releaseClubs = resolve; });
    await page.getByRole('button', { name: 'ACADEMY', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Loading clubs');
    expect(await card.evaluate(element => element.isConnected)).toBe(true);
    expect(await heading.evaluate(element => element.isConnected)).toBe(true);
    releaseClubs(); clubGate = null;
    await expect(page.getByRole('status')).toHaveCount(0);
    for (let i = 0; i < 30; i++) {
        await page.getByRole('button', { name: i % 2 ? 'ACADEMY' : 'OPEN TRIAL', exact: true }).click();
    }
    await expect(page.getByRole('status')).toHaveCount(0);
    await pause(1500);
    expect(requests.clubs - directoryBaseline).toBe(31);
    const filterRequests = requests.clubs - directoryBaseline;
    expect(await heading.evaluate(element => element.isConnected)).toBe(true);
    const search = page.getByRole('textbox', { name: 'Search clubs' });
    await search.fill('empty');
    await expect(page).toHaveURL(/search=empty/);
    await expect(page.getByText('Rehearsal club 1', { exact: true })).toHaveCount(0);
    clubGate = new Promise(resolve => { releaseClubs = resolve; });
    await search.fill('recover');
    await expect(page).toHaveURL(/search=recover/);
    await expect(page.getByRole('status')).toContainText('Loading clubs');
    await expect(search).toBeFocused();
    expect(await heading.evaluate(element => element.isConnected)).toBe(true);
    releaseClubs(); clubGate = null;
    await expect(page.getByText('Rehearsal club 1', { exact: true })).toBeVisible();
    await expect(page.getByRole('status')).toHaveCount(0);
    await expect(search).toHaveValue('recover');
    await search.fill('');
    await expect(page).not.toHaveURL(/search=/);
    await search.pressSequentially('quick typing', { delay: 5 });
    await expect(search).toHaveValue('quick typing');
    await expect(page).toHaveURL(/search=quick\+typing/);
    await expect(page.getByRole('status')).toHaveCount(0);
    await page.screenshot({ path: path.join(output, 'directory.png') });
    results.directory = { repeatedFilterChanges: 31, requestsForRepeatedChanges: filterRequests,
        totalRequestsIncludingTextChecks: requests.clubs - directoryBaseline, fastTypingPreserved: true,
        retainedControls: true, retainedCardsDuringLoading: true, recoveredFromEmptyWithoutLosingFocus: true };

    await page.getByRole('link', { name: 'Home', exact: true }).first().click();
    await expect(page.getByText('Discover post 0', { exact: true })).toBeVisible();
    const feedBaseline = requests.feed;
    const post = await page.getByText('Discover post 0', { exact: true }).elementHandle();
    feedGate = new Promise(resolve => { releaseFeed = resolve; });
    await page.getByRole('link', { name: 'Following', exact: true }).click();
    await expect(page.getByText('Loading Following posts…')).toBeVisible();
    expect(await post.evaluate(element => element.isConnected)).toBe(true);
    releaseFeed(); feedGate = null;
    await expect(page.getByText('Following post 0', { exact: true })).toBeVisible();
    for (let i = 0; i < 20; i++) {
        await page.getByRole('link', { name: i % 2 ? 'Following' : 'Discover', exact: true }).click();
    }
    await expect(page.getByRole('region', { name: 'Feed results' })).toHaveAttribute('aria-busy', 'false');
    await expect(page.getByText('Following post 0', { exact: true })).toBeVisible();
    await pause(1500);
    expect(requests.feed - feedBaseline).toBe(21);
    expect(requests.documents).toBe(1);
    expect(errors).toEqual([]);
    results.feed = { repeatedSwitches: 21, requests: requests.feed - feedBaseline, retainedPostsDuringLoading: true };
    await page.screenshot({ path: path.join(output, 'feed.png') });
    results.documentNavigations = requests.documents;
    results.errors = errors;
    await writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
} finally {
    releaseClubs?.(); releaseFeed?.();
    await browser.close();
    await server.close();
}
