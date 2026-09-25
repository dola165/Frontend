import { preview } from 'vite';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Actual application shell, synthetic API only. Never calls DeepSeek or a real user database.
const root = process.cwd();
const output = path.resolve(root, 'review/agent-dola');
await mkdir(output, { recursive: true });
const server = await preview({ root, preview: { host: '127.0.0.1', port: 5197, strictPort: true } });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const evidence = [];
try {
    for (const [name, width, height, theme] of [['desktop', 1440, 1000, 'light'], ['desktop-dark', 1440, 1000, 'dark'], ['mobile', 390, 844, 'light']]) {
        const page = await browser.newPage({ viewport: { width, height } });
        const errors = []; let paidRequests = 0;
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') console.log('Browser:', message.text().slice(0, 400)); });
        page.on('requestfailed', request => console.log('Failed:', request.url(), request.failure()?.errorText));
        await page.addInitScript(({ theme }) => {
            localStorage.setItem('gk-session-id', 'dola-visual-session');
            localStorage.setItem('gk-session-token:dola-visual-session', `e30.${btoa(JSON.stringify({ sub: '999999', exp: 4102444800 }))}.synthetic`);
            localStorage.setItem('theme-preference', theme); localStorage.setItem('i18nextLng', 'en');
        }, { theme });
        await page.routeWebSocket('**', socket => socket.close());
        await page.route('**/api/**', async route => {
            const url = new URL(route.request().url());
            let json = {};
            if (url.pathname.endsWith('/auth/csrf')) json = { headerName: 'X-XSRF-TOKEN', token: 'synthetic' };
            else if (url.pathname.endsWith('/users/me')) json = { id: 999999, username: 'synthetic', fullName: 'Demo Coach', role: 'COACH', dob: '1990-01-01', emailVerified: true, profileComplete: true, onboardingRequired: false, mustChangePassword: false, navigationCapabilities: { version: 1, workspaces: [{ id: 'club.workspace', context: { type: 'club', id: 21, label: 'Demo Academy' } }, ...Array.from({ length: 13 }, (_, i) => ({ id: 'squad.workspace', context: { type: 'squad', id: i + 1, label: `Squad ${i + 1}` } }))] } };
            else if (url.pathname.endsWith('/users/search')) json = { content: url.searchParams.get('query') === 'Giorgi' ? [{ id: 45, fullName: 'Giorgi Beridze', username: 'giorgi' }] : [] };
            else if (url.pathname.includes('/feed')) json = { content: [], totalElements: 0, last: true };
            else if (url.pathname.endsWith('/clubs/my-membership-context')) json = { hasClubMembership: false, canCreateClub: false };
            else if (url.pathname.endsWith('/assistant/dola/status')) json = { name: 'Agent Dola', available: true, mode: 'READ_ONLY_PILOT', maxMessageLength: 2000, capabilities: [] };
            else if (url.pathname.endsWith('/assistant/dola/messages')) {
                paidRequests++;
                const request = route.request().postDataJSON();
                expect(request.includePersonalContext).toBe(false);
                json = { conversationId: 'f54a54bd-bd7c-48eb-a248-f3874ba0a2b1', requestId: request.requestId, answer: 'Open Parent Hub and select your child to find their academy and squad. Training sessions and coach updates live in the squad space.\n\nI haven’t read your child’s records or changed anything.', destinations: [{ id: 'parent_hub', title: 'Open Parent Hub', path: '/parent' }], sources: [{ id: 'family', title: 'Parent Hub and children', text: 'A parent profile alone does not grant access. A current guardian link establishes the family context. Agent Dola offers navigation, not child-record access.', reviewedAt: '2026-09-20' }], toolsUsed: ['offer_destination'], modelCalls: 2, totalTokens: 120 };
            } else if (route.request().method() === 'DELETE') return route.fulfill({ status: 204 });
            else if (url.pathname.includes('unread')) json = { count: 0, unreadCount: 0 };
            else if (url.pathname.includes('notifications')) json = { content: [], totalElements: 0, unreadCount: 0 };
            else json = [];
            await route.fulfill({ json });
        });
        await page.goto('http://127.0.0.1:5197/assistant');
        try { await expect(page.getByRole('heading', { name: 'What can I help you find?' })).toBeVisible({ timeout: 15000 }); }
        catch (error) { await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }); console.log(JSON.stringify({url:page.url(), errors, body: (await page.locator('body').innerText()).slice(0,2500)})); throw error; }
        expect(paidRequests).toBe(0);
        await page.screenshot({ path: path.join(output, `${name}-welcome.png`), fullPage: true });
        await page.getByRole('button', { name: 'Where can I find my child’s training?' }).click();
        expect(paidRequests).toBe(0);
        await page.getByRole('button', { name: 'Send message' }).click();
        await expect(page.getByRole('link', { name: 'Open Parent Hub' })).toBeVisible();
        await page.screenshot({ path: path.join(output, `${name}-answer.png`), fullPage: true });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        expect(overflow).toBe(false); expect(errors).toEqual([]); expect(paidRequests).toBe(1);
        await page.getByRole('button', { name: 'New conversation' }).click();
        await expect(page.getByRole('heading', { name: 'What can I help you find?' })).toBeVisible();
        if (width > 1000) {
            await page.goto('http://127.0.0.1:5197/home');
            await expect(page.getByRole('link', { name: 'Club workspace', exact: true })).toBeVisible();
            expect(await page.locator('.workspace-shortcut').count()).toBe(1);
            await expect(page.getByRole('link', { name: 'Ask Agent Dola', exact: true })).toBeVisible();
            await expect(page.getByRole('link', { name: 'Agent Dola', exact: true }).filter({ visible: true })).toBeVisible();
            await page.screenshot({ path: path.join(output, `${name}-home.png`), fullPage: true });
            const search = page.getByPlaceholder('Search or ask Agent Dola…').filter({ visible: true });
            await search.fill('Giorgi');
            await expect(page.getByRole('link', { name: /Giorgi Beridze/ })).toHaveAttribute('href', '/profile/45');
            expect(paidRequests).toBe(1);
            await search.fill('How do I find my club workspace?');
            await expect(page.getByRole('button', { name: /Ask Agent Dola/ })).toBeVisible();
            await page.screenshot({ path: path.join(output, `${name}-search.png`), fullPage: true });
            await search.press('Enter');
            await expect(page).toHaveURL('http://127.0.0.1:5197/assistant');
            await expect(page.getByRole('link', { name: 'Open Parent Hub' })).toBeVisible();
            expect(paidRequests).toBe(2);
            await page.reload();
            await expect(page.getByRole('heading', { name: 'What can I help you find?' })).toBeVisible();
            expect(paidRequests).toBe(2);
        }
        evidence.push({ name, width, height, overflow, errors, syntheticRequests: paidRequests });
        await page.close();
    }
    await writeFile(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence));
} finally { await browser.close(); await new Promise(resolve => server.httpServer.close(resolve)); }
