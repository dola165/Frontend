import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

// All account/API data is synthetic. Every non-local HTTP request and WebSocket is blocked.
const origin = 'http://127.0.0.1:5314';
const evidence = process.env.GK_ACCOUNT_QA_DIR;
const server = await createServer({ server: { host: '127.0.0.1', port: 5314, strictPort: true }, define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/api'), 'import.meta.env.VITE_ACCOUNT_SECURITY_EXTENSIONS': JSON.stringify('false') } });
await server.listen();
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const user = { id: 7, username: 'synthetic', fullName: 'Synthetic Person', email: 'synthetic@example.test', role: 'FAN', dob: '1990-01-01', profileComplete: true, onboardingRequired: false, emailVerified: true };
const account = { ...user, displayName: user.fullName, passwordLoginEnabled: true, linkedAccounts: [], sessionsSupported: true, sessionRevocationSupported: true, accountDeletionSupported: false };
const token = 'synthetic.' + Buffer.from(JSON.stringify({ sub: '7', role: 'FAN', exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url') + '.signature';
const consequences = ['Every device is signed out and your profile is hidden from everyone at once: people see a closed account in clubs, lists and chats, and you get no notifications.', 'You have 30 days to change your mind: sign in again and choose Keep my account, and everything comes back as it was.', 'After 30 days the account is erased by itself: email, phone, password, linked sign-ins, profile name, bio and profile image links go and it can never sign in again. Uploaded files are not promised to be erased.', 'Club and organization work, sessions, attendance, results, messages, posts, transactions and safety/audit history remain where shared. They may still contain your name or other information. Closure does not cancel commitments or erase other people\'s records.'];
try {
    if (evidence) await mkdir(evidence, { recursive: true });
    for (const [name, viewport, colorScheme, complete = true] of [['desktop-light', { width: 1920, height: 1080 }, 'light'], ['phone-dark', { width: 390, height: 844 }, 'dark'], ['desktop-dark', { width: 1920, height: 1080 }, 'dark'], ['phone-light', { width: 390, height: 844 }, 'light'], ['skipped-setup', { width: 390, height: 844 }, 'light', false]]) {
        const context = await browser.newContext({ viewport, colorScheme });
        await context.routeWebSocket('**/*', ws => ws.close());
        let closed = false, loggedIn = false, closes = 0, blockers = [], cancelled = false, cancels = 0, freshReview = false;
        const booking = { id: 71, venueId: 22, venueName: 'Synthetic community stadium', pitchId: 9, pitchName: 'Main pitch',
            startsAt: new Date(Date.now()+86400000*20).toISOString(), endsAt: new Date(Date.now()+86400000*20+3600000).toISOString(),
            cancellationDeadline: new Date(Date.now()+86400000*19).toISOString(), timezone: 'Asia/Tbilisi', status: 'CONFIRMED', kind: 'RENTAL',
            totalPrice: 100, currency: 'GEL', contactName: user.fullName, contactPhone: '', note: '', expiresAt: null, seriesId: null, canCancel: true };
        const forbidden = []; const currentUser = { ...user, profileComplete: complete, onboardingRequired: !complete };
        await context.route('**/*', async route => {
            const url = new URL(route.request().url());
            if (url.origin !== origin) { forbidden.push(url.origin); return route.abort(); }
            if (!url.pathname.startsWith('/api/')) return route.continue();
            const path = url.pathname.slice(4), method = route.request().method();
            let data = [];
            if (path === '/auth/csrf') data = { headerName: 'X-CSRF-TOKEN', token: 'synthetic' };
            // Signing in again within the 30 days offers Keep my account; keeping it signs in as before.
            else if (path === '/auth/login' && closed && !route.request().postDataJSON().keepAccount) return route.fulfill({ status: 409, json: { code: 'ACCOUNT_CLOSING', detail: 'You closed this account.', keepUntil: '2026-11-29T00:00:00Z' } });
            else if (path === '/auth/login') { loggedIn = true; closed = false; data = { accessToken: token }; }
            else if (path === '/auth/refresh') { if (!loggedIn) return route.fulfill({ status: 401, json: { detail: 'No session' } }); data = { accessToken: token }; }
            else if (path === '/users/me') data = currentUser;
            else if (path === '/users/me/account') data = account;
            else if (path === '/auth/sessions') data = { sessions: [], activeCount: 1, revokedCount: 0, expiredCount: 0 };
            else if (path === '/auth/account-closure' && method === 'GET') { if (cancelled) freshReview = true; data = { accountId: 7, version: (cancelled ? 'b' : 'a').repeat(64), passwordRequired: true, blockers, consequences }; }
            else if (path === '/venues/bookings/mine/history') data = { content: [{ ...booking, status: cancelled ? 'CANCELLED' : 'CONFIRMED', canCancel: !cancelled }], pageCursor: 'synthetic-page', nextCursor: null };
            else if (path === '/auth/account-closure/cancel-booking' && method === 'POST') { expect(route.request().postDataJSON()).toEqual({ venueId: 22, bookingId: 71 }); cancels++; cancelled = true; blockers = []; data = { ...booking, status: 'CANCELLED', canCancel: false }; }
            else if (path === '/auth/account-closure' && method === 'POST') { const body = route.request().postDataJSON(); expect(cancelled && freshReview).toBe(true); expect(body.version).toBe('b'.repeat(64)); closes++; closed = true; data = { accountId: 7, requestId: body.requestId, outcome: 'CLOSED', closedAt: '2026-10-30T00:00:00Z', keepUntil: '2026-11-29T00:00:00Z' }; }
            else if (path === '/auth/logout') data = { message: 'Signed out' };
            if (closed && path === '/users/me') return route.fulfill({ status: 401, json: { detail: 'Session ended' } });
            return route.fulfill({ json: data });
        });
        const page = await context.newPage();
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(theme => { localStorage.setItem('i18nextLng', 'en'); localStorage.setItem('theme-preference', theme); localStorage.setItem('theme-chosen', '1'); }, colorScheme);
        if (name === 'desktop-light') {
            await page.goto(`${origin}/account/bookings?booking=71&returnTo=closure`);
            await expect(page).toHaveURL(/\/login\?next=/);
            await expect(page.getByRole('heading', { name: 'Your reservations', exact: true })).toHaveCount(0);
        }
        await page.goto(`${origin}/login?next=%2Faccount%3Ftab%3Ddanger`);
        await page.locator('#auth-login-email').fill(user.email);
        await page.locator('#auth-login-password').fill('Synthetic-password-1!');
        await page.locator('button[type=submit]').click();
        if (!complete) await page.getByRole('button', { name: 'Review account closure', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Close account', exact: true })).toBeVisible();
        await expect(page.getByLabel('Current password', { exact: true })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        if (complete) await expect.poll(() => page.evaluate(() => { const active = document.querySelector('.entity-tabs [aria-pressed=true]')?.getBoundingClientRect(); const indicator = document.querySelector('.entity-tabs .app-selection-indicator')?.getBoundingClientRect(); return active && indicator ? Math.abs(active.left-indicator.left) : 999; })).toBeLessThan(2);
        if (name === 'desktop-light') {
            await page.getByText('Quick Actions', { exact: true }).click();
            await page.getByRole('link', { name: 'Your reservations', exact: true }).click();
            await expect(page).toHaveURL(/\/account\/bookings$/);
            await expect(page.getByText('Booking #71', { exact: true })).toHaveCount(1);
            await page.getByRole('link', { name: 'Account Settings', exact: true }).click();
            await page.goto(`${origin}/account?tab=danger`);
            await expect(page.getByLabel('Current password', { exact: true })).toBeVisible();
        }
        if (evidence && complete) await page.screenshot({ path: `${evidence}/${name}.png`, fullPage: true });
        blockers = [{ code: 'CLUB_OWNER', name: 'Synthetic community club with a deliberately long name for layout checks', recoveryPath: '/clubs/5/office?tab=settings', action: 'Hand over the club, or close it through Club office before leaving.' }];
        await page.getByRole('button', { name: 'Review again', exact: true }).click();
        await expect(page.getByRole('link', { name: 'Review responsibility', exact: true })).toHaveAttribute('href', '/clubs/5/office?tab=settings');
        await expect(page.getByLabel('Current password', { exact: true })).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        blockers = [{ code: 'VENUE_BOOKING', name: 'Booking #71', recoveryPath: '/account/bookings?booking=71&returnTo=closure', action: 'Cancel or finish this booking before closing your account.' }];
        await page.getByRole('button', { name: 'Review again', exact: true }).click();
        await page.getByRole('link', { name: 'Review responsibility', exact: true }).click();
        await expect(page).toHaveURL(/\/account\/bookings\?booking=71&returnTo=closure$/);
        await expect(page.getByRole('heading', { name: 'Your reservations', exact: true })).toBeVisible();
        await expect(page.getByLabel('Booking #71', { exact: true })).toBeFocused();
        await expect(page.getByText('Booking #71', { exact: true })).toHaveCount(1);
        await page.getByRole('button', { name: 'Cancel reservation', exact: true }).click();
        expect(cancels).toBe(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        if (evidence && complete) await page.screenshot({ path: `${evidence}/${name}-booking.png`, fullPage: true });
        await page.getByRole('button', { name: 'Yes, cancel', exact: true }).click();
        await expect(page.getByText('cancelled', { exact: true })).toBeVisible();
        await page.getByRole('link', { name: 'Review account closure again', exact: true }).click();
        await expect(page).toHaveURL(complete ? /\/account\?tab=danger$/ : /\/onboarding\?accountClosure=review$/);
        await expect(page.getByRole('heading', { name: 'Close account', exact: true })).toBeVisible();
        await page.getByLabel('Current password', { exact: true }).fill('Synthetic-password-1!');
        expect(freshReview).toBe(true);
        await page.keyboard.press('Tab');
        await expect(page.getByRole('checkbox', { name: /I reviewed what happens/ })).toBeFocused();
        await page.keyboard.press('Space');
        await page.keyboard.press('Tab');
        await expect(page.getByRole('button', { name: 'Close account', exact: true })).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL(/\/login$/);
        await expect(page.getByText('Your account is closed.', { exact: true })).toBeVisible();
        await expect(page.getByText(/Sign in before 29 November 2026 and choose Keep my account/)).toBeVisible();
        expect(closes).toBe(1);
        if (evidence && complete) await page.screenshot({ path: `${evidence}/${name}-receipt.png`, fullPage: true });
        expect(await page.evaluate(() => localStorage.getItem('gk-signed-in-session'))).toBeNull();
        expect(errors).toEqual([]);
        expect(cancels).toBe(1);
        // Changed their mind: the same sign-in offers Keep my account with the date, and keeping signs in.
        await page.locator('#auth-login-email').fill(user.email);
        await page.locator('#auth-login-password').fill('Synthetic-password-1!');
        await page.locator('button[type=submit]').click();
        await expect(page.getByText('You closed this account', { exact: true })).toBeVisible();
        await expect(page.getByText(/otherwise it is erased on 29 November 2026/)).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        if (evidence && complete) await page.screenshot({ path: `${evidence}/${name}-keep.png`, fullPage: true });
        await page.getByRole('button', { name: 'Keep my account', exact: true }).click();
        await expect(page).not.toHaveURL(/\/login/);
        console.log(JSON.stringify({ journey: name, receipt: true, closes, cancels, freshReview, overflow: false, blockedExternalOrigins: [...new Set(forbidden)] }));
        await context.close();
    }
} finally { await browser.close(); await server.close(); }
