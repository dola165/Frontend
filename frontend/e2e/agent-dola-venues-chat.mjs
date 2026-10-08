import { preview } from 'vite';
import { createServer } from 'node:https';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('review/agent-dola-jev'); await mkdir(output, { recursive: true });
const vite = await preview({ build: { outDir: process.env.DOLA_BUILD_DIRECTORY || 'dist/agent-dola-jev' }, preview: { host: '127.0.0.1', port: 5197, strictPort: true } });
let latest = null, paid = 0, confirmations = 0;
const server = createServer({ key: await readFile('C:/Users/daddo/IdeaProjects/GrassKickZ/outputs/agent-dola-venues-20260921/stream-test.key'), cert: await readFile('C:/Users/daddo/IdeaProjects/GrassKickZ/outputs/agent-dola-venues-20260921/stream-test.crt') }, async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:5197'); res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'authorization,content-type,x-xsrf-token');
    if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
    let body = ''; for await (const chunk of req) body += chunk;
    const request = JSON.parse(body); paid++;
    expect(request.includePersonalContext).toBe(false);
    res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' });
    res.write(JSON.stringify({ type: 'ready' }) + '\n');
    const words = ['Here is ', 'your coach update. ', 'Review it below ', 'before publishing.'];
    const review = { id: paid === 1 ? '68173ac8-86a7-418a-a496-1e3c98b37e55' : '18173ac8-86a7-418a-a496-1e3c98b37e55', kind: 'COACH_UPDATE', state: 'PENDING', title: 'Training cancelled', body: paid === 1 ? 'Hello everyone, today’s U12 Mixed training is cancelled because of the rain. Please acknowledge this update so we know you have seen it. Thank you.' : 'U12 Mixed training is cancelled today due to rain. Please acknowledge this update.', details: [{ label: 'Squad', value: 'FC Dinamo Tbilisi Academy · U12 Mixed' }, { label: 'Audience', value: 'Whole squad: current parents, players and coaching staff.' }, { label: 'Acknowledgement', value: 'Ask every other current squad member to acknowledge' }, { label: 'Effect', value: 'Publishes an update and triggers squad notifications. It does not change or cancel a scheduled session.' }], confirmLabel: 'Publish coach update', expiresAt: new Date(Date.now()+600000).toISOString(), receipt: '', destination: { id: 'squad_updates:12', title: 'Coach updates', path: '/squads/12' } };
    const answer = { conversationId: 'f54a54bd-bd7c-48eb-a248-f3874ba0a2b1', requestId: request.requestId, answer: words.join(''), destinations: [], sources: [], toolsUsed: ['prepare_coach_update'], modelCalls: 2, totalTokens: 80, actions: [review] };
    if (latest) for (const turn of latest.turns) for (const action of turn.result.actions || []) if (action.state === 'PENDING') action.state = 'SUPERSEDED';
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
        latest = null; paid = 0; confirmations = 0;
        const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width, height } }); const errors = [];
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
            if (url.pathname.endsWith('/assistant/dola/messages/stream')) return route.continue({ url: 'https://127.0.0.1:5199/stream' });
            if (url.pathname.endsWith('/users/me')) json = { id: 999999, username: 'synthetic', fullName: 'Demo Coach', role: 'COACH', dob: '1990-01-01', emailVerified: true, profileComplete: true, onboardingRequired: false, mustChangePassword: false, navigationCapabilities: { version: 1, workspaces: [] } };
            else if (url.pathname.endsWith('/auth/csrf')) json = { headerName: 'X-XSRF-TOKEN', token: 'synthetic' };
            else if (url.pathname.endsWith('/assistant/dola/status')) json = { name: 'Agent Dola', available: true, mode: 'READ_ONLY_PILOT', maxMessageLength: 2000, capabilities: [] };
            else if (url.pathname.endsWith('/assistant/dola/conversations/latest')) return latest ? route.fulfill({ json: latest }) : route.fulfill({ status: 204 });
            else if (url.pathname.includes('/actions/') && url.pathname.endsWith('/confirm')) {
                const id = url.pathname.split('/').at(-2); let action;
                for (const turn of latest.turns) for (const candidate of turn.result.actions || []) if (candidate.id === id) action = candidate;
                expect(action.state).toBe('PENDING'); confirmations++; action.state = 'COMPLETED'; action.receipt = 'Coach update published (42). Acknowledgements requested.';
                return route.fulfill({ json: action });
            }
            else if (route.request().method() === 'DELETE') { latest = null; return route.fulfill({ status: 204 }); }
            else if (url.pathname.endsWith('/squad-communication/12')) json = { id: 12, club_id: 7, academy_name: 'Dinamo Academy', name: 'U12 Mixed', category: 'U12', can_manage: true, can_assign_coach: false, coaches: [], players: [], threads: [], available_coaches: [], member_count: 0, notify_chat: true };
            else if (url.pathname.endsWith('/schedule')) json = { events: [] };
            else if (url.pathname.includes('membership-context')) json = { hasClubMembership: false, canCreateClub: false };
            else if (url.pathname.includes('unread')) json = { count: 0, unreadCount: 0 };
            else if (url.pathname.includes('/feed') || url.pathname.includes('notifications')) json = { content: [], totalElements: 0, last: true, unreadCount: 0 };
            await route.fulfill({ json });
        });
        await page.goto('http://127.0.0.1:5197/assistant');
        await page.getByLabel('Message Agent Dola').fill('Write a coach update for U12 Mixed: rain cancelled training. Ask everyone to acknowledge.');
        await page.getByRole('button', { name: 'Send message' }).click();
        await expect(page.locator('.dola-answer > p')).toContainText('Here is');
        await expect(page.getByRole('button', { name: 'Publish coach update' })).toBeVisible();
        expect(confirmations).toBe(0); expect(paid).toBe(1);
        await page.locator('.dola-action').scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(output, `${name}-review.png`), fullPage: true });
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
        await page.getByRole('button', { name: 'Revise wording' }).click();
        await page.getByLabel('Message Agent Dola').fill('Make it shorter and keep the acknowledgement request.');
        await page.getByRole('button', { name: 'Send message' }).click();
        await expect(page.getByText('Replaced by a newer review')).toHaveCount(1);
        await expect(page.getByRole('button', { name: 'Publish coach update' })).toHaveCount(1);
        expect(confirmations).toBe(0); expect(paid).toBe(2);
        await page.reload(); await page.getByRole('button', { name: 'Continue last chat' }).click();
        await page.getByRole('button', { name: 'Publish coach update' }).click();
        await expect(page.getByText('Coach update published (42). Acknowledgements requested.')).toBeVisible();
        expect(confirmations).toBe(1); expect(paid).toBe(2);
        await expect(page.getByRole('button', { name: 'Publish coach update' })).toHaveCount(0);
        await page.getByRole('link', { name: 'View in workspace' }).click();
        await expect(page).toHaveURL(/\/squads\/12$/);
        const dock=page.getByRole('dialog', { name: 'Agent Dola sidebar' });
        await expect(dock).toBeVisible(); await expect(dock.getByText('Coach update published (42). Acknowledgements requested.')).toBeVisible();
        await page.screenshot({ path: path.join(output, `${name}-completed-dock.png`), fullPage: true });
        await dock.getByRole('button', { name: 'Close chat' }).click();
        await page.getByRole('link', { name: 'Agent Dola', exact: true }).filter({ visible: true }).click();
        await dock.getByRole('button', { name: 'Continue last chat' }).click();
        await expect(dock.getByText('Coach update published (42). Acknowledgements requested.')).toBeVisible();
        expect(confirmations).toBe(1); expect(paid).toBe(2);
        expect(errors).toEqual([]);
        evidence.push({ name, streaming: true, previewDidNotExecute: true, revisedDraft: true, reviewSurvivesRefresh: true, confirmedOnce: true, navigationPreserved: true, confirmationSurvivesClose: true, errors });
        await page.close();
    }
    await writeFile(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2)); console.log(JSON.stringify(evidence));
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); await new Promise(resolve => vite.httpServer.close(resolve)); }
