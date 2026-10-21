import { preview } from 'vite';
import { createServer } from 'node:http';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('review/agent-dola-awareness'); await mkdir(output, { recursive: true });
const vite = await preview({ preview: { host: '127.0.0.1', port: 5197, strictPort: true } });
let latest = null, paid = 0;
const server = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:5197'); res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'authorization,content-type,x-xsrf-token');
    if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
    let body = ''; for await (const chunk of req) body += chunk;
    const request = JSON.parse(body); paid++;
    expect(request.includePersonalContext).toBe(false);
    res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' });
    res.write(JSON.stringify({ type: 'ready' }) + '\n');
    const words = ['Open ', 'U12 Mixed schedule ', 'for your next match ', 'at 16:00 ', 'on Synthetic Pitch B.'];
    const answer = { conversationId: 'f54a54bd-bd7c-48eb-a248-f3874ba0a2b1', requestId: request.requestId, answer: words.join(''), destinations: [{ id: 'squad_schedule:12', title: 'U12 Mixed schedule', path: '/squads/12?tab=sessions' }], sources: [], toolsUsed: ['read_next_squad_matches'], modelCalls: 2, totalTokens: 80 };
    let index = 0;
    const timer = setInterval(() => {
        if (index < words.length) res.write(JSON.stringify({ type: 'delta', text: words[index++] }) + '\n');
        else {
            clearInterval(timer);
            latest = { conversationId: answer.conversationId, expiresAt: new Date(Date.now() + 45 * 60000).toISOString(), turns: [...(latest?.turns ?? []), { question: request.message, result: answer }] };
            res.end(JSON.stringify({ type: 'complete', answer }) + '\n');
        }
    }, 200);
    res.on('close', () => clearInterval(timer));
});
await new Promise(resolve => server.listen(5199, '127.0.0.1', resolve));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const evidence = [];
try {
    for (const [name, width, height, theme] of [['desktop', 1440, 1000, 'light'], ['desktop-dark', 1440, 1000, 'dark'], ['mobile', 390, 844, 'light']]) {
        latest = null; paid = 0;
        const page = await browser.newPage({ viewport: { width, height } }); const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error' && /ErrorBoundary|Minified React|Invalid hook/.test(message.text())) errors.push(message.text()); });
        await page.addInitScript(theme => {
            localStorage.setItem('gk-session-id', 'dola-persistence-test');
            localStorage.setItem('gk-session-token:dola-persistence-test', `e30.${btoa(JSON.stringify({ sub: '999999', exp: 4102444800 }))}.synthetic`);
            localStorage.setItem('theme-preference', theme); localStorage.setItem('i18nextLng', 'en');
        }, theme);
        await page.routeWebSocket('**', socket => socket.close());
        await page.route('**/api/**', async route => {
            const url = new URL(route.request().url()); let json = [];
            if (url.pathname.endsWith('/assistant/dola/messages/stream')) return route.continue({ url: 'http://127.0.0.1:5199/stream' });
            if (url.pathname.endsWith('/users/me')) json = { id: 999999, username: 'synthetic', fullName: 'Demo Coach', role: 'COACH', dob: '1990-01-01', emailVerified: true, profileComplete: true, onboardingRequired: false, mustChangePassword: false, navigationCapabilities: { version: 1, workspaces: [] } };
            else if (url.pathname.endsWith('/auth/csrf')) json = { headerName: 'X-XSRF-TOKEN', token: 'synthetic' };
            else if (url.pathname.endsWith('/assistant/dola/status')) json = { name: 'Agent Dola', available: true, mode: 'READ_ONLY_PILOT', maxMessageLength: 2000, capabilities: [] };
            else if (url.pathname.endsWith('/assistant/dola/conversations/latest')) return latest ? route.fulfill({ json: latest }) : route.fulfill({ status: 204 });
            else if (route.request().method() === 'DELETE') { latest = null; return route.fulfill({ status: 204 }); }
            else if (url.pathname.endsWith('/squad-communication/12')) json = { id: 12, club_id: 7, academy_name: 'Dinamo Academy', name: 'U12 Mixed', category: 'U12', can_manage: true, can_assign_coach: false, coaches: [], players: [], threads: [], available_coaches: [], member_count: 0, notify_chat: true };
            else if (url.pathname.endsWith('/schedule')) json = { events: [] };
            else if (url.pathname.includes('membership-context')) json = { hasClubMembership: false, canCreateClub: false };
            else if (url.pathname.includes('unread')) json = { count: 0, unreadCount: 0 };
            else if (url.pathname.includes('/feed') || url.pathname.includes('notifications')) json = { content: [], totalElements: 0, last: true, unreadCount: 0 };
            await route.fulfill({ json });
        });
        await page.clock.install();
        await page.goto('http://127.0.0.1:5197/assistant');
        const composer = page.getByLabel('Message Agent Dola');
        await composer.fill('When is the next match for my squads in Dinamo Academy?'); await page.getByRole('button', { name: 'Send message' }).click();
        await expect(page.locator('.dola-answer > p')).toContainText('Open', { timeout: 10000 });
        expect(await page.locator('.dola-destination').count()).toBe(0);
        await expect(page.locator('.dola-destination')).toBeVisible();
        expect(paid).toBe(1);
        await page.locator('.dola-destination').click();
        await expect(page).toHaveURL(/\/squads\/12\?tab=sessions$/);
        const dock = page.getByRole('dialog', { name: 'Agent Dola sidebar' });
        await expect(dock).toBeVisible(); await expect(dock.getByText('When is the next match for my squads in Dinamo Academy?', { exact: true })).toBeVisible();
        await expect(dock.locator('.dola-answer > p')).toHaveText('Open U12 Mixed schedule for your next match at 16:00 on Synthetic Pitch B.');
        await expect(page.getByText('Loading page…', { exact: true })).toHaveCount(0);
        await expect(page.getByRole('heading', { name: /^Squad schedule/ })).toBeVisible();
        await page.screenshot({ path: path.join(output, `${name}-docked.png`), fullPage: true });
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
        await dock.getByRole('button', { name: 'Open full page' }).click();
        await expect(page).toHaveURL(/\/assistant$/); await expect(page.locator('.dola-answer > p')).toBeVisible();
        await page.getByRole('button', { name: 'Move chat to sidebar' }).click();
        await expect(page).toHaveURL(/\/squads\/12\?tab=sessions$/); await expect(dock).toBeVisible();
        await dock.getByLabel('Message Agent Dola').fill('And where can I find the coaches?');
        await dock.getByRole('button', { name: 'Send message' }).click();
        await expect(dock.locator('.dola-answer > p').last()).toContainText('Open');
        await dock.getByRole('button', { name: 'Close chat' }).click(); await expect(dock).toHaveCount(0);
        await expect.poll(() => latest?.turns.length).toBe(2);
        await page.getByRole('link', { name: 'Agent Dola', exact: true }).filter({ visible: true }).click();
        await dock.getByRole('button', { name: 'Continue last chat' }).click();
        await expect(dock.locator('.dola-answer')).toHaveCount(2); expect(paid).toBe(2);
        await page.reload();
        await page.getByRole('link', { name: 'Agent Dola', exact: true }).filter({ visible: true }).click();
        await expect(dock.getByRole('button', { name: 'Continue last chat' })).toBeVisible();
        await expect(dock.locator('.dola-answer')).toHaveCount(0);
        await page.screenshot({ path: path.join(output, `${name}-resume.png`), fullPage: true });
        await dock.getByRole('button', { name: 'Continue last chat' }).click(); await expect(dock.locator('.dola-answer')).toHaveCount(2);
        expect(paid).toBe(2);
        await page.clock.fastForward(46 * 60000);
        await expect(dock.locator('.dola-answer')).toHaveCount(0); await expect(dock.getByRole('alert')).toContainText('expired');
        expect(await page.evaluate(() => Object.values(localStorage).some(value => value.includes('When is the next match for my squads in Dinamo Academy?')))).toBe(false);
        expect(errors).toEqual([]); evidence.push({ name, streaming: true, navigationPreserved: true, closedWhileStreaming: true, refreshRecovery: true, expiredAfter45Minutes: true, paidRequests: paid, errors });
        await page.close();
    }
    await writeFile(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2)); console.log(JSON.stringify(evidence));
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); await new Promise(resolve => vite.httpServer.close(resolve)); }
