// Actual app/components in Chrome, with isolated synthetic API responses.
// This never talks to the running development or public backend.
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const output = 'review/meeting-expansion-20260913';
await mkdir(output, { recursive: true });
const apiOrigin = 'http://127.0.0.1:5297';
const server = await createServer({
    root: process.cwd(),
    define: {
        'import.meta.env.VITE_API_BASE_URL': JSON.stringify(`${apiOrigin}/api`),
        'import.meta.env.VITE_ENABLE_MOCKS': '"false"',
    },
    server: { host: '127.0.0.1', port: 5296, strictPort: true, hmr: false },
});
await server.listen();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const origin = 'http://127.0.0.1:5296';
const results = { backend: 'Isolated mocked API; actual web app in Chrome', steps: [], pageErrors: [], unexpectedApi: [], writes: [] };
const user = { id: 55001, username: 'meeting-parent', fullName: 'Nino Demo', role: 'FAN', dob: '1988-03-12', profileComplete: true, onboardingRequired: false, mustChangePassword: false, emailVerified: true };
const child = {
    cardId: 501, userId: 601, fullName: 'Luka Demo', birthYear: 2015, photoUrl: null, position: 'MID', registered: false,
    activationEligible: false, clubId: 10, clubName: 'Northstar FC', squadNames: ['U12'], affiliationStatus: 'ACTIVE',
    consentStatus: 'CONFIRMED', trialEndsOn: null,
    publicEvents: [{ eventId: 901, occurrenceId: '901-2026-09-16', title: 'Club open training', eventType: 'TRAINING', startsAt: '2026-09-16T17:00:00', endsAt: '2026-09-16T18:30:00', locationName: 'Northstar training ground', status: 'SCHEDULED' }],
};
const hub = { children: [child, { ...child, cardId: 502, userId: 602, fullName: 'Ana Demo', birthYear: 2012, squadNames: ['U15'], consentStatus: 'PENDING', affiliationStatus: 'TRIALIST', trialEndsOn: '2026-09-22', publicEvents: [] }], scheduleFrom: '2026-09-13T00:00:00', scheduleTo: '2026-10-13T00:00:00' };

async function mockApi(context, { authenticated = true, parentData = hub } = {}) {
    await context.route(`${apiOrigin}/api/**`, async route => {
        const req = route.request();
        const path = new URL(req.url()).pathname;
        const method = req.method();
        if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) results.writes.push({ path, method });
        if (path === '/api/auth/csrf') return route.fulfill({ json: { headerName: 'X-XSRF-TOKEN', token: 'fictional-csrf' } });
        if (path === '/api/users/me') return route.fulfill(authenticated ? { json: user } : { status: 401, json: {} });
        if (path === '/api/auth/refresh') return route.fulfill({ status: 401, json: {} });
        if (path === '/api/clubs/my-membership-context') return route.fulfill({ json: { hasClubMembership: false, canCreateClub: false } });
        if (path === '/api/notifications/unread-count') return route.fulfill({ json: { unreadCount: 0 } });
        if (path === '/api/store/products') return route.fulfill({ json: { content: [], totalElements: 0 } });
        if (path === '/api/store/locations') return route.fulfill({ json: [] });
        if (path === '/api/parents/hub') return route.fulfill({ json: parentData });
        results.unexpectedApi.push({ path, method });
        return route.fulfill({ status: 404, json: { error: 'No meeting test fixture for this request.' } });
    });
    await context.route('https://accounts.google.com/**', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
    if (authenticated) await context.addInitScript(() => {
        if (!localStorage.getItem('gk-session-id')) {
            localStorage.setItem('gk-session-id', 'meeting-browser-session');
            localStorage.setItem('gk-session-token:meeting-browser-session', 'fictional-test-token');
            localStorage.setItem('userId', '55001');
        }
        localStorage.setItem('i18nextLng', 'en');
        localStorage.setItem('theme-preference', 'dark');
    });
}

async function capture(page, name) {
    await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
    results.steps.push({ name, passed: true });
}

