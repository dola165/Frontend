import { test, expect, type Page } from '@playwright/test';

const refresh = (page: Page) => page.evaluate(async () => {
    const modulePath = '/src/api/axiosConfig.ts';
    const api = await import(modulePath);
    return api.refreshAccessToken();
});

for (const withLocks of [true, false]) {
    test(`two tabs keep their session with browser locks ${withLocks ? 'enabled' : 'unavailable'}`, async ({ context }) => {
        if (!withLocks) {
            await context.addInitScript(() => Object.defineProperty(navigator, 'locks', { value: undefined }));
        }
        await context.route('**/refresh-test', route => route.fulfill({
            contentType: 'text/html', body: '<!doctype html><title>Refresh concurrency fixture</title>',
        }));
        await context.route('**/api/auth/csrf', route => route.fulfill({ json: {} }));
        await context.addCookies([{ name: 'refresh-test', value: 'original',
            url: 'http://127.0.0.1:5175', httpOnly: true }]);
        let requests = 0;
        let originalConsumed = false;
        let conflicts = 0;
        await context.route('**/api/auth/refresh', async route => {
            requests++;
            const cookie = route.request().headers().cookie ?? '';
            if (cookie.includes('refresh-test=original') && originalConsumed) {
                conflicts++;
                await route.fulfill({ status: 409, json: { code: 'REFRESH_ALREADY_ROTATED' } });
                return;
            }
            originalConsumed = true;
            // Hold the winning response so the other tab must coordinate or handle 409.
            await new Promise(resolve => setTimeout(resolve, 300));
            await route.fulfill({ json: { accessToken: 'fresh-access-token' },
                headers: { 'Set-Cookie': 'refresh-test=successor; Path=/; HttpOnly; SameSite=Lax' } });
        });
        const tabs = await Promise.all([context.newPage(), context.newPage()]);
        await Promise.all(tabs.map(tab => tab.goto('/refresh-test')));

        expect(await Promise.all(tabs.map(refresh))).toEqual(['fresh-access-token', 'fresh-access-token']);
        expect(requests).toBe(withLocks ? 1 : 3);
        expect(conflicts).toBe(withLocks ? 0 : 1);
        expect((await context.cookies()).find(cookie => cookie.name === 'refresh-test')?.value).toBe('successor');
        expect(await tabs[1].evaluate(() => localStorage.getItem('accessToken'))).toBe('fresh-access-token');
    });
}
