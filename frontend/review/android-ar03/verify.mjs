import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';

const backendRoot = 'C:/Users/daddo/IdeaProjects/GrassKickZ';
const fixture = JSON.parse(await readFile(path.join(backendRoot, 'build/android-ar03-live/fixture.json'), 'utf8'));
const output = path.join(backendRoot, 'outputs/android-ar03');
await mkdir(output, { recursive: true });
const root = process.cwd();
const server = await createServer({
    root,
    configFile: path.join(root, 'vite.config.ts'),
    define: {
        'import.meta.env.VITE_API_BASE_URL': JSON.stringify(fixture.backend + '/api'),
        'import.meta.env.VITE_ENABLE_MOCKS': '"false"'
    },
    server: { host: '127.0.0.1', port: 5188, strictPort: true, hmr: false }
});
await server.listen();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = { passed: false, eventId: fixture.eventId, hostClubId: fixture.hostClubId, awayClubId: fixture.awayClubId };

async function session(email) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'dark' });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    await page.goto('http://127.0.0.1:5188/login');
    await page.locator('#auth-login-email').fill(email);
    await page.locator('#auth-login-password').fill(fixture.password);
    const response = page.waitForResponse(r => r.url().endsWith('/api/auth/login') && r.request().method() === 'POST');
    await page.locator('button[type="submit"]').click();
    const token = (await (await response).json()).accessToken;
    await expect(page.getByLabel('Create a post', { exact: true })).toBeVisible({ timeout: 60000 });
    return { context, page, headers: { Authorization: `Bearer ${token}` } };
}

try {
    const away = await session(fixture.awayEmail);
    const direct = await away.context.request.get(`${fixture.backend}/api/schedule/events/${fixture.eventId}`, { headers: away.headers });
    expect(direct.status()).toBe(200);
    expect((await direct.json()).title).toBe('Private away fixture');

    const from = `${fixture.eventDate}T00:00:00`;
    const to = `${fixture.eventDate}T23:59:59`;
    const hostCalendar = await away.context.request.get(`${fixture.backend}/api/schedule/clubs/${fixture.hostClubId}/events?from=${from}&to=${to}`, { headers: away.headers });
    const awayCalendar = await away.context.request.get(`${fixture.backend}/api/schedule/clubs/${fixture.awayClubId}/events?from=${from}&to=${to}`, { headers: away.headers });
    expect(hostCalendar.status()).toBe(200);
    const hostContainsEvent = (await hostCalendar.json()).events.some(event => event.eventId === fixture.eventId);
    expect(hostContainsEvent).toBe(false);
    expect(awayCalendar.status()).toBe(200);
    const awayContainsEvent = (await awayCalendar.json()).events.some(event => event.eventId === fixture.eventId);
    expect(awayContainsEvent).toBe(true);

    await away.page.goto(`http://127.0.0.1:5188/calendar?eventId=${fixture.eventId}`);
    await expect(away.page.getByRole('region', { name: 'Notification destination' }).getByText('Private away fixture', { exact: true })).toBeVisible();
    await away.page.screenshot({ path: path.join(output, 'web-away-direct-event.png'), fullPage: true });

    const outsider = await session(fixture.outsiderEmail);
    const denied = await outsider.context.request.get(`${fixture.backend}/api/schedule/events/${fixture.eventId}`, { headers: outsider.headers });
    expect([403, 404]).toContain(denied.status());

    Object.assign(results, {
        passed: true,
        awayDirectStatus: direct.status(),
        hostCalendarStatus: hostCalendar.status(),
        hostCalendarContainsEvent: hostContainsEvent,
        awayCalendarStatus: awayCalendar.status(),
        awayCalendarContainsEvent: awayContainsEvent,
        outsiderDirectStatus: denied.status(),
        webTarget: 'visible'
    });
    await away.context.close();
    await outsider.context.close();
} catch (error) {
    results.error = String(error);
    throw error;
} finally {
    await writeFile(path.join(output, 'web-verification.json'), JSON.stringify(results, null, 2));
    await browser.close();
    await server.close();
}
