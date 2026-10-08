// Full production UI with isolated API fixtures. No developer API or external service is contacted.
import { preview } from 'vite';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('review/ui-coherence');
await mkdir(output, { recursive: true });
const server = await preview({ build: { outDir: path.join(output, 'dist') }, preview: { host: '127.0.0.1', port: 0 } });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true });
const report = { conditions: 'Production UI, synthetic accounts and API responses; external network blocked; no live mutations', checks: [], errors: [] };
const profile = { id: 9, username: 'coach_luka', fullName: 'Coach Luka', role: 'ORGANIZER', bio: 'Developing the next generation of Georgian talent.', followerCount: 21, followingCount: 1, careerHistory: [], profileComplete: true, dob: '1990-01-01' };
const club = { id: 701, name: 'FC Dinamo Tbilisi', description: 'A football home for players, families and supporters. Training together, from the academy to the first team.', type: 'PROFESSIONAL', status: 'VERIFIED', isOfficial: true, myRole: 'OWNER', memberCount: 18, followerCount: 120, city: 'Tbilisi', country: 'Georgia', publicPhone: '+995322123456', trustedByClubs: [], honours: [{ id: 1, title: 'Academy Cup', yearWon: 2025, description: 'Youth champions' }], opportunities: [] };
const posts = [
    { id: 101, authorId: 9, authorName: 'Coach Luka', authorUsername: 'coach_luka', clubId: 701, clubName: club.name, content: 'Academy parents meeting tonight at 19:00. We will cover the spring calendar, travel logistics, and nutrition workshops.', createdAt: '2026-09-10T09:00:00', likeCount: 8, commentCount: 2, mediaUrls: [], isOfficial: true },
    { id: 102, authorId: 12, authorName: 'Community coach', clubId: 702, clubName: 'Kutaisi Phoenix', content: 'Girls’ open training this Saturday. New players and families are welcome.', createdAt: '2026-09-09T09:00:00', likeCount: 4, commentCount: 0, mediaUrls: [], isOfficial: true },
];
const people = Array.from({ length: 21 }, (_, i) => ({ id: 30 + i, username: `player_${i + 1}`, fullName: `Football player ${i + 1}`, avatarUrl: null }));
const squads = [{ id: 16, clubId: 701, name: 'U16 Boys', category: 'U16', gender: 'MALE' }, { id: 17, clubId: 701, name: 'First Team', category: 'SENIOR', gender: 'MIXED' }];
const activity = (id, eventType, title, extra = {}) => ({ eventId: id, occurrenceId: `${id}@fixture`, clubId: 701, clubName: club.name, title, eventType, startsAt: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 19), endsAt: new Date(Date.now() + 86400000 * 2 + 3600000).toISOString().slice(0, 19), status: 'SCHEDULED', visibility: 'PUBLIC', publicNow: true, recurring: false, recurrence: null, conflict: false, conflictingEventIds: [], ...extra });
const activities = [activity(501, 'MATCH', 'Friendly vs Kutaisi'), activity(502, 'TRAINING', 'U16 evening training', { recurring: true, recurrence: { frequency: 'WEEKLY', intervalValue: 1, daysOfWeek: ['MONDAY', 'WEDNESDAY', 'FRIDAY'], startDate: '2026-09-01', startTime: '18:00:00', endTime: '19:00:00', timezone: 'Asia/Tbilisi' }, challengerSquadId: 16, challengerSquadName: 'U16 Boys', publicNow: false, visibility: 'PRIVATE' }), activity(503, 'TRAINING', 'First team training', { challengerSquadId: 17, challengerSquadName: 'First Team' }), activity(504, 'ACTIVITY', 'Parents meeting'), activity(505, 'TRYOUT', 'Open academy tryout')];

