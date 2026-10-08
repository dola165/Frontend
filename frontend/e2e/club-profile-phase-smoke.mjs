import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

// Deterministic browser checks of the real routes. No running backend or real accounts.
const origin = process.env.CLUB_PROFILE_PREVIEW_ORIGIN || 'http://127.0.0.1:5317';
const output = 'review/club-profile-phase-20260917';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'en-GB', serviceWorkers: 'block' });
const page = await context.newPage();
const errors = [], checks = [], saves = [];
page.on('pageerror', e => errors.push(e.message));
const programme = { id: 10, name: 'U12 development programme', ageMin: 8, ageMax: 12, sessionsPerWeek: 3, priceType: 'FIXED', amount: '150.00', currency: 'GEL', billingPeriod: 'MONTH', trialAmount: '0.00', joiningFee: '20.00', equipmentFee: '0.00', details: 'Three coached sessions per week. Bring boots, shin pads and water. Training takes place at the academy ground.', published: true };
let presentation = { profileKind: 'ACADEMY', revision: 0, canEdit: true, canManageAffiliations: true, programmes: [programme], sponsors: [{ id: 1, name: 'Riverside Sports', logoUrl: null, websiteUrl: 'https://example.com', organizationId: null, published: true }], affiliations: [{ id: 1, clubId: 2, name: 'FC Riverside', logoUrl: null, profileKind: 'PROFESSIONAL', status: 'ACTIVE', canRespond: false }] };
const club = (id) => ({ id, name: id === 1 ? 'Riverside Football Academy' : 'FC Riverside', description: id === 1 ? 'Football development for young players, with experienced coaches and a welcoming team.' : 'Our first team, club history, supporters and academy network.', type: id === 1 ? 'ACADEMY' : 'PROFESSIONAL', isOfficial: false, statusLabel: 'New club', followerCount: 230, memberCount: 64, isFollowedByMe: false, isStaffMember: false, isMember: false, myRole: null, playerJoinPolicy: 'APPLICATION_REQUIRED', relationshipState: 'NONE', addressText: 'Riverside Ground, Tbilisi', cityName: 'Tbilisi', countryName: 'Georgia', whatsappNumber: null, trustedByClubs: [], honours: [], opportunities: [], presentation: id === 1 ? presentation : { ...presentation, profileKind: 'PROFESSIONAL', programmes: [], affiliations: [{ id: 1, clubId: 1, name: 'Riverside Football Academy', profileKind: 'ACADEMY', status: 'ACTIVE', canRespond: false, canManageProfile: true }] } });
const emptyPage = { content: [], totalElements: 0, totalPages: 0, pageNumber: 0, pageSize: 20 };
await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/api/')) {
        let data = [];
        const path = url.pathname;
        if (path === '/api/auth/csrf') data = { headerName: 'X-CSRF-TOKEN', token: 'fixture-csrf' };
        else if (path === '/api/auth/refresh') data = { accessToken: 'fixture-access-token' };
        else if (path === '/api/users/me') data = { id: 7, fullName: 'Fixture owner', role: 'ORGANIZER', email: 'fixture@example.com', profileComplete: true, onboardingRequired: false, emailVerified: true };
        else if (path === '/api/clubs/my-membership-context') data = { clubId: 1, clubName: 'Riverside Football Academy', myRole: 'OWNER', hasClubMembership: true };
        else if (path === '/api/clubs/1/management') data = { currentUserRole: 'OWNER', assignableInviteRoles: ['COACH'], assignableStaffRoles: ['COACH'], members: [], pendingApplications: [], pendingInvitations: [], activePlayerCount: 0, trialistCount: 0, overdueTrialistCount: 0, pendingTryoutCount: 0 };
        else if (path === '/api/clubs/1/presentation/manage') data = presentation;
        else if (path === '/api/clubs/1/presentation' && route.request().method() === 'PUT') { const draft = route.request().postDataJSON(); saves.push(draft); presentation = { ...presentation, ...draft, revision: presentation.revision + 1 }; data = presentation; }
        else if (/^\/api\/clubs\/[12]$/.test(path)) data = club(Number(path.split('/').at(-1)));
        else if (path.startsWith('/api/posts/club/')) data = { posts: [], hasMore: false };
        else if (path.includes('unread-count')) data = { unreadCount: 0, count: 0 };
        else if (path.includes('/notifications') || path.includes('/players') || path.includes('/store/products') || path === '/api/campaigns') data = emptyPage;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    }
    if (url.origin === origin || url.protocol === 'data:' || url.protocol === 'blob:') return route.continue();
    return route.abort();
});
const capture = async name => {
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `${output}/${name}.png`, fullPage: true }); checks.push(name);
};
try {
    await page.goto(`${origin}/clubs/1`);
    await expect(page.getByRole('heading', { name: 'Training programmes', exact: true })).toBeVisible();
    await expect(page.getByText('150 GEL / month', { exact: true }).last()).toBeVisible();
    await capture('academy-desktop');
    for (const width of [390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await page.evaluate(() => window.scrollTo(0, 0));
        await expect(page.getByText('150 GEL / month', { exact: true }).first()).toBeVisible();
        await capture(`academy-${width}`);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${origin}/clubs/2`);
    await expect(page.getByRole('heading', { name: 'Our academies' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Training programmes', exact: true })).toHaveCount(0);
    await page.getByRole('link', { name: /Riverside Football Academy Training/ }).click();
    await expect(page).toHaveURL(/\/clubs\/1$/);
    checks.push('professional-academy-navigation');
    await page.goto(`${origin}/clubs/2`);
    await expect(page.getByRole('heading', { name: 'Our academies' })).toBeVisible();
    await capture('professional-desktop');
    await page.goto(`${origin}/clubs/1/workspace?tab=settings`);
    await expect(page.getByRole('heading', { name: 'Public club profile', exact: true })).toBeVisible();
    await capture('editor-desktop');
    await page.getByRole('spinbutton', { name: 'Training amount', exact: true }).fill('175.45');
    await page.getByRole('button', { name: 'Save profile settings', exact: true }).click();
    await expect(page.getByText('Public profile settings saved.', { exact: true })).toBeVisible();
    expect(saves.at(-1).programmes[0].amount).toBe('175.45');
    await page.setViewportSize({ width: 390, height: 900 }); await capture('editor-mobile');
    await page.goto(`${origin}/clubs/1`);
    await expect(page.getByText('175.45 GEL / month', { exact: true }).first()).toBeVisible();
    checks.push('saved-price-on-public-profile');
    presentation = { ...presentation, canManageAffiliations: false };
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${origin}/clubs/2`);
    await page.getByRole('link', { name: /Manage academy profile/ }).click();
    await expect(page).toHaveURL(/\/clubs\/1\/profile-settings$/);
    await expect(page.getByText(/through access granted/)).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Profile purpose' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'End affiliation', exact: true })).toHaveCount(0);
    await page.getByRole('spinbutton', { name: 'Training amount', exact: true }).fill('180.50');
    await page.getByRole('button', { name: 'Save profile settings', exact: true }).click();
    await expect(page.getByText('Public profile settings saved.', { exact: true })).toBeVisible();
    await capture('delegated-editor-desktop');
    await page.setViewportSize({ width: 320, height: 900 }); await capture('delegated-editor-mobile');
    await page.goto(`${origin}/clubs/1`);
    await expect(page.getByText('180.5 GEL / month', { exact: true }).first()).toBeVisible();
    checks.push('delegated-price-on-public-profile');
    expect(errors).toEqual([]);
} catch (e) { await page.screenshot({ path: `${output}/failure.png`, fullPage: true }); throw e; }
finally { await writeFile(`${output}/results.json`, JSON.stringify({ checks, errors, saves: saves.length }, null, 2)); console.log(JSON.stringify({ checks, errors, saves: saves.length })); await browser.close(); }
