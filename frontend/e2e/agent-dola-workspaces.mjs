import { preview } from 'vite';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const output = 'review/agent-dola-workspaces'; await mkdir(output, { recursive: true });
const vite = await preview({ build: { outDir: 'dist/agent-dola-workspaces' }, preview: { host: '127.0.0.1', port: 5196, strictPort: true } });
const browser = await chromium.launch({ channel: 'chrome', headless: true }); const evidence = [];
const cases = [
    ['parent-coach', 1440, 1000, ['family', 'coach', 'discover'], 'What needs my attention for my children?', 'dark'],
    ['referee', 1440, 1000, ['referee', 'discover'], 'What are my next accepted referee appointments?', 'light'],
    ['organisation', 1440, 1000, ['organization', 'discover'], 'What needs attention in my organisation?', 'dark'],
    ['agent', 1440, 1000, ['agent', 'discover'], 'Which clubs expressed interest in my player listings?', 'light'],
    ['mobile-referee', 390, 844, ['referee', 'discover'], 'What are my next accepted referee appointments?', 'dark'],
];
try {
    for (const [name, width, height, contexts, starter, theme] of cases) {
        const page = await browser.newPage({ viewport: { width, height } }); const errors = []; let questions = 0, confirmations = 0, activeContexts = contexts;
        page.on('pageerror', e => errors.push(e.message));
        await page.addInitScript(theme => {
            localStorage.setItem('gk-session-id', 'workspace-test');
            localStorage.setItem('gk-session-token:workspace-test', `e30.${btoa(JSON.stringify({ sub: '999999', exp: 4102444800 }))}.synthetic`);
            localStorage.setItem('i18nextLng', 'en'); localStorage.setItem('theme-preference', theme);
        }, theme);
        await page.routeWebSocket('**', s => s.close());
        let action;
        await page.route('**/api/**', async route => {
            const path = new URL(route.request().url()).pathname; let json = [];
            if (path.endsWith('/users/me')) json = { id: 999999, username: 'synthetic', fullName: 'Workspace Tester', role: 'REFEREE', dob: '1990-01-01', emailVerified: true, profileComplete: true, onboardingRequired: false, navigationCapabilities: { version: 1, workspaces: [] } };
            else if (path.endsWith('/auth/csrf')) json = { headerName: 'X-XSRF-TOKEN', token: 'synthetic' };
            else if (path.endsWith('/assistant/dola/status')) json = { available: true, mode: 'REVIEWED_ACTIONS_PILOT', capabilities: [] };
            else if (path.endsWith('/assistant/dola/welcome')) json = { contexts: activeContexts };
            else if (path.endsWith('/assistant/dola/conversations/latest')) return route.fulfill({ status: 204 });
            else if (path.endsWith('/assistant/dola/messages/stream')) {
                questions++; const request = route.request().postDataJSON();
                expect(request.workspaceContext).toBe('referee');
                action = { id: '68173ac8-86a7-418a-a496-1e3c98b37e55', kind: 'REFEREE_DECISION', state: 'PENDING', title: 'Academy friendly', body: 'Your referee appointment', details: [{ label: 'Starts', value: '2026-09-26T15:00' }, { label: 'Timezone', value: 'Asia/Tbilisi' }, { label: 'Decision', value: 'ACCEPT' }, { label: 'Terms', value: '35 GEL' }, { label: 'Effect', value: 'Accepts your appointment after rechecking availability and schedule conflicts. Venue arrangements remain separate.' }], confirmLabel: 'Accept referee appointment', expiresAt: new Date(Date.now() + 600000).toISOString(), receipt: '', destination: { id: 'referees', title: 'Referee workspace', path: '/referees/me' } };
                const answer = { conversationId: 'f54a54bd-bd7c-48eb-a248-f3874ba0a2b1', requestId: request.requestId, answer: 'Review this invitation before accepting.', actions: [action], destinations: [], sources: [], toolsUsed: ['read_referee_workspace', 'prepare_referee_decision'], modelCalls: 3, totalTokens: 100 };
                return route.fulfill({ contentType: 'application/x-ndjson', body: [{ type: 'ready' }, { type: 'complete', answer }].map(x => JSON.stringify(x)).join('\n') + '\n' });
            } else if (path.endsWith('/confirm')) { confirmations++; json = { ...action, state: 'COMPLETED', receipt: 'Your referee appointment is now accepted.' }; }
            else if (path.includes('membership-context')) json = { hasClubMembership: false, canCreateClub: false };
            else if (path.includes('unread')) json = { count: 0, unreadCount: 0 };
            else if (path.includes('/feed') || path.includes('notifications')) json = { content: [], totalElements: 0, last: true };
            await route.fulfill({ json });
        });
        await page.goto('http://127.0.0.1:5196/assistant');
        await expect(page.getByRole('button', { name: starter })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Help me write a coach update.' })).toHaveCount(0);
        await page.getByRole('button', { name: starter }).click(); expect(questions).toBe(0);
        await expect(page.getByLabel('Message Agent Dola')).toHaveValue(starter);
        if (name === 'parent-coach') {
            await page.getByRole('combobox', { name: 'Dola context' }).selectOption('coach');
            await expect(page.getByRole('button', { name: 'Help me write a coach update.' })).toBeVisible();
            await page.getByRole('combobox', { name: 'Dola context' }).selectOption('family');
        }
        if (name === 'referee' || name === 'mobile-referee') {
            await page.getByLabel('Message Agent Dola').fill('Accept the Academy friendly invitation');
            await page.getByRole('button', { name: 'Send message' }).click();
            await expect(page.getByRole('button', { name: 'Accept referee appointment' })).toBeVisible();
            expect(confirmations).toBe(0);
            await page.getByRole('button', { name: 'Accept referee appointment' }).click();
            await expect(page.getByText('Your referee appointment is now accepted.')).toBeVisible(); expect(confirmations).toBe(1);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
        await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
        expect(errors).toEqual([]); evidence.push({ name, correctStarters: true, noSpendOnOpen: true, noOverflow: true, reviewedDecision: confirmations === 1, errors });
        await page.close();
    }
    await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2)); console.log(JSON.stringify(evidence));
} finally { await browser.close(); await new Promise(resolve => vite.httpServer.close(resolve)); }