async function setup(width, role = 'owner', theme = 'dark') {
    const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 940 }, reducedMotion: 'reduce' });
    const state = { failFollowers: false, failFeed: false, reads: [], mutations: [] };
    await context.addInitScript(({ role, theme }) => {
        localStorage.setItem('i18nextLng', 'en');
        localStorage.setItem('theme-preference', theme);
        localStorage.setItem('tutorial.calendar.completed', 'true');
        if (role !== 'guest') {
            localStorage.setItem('accessToken', 'isolated-ui-fixture');
            localStorage.setItem('userId', role === 'owner' ? '9' : '20');
        }
    }, { role, theme });
    await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (!url.pathname.startsWith('/api/')) {
            if (url.origin !== origin || url.pathname.includes('/ws')) return route.abort();
            return route.continue();
        }
        const name = url.pathname;
        const method = route.request().method();
        state.reads.push(name + url.search);
        if (method !== 'GET' && !name.startsWith('/api/auth/')) state.mutations.push(`${method} ${name}`);
        let body = []; let status = 200;
        if (name === '/api/auth/csrf') body = { token: 'fixture', headerName: 'X-XSRF-TOKEN' };
        else if (name.startsWith('/api/auth/')) { status = 401; body = {}; }
        else if (name === '/api/users/me') body = role === 'owner' ? profile : { ...profile, id: 20, username: 'visitor', fullName: 'Football supporter', role: 'FAN' };
        else if (name === '/api/users/9') body = profile;
        else if (name === '/api/users/10') body = { ...profile, id: 10, isPrivate: true };
        else if (/\/users\/\d+\/followers$/.test(name)) {
            if (state.failFollowers) { status = 503; body = { detail: 'Connections temporarily unavailable.' }; }
            else { const page = Number(url.searchParams.get('page')); body = { content: people.slice(page * 20, (page + 1) * 20), pageNumber: page, pageSize: 20, totalElements: 21 }; }
        }
        else if (/\/users\/\d+\/following$/.test(name)) body = { content: [people[0]], pageNumber: 0, pageSize: 20, totalElements: 1 };
        else if (name === '/api/clubs/my-membership-context') body = role === 'owner' ? { hasClubMembership: true, clubId: 701, myRole: 'OWNER' } : { hasClubMembership: false };
        else if (name === '/api/clubs/701') body = { ...club, myRole: role === 'owner' ? 'OWNER' : null };
        else if (name === '/api/clubs/701/management') body = { currentUserRole: 'OWNER', members: [], pendingInvitations: [], pendingApplications: [] };
        else if (name === '/api/clubs/701/squads') body = squads;
        else if (name === '/api/schedule/clubs/701/events') body = { events: activities.filter(item => role === 'owner' || item.publicNow) };
        else if (name === '/api/clubs') body = { content: [club], totalElements: 1, totalPages: 1 };
        else if (name.startsWith('/api/posts/feed/')) {
            if (state.failFeed) { status = 503; body = {}; }
            else body = { posts, content: posts, hasMore: false };
        }
        else if (name.startsWith('/api/posts/club/') || name.startsWith('/api/posts/user/')) body = { posts };
        else if (name.includes('/conversations') || name.includes('/notifications')) body = { content: [], totalElements: 0 };
        else if (name === '/api/clubs/followed') body = [club];
        else if (name.startsWith('/api/store/products') || name === '/api/campaigns' || name === '/api/jobs') body = { content: [], totalElements: 0 };
        await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    return { context, page, state };
}