try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await mockApi(context);
    const page = await context.newPage();
    page.on('pageerror', error => results.pageErrors.push(error.message));
    await page.goto(`${origin}/demo/commerce`);
    // The separate fictional shop was replaced by tests in the actual cart/campaign flows.
    // The full real-data flow is covered by payment-preview-smoke.mjs.
    await expect(page).toHaveURL(origin + '/store');
    await expect(page.getByText('Test payments are on', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Store', exact: true })).toBeVisible();
    results.steps.push({ name: 'legacy-payment-bookmark-opens-actual-store', passed: true });

    await page.goto(`${origin}/parent`);
    await expect(page.getByRole('heading', { name: 'Parent Hub', exact: true })).toBeVisible();
    await expect(page.getByText('Luka Demo', { exact: true }).first()).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await capture(page, 'parent-mobile');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await capture(page, 'parent-desktop');
    await page.getByRole('button', { name: /Ana Demo/ }).click();
    await expect(page.getByRole('heading', { name: 'Consent waiting', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Club open training', exact: true })).not.toBeVisible();
    await page.getByRole('button', { name: /Luka Demo/ }).click();
    await expect(page.getByRole('heading', { name: 'Club open training', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Shortcuts', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: 'Payment demo', exact: true })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: 'Parent Hub', exact: true })).toHaveAttribute('href', '/parent');
    await page.keyboard.press('Escape');
    await context.close();

    const editorContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await editorContext.route(`${apiOrigin}/api/**`, route => {
        const request = route.request();
        if (request.method() !== 'GET') {
            results.unexpectedApi.push({ path: new URL(request.url()).pathname, method: request.method() });
            return route.fulfill({ status: 403, json: {} });
        }
        return route.fulfill({ json: [] });
    });
    const editor = await editorContext.newPage();
    editor.on('pageerror', error => results.pageErrors.push(error.message));
    await editor.goto(`${origin}/e2e/fixtures/commerce-drafts.html`);
    for (const [feature, field, start] of [
        ['Store', 'Product name', /^Add product$/],
        ['Campaigns', 'Campaign title', /^Create campaign$/],
        ['Jobs', 'Job title', /Post.*(job|opening)|New.*(job|posting)/i],
    ]) {
        await editor.getByRole('link', { name: `${feature} tab`, exact: true }).click();
        await editor.getByRole('button', { name: start }).click();
        await editor.getByLabel(field, { exact: true }).fill(`Northstar ${feature === 'Store' ? 'home shirt' : feature === 'Campaigns' ? 'away days' : 'youth coach'}`);
        await editor.setViewportSize({ width: 1440, height: 1000 });
        await capture(editor, `${feature.toLowerCase()}-editor-desktop`);
        await editor.setViewportSize({ width: 390, height: 844 });
        await capture(editor, `${feature.toLowerCase()}-editor-mobile`);
        // Draft survives leaving its tab; the new shell must preserve this behavior.
        await editor.getByRole('link', { name: 'Overview tab', exact: true }).click();
        await editor.getByRole('link', { name: `${feature} tab`, exact: true }).click();
        await expect(editor.getByLabel(field, { exact: true })).toHaveValue(/^Northstar /);
    }
    await editorContext.close();

    // Preserve the legacy bookmark authentication boundary.
    const guestContext = await browser.newContext();
    await mockApi(guestContext, { authenticated: false });
    const guest = await guestContext.newPage();
    await guest.goto(`${origin}/demo/commerce`);
    await expect(guest).toHaveURL(/\/login\?next=/);
    results.steps.push({ name: 'guest-route-protection', passed: true });
    await guestContext.close();
    expect(results.pageErrors).toEqual([]);
    expect(results.unexpectedApi).toEqual([]);
    expect(results.writes.filter(write => write.path !== '/api/auth/refresh')).toEqual([]);
    await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
} catch (error) {
    await writeFile(`${output}/results.json`, JSON.stringify({ ...results, failure: String(error) }, null, 2));
    throw error;
} finally {
    await browser.close();
    await server.close();
}
