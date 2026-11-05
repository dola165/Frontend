import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

// Runtime only. Invoked by CalendarBookingAuthorityIntegrationTest under MAIN's exclusive lease.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const req = createRequire(path.join(root, 'package.json'));
const { createServer } = await import(pathToFileURL(req.resolve('vite')).href);
const tailwind = (await import(pathToFileURL(req.resolve('@tailwindcss/vite')).href)).default;
const { chromium } = req('@playwright/test');
const fixture = JSON.parse(await fs.readFile(process.argv[2], 'utf8'));
assert.match(fixture.backend, /^http:\/\/127\.0\.0\.1:\d+$/);
assert.ok(['current', 'changed'].includes(fixture.phase));
const evidence = path.resolve(process.argv[3]); await fs.mkdir(evidence, { recursive: true });
let server, browser;
const results = [];
try {
    server = await createServer({ root, configFile: false, envDir: false, plugins: [tailwind()], esbuild: { jsx: 'automatic' },
        define: { __BUILD_ID__: '""' }, optimizeDeps: { entries: ['e2e/calendar-booking-authority/index.html'] },
        server: { host: '127.0.0.1', port: 0, proxy: { '/api': { target: fixture.backend, changeOrigin: true } } } });
    await server.listen(); const address = server.httpServer.address();
    assert.ok(address && typeof address !== 'string');
    const origin = `http://127.0.0.1:${address.port}`;
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    for (const item of fixture.cases) {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Tbilisi' });
        const page = await context.newPage(), reads = [], errors = [];
        page.setDefaultTimeout(12000);
        page.on('pageerror', e => errors.push(e.message));
        page.on('response', response => {
            const u = new URL(response.url());
            if (u.origin === origin && u.pathname.startsWith('/api/')) reads.push({ path: u.pathname, status: response.status(), method: response.request().method() });
        });
        // Block external egress. API requests are CONTINUED to the actual loopback Spring/PG backend.
        await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
        const destination = `/stadiums/${item.venueId}?bookingId=${item.bookingId}&squadId=${item.squadId}&sessionId=${item.sessionId}`;
        await page.addInitScript(value => { window.__cg2 = value; }, { actor: item.actor, token: item.token, path: destination });
        await page.goto(origin + '/e2e/calendar-booking-authority/index.html');
        if (item.allowed) {
            await page.getByRole('heading', { name: new RegExp(`Reservation #${item.bookingId} ·`) }).waitFor();
            await page.getByText('CONFIRMED · CG2 pitch').waitFor();
            assert.equal(await page.getByText(/payment confirmed|paid successfully/i).count(), 0);
        } else {
            await page.getByRole('alert').filter({ hasText: /unavailable or you no longer have access/ }).waitFor();
            assert.equal(await page.getByText('CONFIRMED · CG2 pitch').count(), 0);
        }
        const bookingRead = reads.find(r => r.path === `/api/venues/${item.venueId}/bookings/${item.bookingId}`);
        assert.ok(bookingRead, item.name + ': actual booking GET was required');
        assert.equal(bookingRead.status, item.allowed ? 200 : 404, item.name);
        assert.equal(reads.some(r => r.path === `/api/venues/${item.venueId}` || r.path.includes('/manage')), false);
        await page.screenshot({ path: path.join(evidence, `${fixture.phase}-${item.name}-reader.png`), fullPage: true });
        if (results.length % 2) await page.getByRole('button', { name: 'Close details' }).click();
        else await page.getByRole('link', { name: 'Back to squad event' }).click();
        await page.waitForURL(new RegExp(`/squads/${item.squadId}\\?tab=sessions&sessionId=${item.sessionId}$`));
        if (item.originAllowed) await page.getByRole('dialog', { name: 'CG2 actual origin' }).waitFor();
        else await page.getByRole('alert').filter({ hasText: /Origin unavailable/ }).waitFor();
        assert.equal(errors.length, 0, item.name + ': browser errors');
        assert.equal(reads.some(r => r.method !== 'GET'), false, item.name + ': read/return must not mutate');
        results.push({ name: item.name, allowed: item.allowed, originAllowed: item.originAllowed, reads, errors });
        await context.close();
    }
    await fs.writeFile(path.join(evidence, `browser-${fixture.phase}.json`), JSON.stringify(results, null, 2));
    console.log(`CG2 ${fixture.phase}: ${results.length} actual reader/return cases passed (no tokens logged).`);
} finally {
    await fs.writeFile(path.join(evidence, `browser-${fixture.phase}-partial.json`), JSON.stringify({
        phase: fixture.phase, completed: results, expectedCases: fixture.cases.map(item => item.name),
        allCasesCompleted: results.length === fixture.cases.length,
    }, null, 2));
    if (browser) await browser.close(); if (server) await server.close();
}