async function capture(page, name) {
    await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name} horizontal overflow`).toBe(true);
}

try {
    for (const width of [1440, 390]) {
        const { context, page, state } = await setup(width);
        await page.goto(origin + '/home');
        await expect(page.getByRole('link', { name: 'Discover', exact: true })).toBeVisible();
        await expect(page.getByText(posts[0].content, { exact: true })).toBeVisible();
        await capture(page, `home-${width}`);
        const explore = page.getByRole('button', { name: 'Explore', exact: true });
        const box = await explore.boundingBox();
        expect(width >= 1024 ? box.y >= 55 : box.y < 55).toBe(true);
        await explore.focus(); await page.keyboard.press('Enter');
        await expect(page.getByRole('menu', { name: 'Explore' })).toBeVisible();
        await page.keyboard.press('ArrowDown'); await page.keyboard.press('Escape');
        await expect(explore).toBeFocused();
        await expect(page.getByRole('menu', { name: 'Explore' })).toHaveCount(0);
        state.failFeed = true;
        await page.getByRole('button', { name: 'Refresh feed' }).click();
        await expect(page.getByText('Home could not load')).toBeVisible();
        state.failFeed = false;
        await page.getByRole('button', { name: 'Retry', exact: true }).click();
        await expect(page.getByText(posts[0].content, { exact: true })).toBeVisible();
        await page.getByRole('link', { name: 'Following', exact: true }).click();
        await expect(page.getByRole('link', { name: 'Following', exact: true })).toHaveAttribute('aria-current', 'page');
        expect(state.reads.some(p => p.includes('/posts/feed/following'))).toBe(true);
        report.checks.push(`Home ${width}: layout, Explore keyboard/focus, feed failure/retry and Following`);

        if (width === 1440) {
            await page.goto(origin + '/home');
            await expect(page.getByRole('navigation', { name: 'Home shortcuts' })).toBeVisible();
            const shortcuts = page.getByRole('navigation', { name: 'Home shortcuts' });
            await expect(shortcuts.getByRole('link')).toHaveCount(4);
            const followingShortcut = shortcuts.getByRole('button', { name: 'Following People you keep up with' });
            await followingShortcut.click();
            await expect(page.getByRole('dialog', { name: 'Following' })).toBeVisible();
            await expect(page).toHaveURL(origin + '/home');
            await capture(page, 'home-following-dialog-1440');
            await page.keyboard.press('Escape');
            await expect(followingShortcut).toBeFocused();
            await shortcuts.getByRole('link', { name: 'My Schedule Your personal calendar' }).click();
            await expect(page).toHaveURL(origin + '/calendar?scope=personal');
            await expect(page.getByRole('button', { name: 'Club', exact: true })).toBeEnabled();
            await expect(page.getByRole('button', { name: 'My', exact: true })).toHaveAttribute('aria-pressed', 'true');
            await page.goto(origin + '/calendar');
            await expect(page.getByRole('button', { name: 'Club', exact: true })).toHaveAttribute('aria-pressed', 'true');
            report.checks.push('Home shortcuts: Following opens in place and restores focus; owner My Schedule opens personal calendar, default calendar retains club scope');
        }

        await page.goto(origin + '/profile/9');
        await expect(page.getByRole('heading', { name: 'Coach Luka' })).toBeVisible();
        await capture(page, `profile-${width}`);
        const followers = page.getByRole('button', { name: '21 Followers' });
        await followers.click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await expect(page.getByRole('link', { name: "View Football player 1's profile", exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Load more people' }).click();
        await expect(page.getByRole('link', { name: "View Football player 21's profile", exact: true })).toBeVisible();
        await capture(page, `followers-${width}`);
        await page.keyboard.press('Escape');
        await expect(followers).toBeFocused();
        state.failFollowers = true;
        await followers.click();
        await expect(page.getByRole('alert')).toBeVisible();
        state.failFollowers = false;
        await page.getByRole('button', { name: 'Retry connections' }).click();
        await expect(page.getByRole('link', { name: "View Football player 1's profile", exact: true })).toBeVisible();
        await page.keyboard.press('Escape');
        await page.getByRole('button', { name: '1 Following' }).click();
        await expect(page.getByRole('dialog', { name: 'Following' })).toBeVisible();
        await page.keyboard.press('Escape');
        report.checks.push(`Profile ${width}: counts open real API paths, pages/retry, Escape restores focus`);

        await page.goto(origin + '/clubs/701');
        await page.waitForLoadState('networkidle');
        await expect(page.getByRole('heading', { name: club.name, exact: true }).first()).toBeVisible();
        await expect(page.getByRole('button', { name: 'Dissolve Club', exact: true })).toHaveCount(0);
        await capture(page, `club-${width}`);
        await page.getByRole('button', { name: 'Honours', exact: true }).click();
        await expect(page.getByText('Academy Cup', { exact: true })).toBeVisible();
        await capture(page, `honours-${width}`);
        await page.getByRole('button', { name: 'Teams', exact: true }).click();
        await expect(page.getByRole('button', { name: 'View squad', exact: true })).toHaveCount(2);
        await capture(page, `teams-${width}`);
        await page.getByRole('button', { name: 'Photos & videos', exact: true }).click();
        await expect(page.getByText(/No (pictures|photos)/i)).toBeVisible();
        await page.getByRole('button', { name: 'Schedule', exact: true }).last().click();
        await expect(page.getByText('Friendly vs Kutaisi', { exact: true })).toBeVisible();
        await expect(page.getByText('Parents meeting', { exact: true })).toHaveCount(0);
        await capture(page, `schedule-${width}`);
        await page.getByRole('button', { name: 'Training', exact: true }).click();
        await page.getByLabel('Squad', { exact: true }).selectOption('16');
        await expect(page.getByText('U16 evening training', { exact: true })).toBeVisible();
        await expect(page.getByText('First team training', { exact: true })).toHaveCount(0);
        await capture(page, `training-${width}`);
        await page.getByRole('button', { name: 'Events', exact: true }).click();
        await expect(page.getByText('Parents meeting', { exact: true })).toBeVisible();
        await expect(page.getByText('Open academy tryout', { exact: true })).toBeVisible();
        await expect(page.getByText('Friendly vs Kutaisi', { exact: true })).toHaveCount(0);
        await expect(page.getByRole('link', { name: /Job postings & volunteering/ })).toHaveAttribute('href', '/clubs/701?tab=business&opportunity=jobs');
        await capture(page, `events-${width}`);
        report.checks.push(`Club tabs ${width}: Teams/Honours palette, match-first Schedule, squad-filtered training, distinct Events and scoped jobs link`);
        await page.getByRole('button', { name: 'Club settings', exact: true }).click();
        await expect(page.getByRole('dialog', { name: `${club.name} settings` })).toBeVisible();
        await expect(page.getByText('Advanced club settings')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Dissolve Club', exact: true })).not.toBeVisible();
        await page.getByText('Advanced club settings').click();
        await page.getByRole('button', { name: 'Dissolve Club', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Dissolve this club?' })).toBeVisible();
        await page.getByRole('button', { name: 'Cancel', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Club settings', exact: true })).toBeFocused();
        await page.getByRole('button', { name: 'Club settings', exact: true }).click();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toHaveCount(0);
        expect(state.mutations).toEqual([]);
        report.checks.push(`Club ${width}: Honours/media/calendar; owner-only nested dissolution opens original confirmation, cancellation makes no request`);
        await context.close();
    }
    const guest = await setup(1440, 'guest');
    await guest.page.goto(origin + '/');
    await expect(guest.page.getByRole('heading', { name: 'Find your place in football.' })).toBeVisible();
    await expect(guest.page.getByRole('link', { name: 'Browse clubs as a list' })).toHaveAttribute('href', '/clubs');
    await capture(guest.page, 'landing-1440');
    await guest.page.getByRole('link', { name: 'Browse clubs as a list' }).click();
    await expect(guest.page).toHaveURL(origin + '/clubs');
    report.checks.push('Landing: discovery and list alternative work without signing in; map tiles intentionally blocked');
    await guest.page.setViewportSize({ width: 390, height: 844 });
    await guest.page.goto(origin + '/');
    await expect(guest.page.getByRole('heading', { name: 'Find your place in football.' })).toBeVisible();
    await capture(guest.page, 'landing-390');
    await guest.context.close();
    for (const theme of ['dark', 'light']) {
        const { context, page, state } = await setup(390, 'visitor', theme);
        await page.goto(origin + '/clubs/701');
        await expect(page.getByRole('button', { name: 'Follow', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Club settings', exact: true })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Dissolve Club', exact: true })).toHaveCount(0);
        await capture(page, `visitor-club-${theme}-390`);
        await page.getByRole('button', { name: 'Schedule', exact: true }).last().click();
        await expect(page.getByText('Friendly vs Kutaisi', { exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Training', exact: true }).click();
        await expect(page.getByText('First team training', { exact: true })).toBeVisible();
        await expect(page.getByText('U16 evening training', { exact: true })).toHaveCount(0);
        await expect(page.getByRole('link', { name: 'Manage schedule', exact: true })).toHaveCount(0);
        await capture(page, `visitor-training-${theme}-390`);
        await page.goto(origin + '/home');
        await expect(page.getByRole('link', { name: 'Discover', exact: true })).toBeVisible();
        await capture(page, `visitor-home-${theme}-390`);
        await page.goto(origin + '/profile/10');
        await expect(page.getByRole('button', { name: '21 Followers' })).toBeDisabled();
        expect(state.reads.some(p => p.includes('/users/10/followers'))).toBe(false);
        report.checks.push(`Visitor ${theme}: no owner controls, private graph unavailable, mobile layout`);
        await context.close();
    }
    expect(report.errors).toEqual([]);
} finally {
    await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    await browser.close();
    await new Promise(resolve => server.httpServer.close(resolve));
}
console.log(JSON.stringify(report, null, 2));
