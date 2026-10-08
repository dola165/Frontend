import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, expect } from '@playwright/test';

const release = process.env.DOLA_RELEASE_ROOT || 'C:/Users/daddo/IdeaProjects/GrassKickZ/outputs/agent-dola';
let folder = process.env.DOLA_BASELINE_WEB_DIRECTORY || path.join(release, 'baseline-web');
const server = createServer(async (request, response) => {
    let filename = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (!path.extname(filename)) filename = '/index.html';
    const file = path.resolve(folder, '.' + filename);
    if (!file.startsWith(path.resolve(folder) + path.sep)) { response.writeHead(403).end(); return; }
    try {
        const body = await readFile(file);
        const type = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' }[path.extname(file)] || 'application/octet-stream';
        response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }).end(body);
    } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(5198, '127.0.0.1', resolve));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' && /ErrorBoundary|Invalid hook|Minified React/i.test(message.text())) errors.push(message.text()); });
    await page.addInitScript(() => {
        localStorage.setItem('gk-session-id', 'dola-transition');
        localStorage.setItem('gk-session-token:dola-transition', `e30.${btoa(JSON.stringify({ sub: '999999', exp: 4102444800 }))}.synthetic`);
        localStorage.setItem('i18nextLng', 'en'); localStorage.setItem('theme-preference', 'light');
    });
    await page.routeWebSocket('**', socket => socket.close());
    await page.route('**/api/**', async route => {
        const url = new URL(route.request().url()); let json = [];
        if (url.pathname.endsWith('/users/me')) json = { id: 999999, username: 'synthetic', fullName: 'Demo Coach', role: 'COACH', dob: '1990-01-01', emailVerified: true, profileComplete: true, onboardingRequired: false, mustChangePassword: false, navigationCapabilities: { version: 1, workspaces: [{ id: 'club.workspace', context: { type: 'club', id: 21, label: 'Academy' } }] } };
        else if (url.pathname.endsWith('/auth/csrf')) json = { headerName: 'X-XSRF-TOKEN', token: 'synthetic' };
        else if (url.pathname.includes('membership-context')) json = { hasClubMembership: false, canCreateClub: false };
        else if (url.pathname.includes('/feed') || url.pathname.includes('notifications')) json = { content: [], totalElements: 0, last: true, unreadCount: 0 };
        else if (url.pathname.includes('unread')) json = { count: 0, unreadCount: 0 };
        else if (url.pathname.endsWith('/assistant/dola/status')) json = { name: 'Agent Dola', available: true, mode: 'READ_ONLY_PILOT', maxMessageLength: 2000, capabilities: [] };
        await route.fulfill({ json });
    });
    await page.goto('http://127.0.0.1:5198/home');
    await expect(page.getByRole('navigation', { name: 'Home shortcuts' })).toBeVisible();
    folder = path.join(release, process.env.DOLA_WEB_DIRECTORY || 'web-r1');
    await page.getByRole('link', { name: 'Clubs', exact: true }).filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/clubs$/);
    await expect(page.getByText('Something went wrong', { exact: true })).toHaveCount(0);
    await page.getByRole('link', { name: 'Home', exact: true }).filter({ visible: true }).first().click();
    await page.reload();
    await expect(page.getByRole('link', { name: 'Club workspace', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Agent Dola', exact: true }).filter({ visible: true }).first().click();
    await expect(page.getByRole('heading', { name: /What can I help you find\?|What would you like to get done\?/ })).toBeVisible();
    expect(errors).toEqual([]);
    await writeFile(path.join(release, 'transition-proof.json'), JSON.stringify({ status: 'passed', priorTabLazyNavigation: true, freshDolaEntry: true, errors }, null, 2));
    console.log('PASS existing-tab transition, retained lazy routes and fresh Agent Dola entry');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
