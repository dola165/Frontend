// Full production UI with isolated API fixtures. No developer API or external service is contacted.
import { preview } from 'vite';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('review/zoom-boundaries');
await mkdir(output, { recursive: true });
const server = await preview({ build: { outDir: path.resolve('dist/web-zoom-boundaries-20260912') }, preview: { host: '127.0.0.1', port: 0 } });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { conditions: 'Production UI, synthetic accounts and API responses; external network blocked; no live mutations', checks: [], errors: [] };
const profile = { id: 9, username: 'coach_luka', fullName: 'Coach Luka', role: 'ORGANIZER', bio: 'Developing the next generation of Georgian talent.', followerCount: 21, followingCount: 1, careerHistory: [], profileComplete: true, dob: '1990-01-01' };
const club = { id: 701, name: 'FC Dinamo Tbilisi', description: 'A football home for players, families and supporters. Training together, from the academy to the first team.', type: 'PROFESSIONAL', status: 'VERIFIED', isOfficial: true, myRole: 'OWNER', memberCount: 18, followerCount: 120, city: 'Tbilisi', country: 'Georgia', publicPhone: '+995322123456', trustedByClubs: [], honours: [{ id: 1, title: 'Academy Cup', yearWon: 2025, description: 'Youth champions' }], opportunities: [] };
const posts = [
    { id: 101, authorId: 9, authorName: 'Coach Luka', authorUsername: 'coach_luka', clubId: 701, clubName: club.name, content: 'Academy parents meeting tonight at 19:00. We will cover the spring calendar, travel logistics, and nutrition workshops.', createdAt: '2026-09-10T09:00:00', likeCount: 8, commentCount: 2, mediaUrls: ['/uploads/ui-check.svg'], isOfficial: true },
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
        if (url.pathname.endsWith('/uploads/ui-check.svg')) {
            state.reads.push(url.pathname);
            return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="500"><rect width="900" height="500" fill="#133d26"/><circle cx="450" cy="250" r="100" fill="#00e676"/></svg>' });
        }
        if (!url.pathname.startsWith('/api/')) {
            if (url.origin !== origin || url.pathname.includes('/ws')) return route.abort();
            return route.continue();
        }
        const name = url.pathname;
        if (name === '/api/uploads/ui-check.svg') return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="500"><rect width="900" height="500" fill="#133d26"/><circle cx="450" cy="250" r="100" fill="#00e676"/></svg>' });
        const method = route.request().method();
        state.reads.push(name + url.search);
        if (method !== 'GET' && !name.startsWith('/api/auth/')) state.mutations.push(`${method} ${name}`);
        let body = []; let status = 200;
        if (name === '/api/map/nearby') body = { content: [], totalElements: 0, page: 0, size: 100 };
        else if (name === '/api/club-memberships/me') { status = 404; body = {}; } // This route does not exist on the deployed API.
        else if (name === '/api/auth/csrf') body = { token: 'fixture', headerName: 'X-XSRF-TOKEN' };
        else if (name.startsWith('/api/auth/')) { status = 401; body = {}; }
        else if (name === '/api/users/me') body = role === 'owner' ? profile : { ...profile, id: 20, username: 'visitor', fullName: 'Football supporter', role: 'FAN' };
        else if (name === '/api/users/9') body = profile;
        else if (name === '/api/users/10') body = { ...profile, id: 10, isPrivate: true };
        else if (/\/users\/\d+\/followers$/.test(name)) {
            if (state.failFollowers) { status = 503; body = { detail: 'Connections temporarily unavailable.' }; }
            else { const page = Number(url.searchParams.get('page')); body = { content: people.slice(page * 20, (page + 1) * 20), pageNumber: page, pageSize: 20, totalElements: 21 }; }
        }
        else if (/\/users\/\d+\/following$/.test(name)) body = { content: [people[0]], pageNumber: 0, pageSize: 20, totalElements: 1 };
        else if (name === '/api/clubs/my-club') body = { clubId: 701, clubName: club.name, myRole: role === 'owner' ? 'OWNER' : 'PLAYER' };
        else if (name === '/api/clubs/my-membership-context') body = role === 'guest' ? { hasClubMembership: false, canCreateClub: true } : { hasClubMembership: true, canCreateClub: false, clubId: 701, clubName: club.name, myRole: role === 'owner' ? 'OWNER' : 'PLAYER' };
        else if (name === '/api/clubs/701') body = { ...club, myRole: role === 'owner' ? 'OWNER' : null };
        else if (name === '/api/clubs/701/management') body = { currentUserRole: 'OWNER', clubId: 701, clubName: club.name, assignableInviteRoles: ['COACH'], assignableApplicationRoles: ['PLAYER'], members: [], pendingInvitations: [], pendingApplications: [] };
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
    page.on('console', msg => { if(msg.type()==='error' && /TypeError|ReferenceError/.test(msg.text())) report.errors.push(msg.text()); });
    return { context, page, state };
}

async function capture(page, name) {
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name} horizontal overflow`).toBe(true);
}

async function matchesNavigationFrame(page, selector) {
  const nav=await page.locator('#app-top-navigation > .app-page-frame').boundingBox();
  const frame=await page.locator(selector).first().boundingBox();
  expect(Math.abs(frame.x-nav.x), selector+' left boundary').toBeLessThan(2);
  expect(Math.abs(frame.width-nav.width), selector+' width').toBeLessThan(2);
}

try {
  // Enlarged CSS viewports reproduce the layout space exposed by browser zoom-out.
  for (const [width, height] of [[1366,768],[1280,720],[1024,768],[390,844],[360,800],[2560,1440],[2880,1416],[3840,1888]]) {
    const { context, page, state } = await setup(width);
    await page.setViewportSize({width,height});
    await page.goto(origin + '/home');
    await expect(page.getByText(posts[0].content, {exact:true})).toBeVisible();
    await matchesNavigationFrame(page,'.feed-home-grid');
    expect(await page.locator('.feed-home-shell').evaluate(el=>getComputedStyle(el).getPropertyValue('--feed-text-secondary').trim())).toBe('#bdc1cb');
    const shortcut = page.getByRole('button', {name:'Shortcuts',exact:true});
    await expect(shortcut).toBeVisible();
    await expect(page.getByRole('link',{name:'Workspace — FC Dinamo Tbilisi'}).filter({visible:true})).toHaveCount(1);
    if (width >= 640) {
      const shortcutsBox=await shortcut.boundingBox();
      const worldBox=await page.getByRole('link',{name:'GrassKickZ World map'}).boundingBox();
      expect(shortcutsBox.x+shortcutsBox.width).toBeLessThanOrEqual(worldBox.x+1);
      expect(Math.abs(shortcutsBox.y-worldBox.y)).toBeLessThan(4);
    }
    await shortcut.click();
    await expect(page.getByRole('menuitem',{name:'Workspace — FC Dinamo Tbilisi'})).toHaveAttribute('href','/clubs/701/workspace');
    await page.keyboard.press('Escape');
    await expect(shortcut).toBeFocused();
    const article=page.locator('article').filter({hasText:posts[0].content});
    expect(await article.evaluate(el=>getComputedStyle(el).borderTopWidth)).toBe('2px');
    expect(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--app-page-max-width').trim())).toBe('2240px');
    const media=article.getByRole('img',{name:'Post media'});
    await expect.poll(()=>media.evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);
    expect(await media.evaluate(i=>getComputedStyle(i).objectFit)).toBe('contain');
    const original=await media.elementHandle();
    const mediaReads=()=>state.reads.filter(p=>p.includes('/uploads/ui-check.svg')).length;
    const readCount=mediaReads();
    expect(readCount).toBeGreaterThan(0);
    await article.getByRole('button',{name:'Like',exact:true}).click();
    await article.getByRole('button',{name:'Comment',exact:true}).click();
    await article.getByPlaceholder('Write a comment...').fill('Draft only, isolated fixture');
    expect(await media.evaluate((image,old)=>image===old,original)).toBe(true);
    expect(mediaReads()).toBe(readCount);
    expect(state.reads.some(p=>p.startsWith('/api/club-memberships/me'))).toBe(false);
    await capture(page, 'home-'+width);
    report.checks.push('Home '+width+'x'+height+': stable media and requests, Shortcuts beside World, authorized Workspace, no overflow');

    await page.goto(origin+'/clubs');
    await expect(page.getByRole('heading',{name:'Club Directory'})).toBeVisible();
    await matchesNavigationFrame(page,'.club-directory-frame');
    const directoryInner=await page.locator('.club-directory-frame > div').boundingBox();
    const directoryToolbar=await page.locator('.club-directory-toolbar').boundingBox();
    expect(Math.abs(directoryInner.x-directoryToolbar.x)).toBeLessThan(1);
    expect(Math.abs(directoryInner.width-directoryToolbar.width)).toBeLessThan(1);
    const grid=page.locator('.club-directory-card-grid');
    await expect(grid.locator('a').first()).toBeVisible();
    if(width>=1024)expect((await grid.locator(':scope > *').first().boundingBox()).width).toBeLessThan(470);
    await capture(page,'directory-'+width);

    await page.goto(origin+'/clubs/701');
    await expect(page.getByRole('heading',{name:club.name,exact:true}).first()).toBeVisible();
    await matchesNavigationFrame(page,'.club-identity-frame');
    await matchesNavigationFrame(page,'.club-banner-actions');
    expect(await page.locator('.club-page-shell').first().evaluate(el=>getComputedStyle(el).getPropertyValue('--text-secondary').trim())).toBe('#bdc1cb');
    await capture(page,'club-'+width);

    await page.goto(origin+'/clubs/701/workspace');
    await expect(page.locator('.workspace-page-shell')).toBeVisible();
    expect(await page.locator('.workspace-page-shell').evaluate(el=>getComputedStyle(el).getPropertyValue('--text-secondary').trim())).toBe('#bdc1cb');
    await capture(page,'workspace-'+width);
    const worldBefore = width >= 640 ? await page.getByRole('link',{name:'GrassKickZ World map'}).boundingBox() : null;
    const hide=page.getByRole('button',{name:'Hide navigation',exact:true});
    if(worldBefore) expect((await hide.boundingBox()).y).toBeGreaterThan(worldBefore.y+worldBefore.height);
    await hide.click();
    await expect(page.locator('#app-top-navigation')).toHaveCount(0);
    await page.getByRole('button',{name:'Show navigation',exact:true}).click();
    if(worldBefore) expect(Math.abs((await page.getByRole('link',{name:'GrassKickZ World map'}).boundingBox()).x-worldBefore.x)).toBeLessThan(1);
    if(width<1024) {
      await page.getByRole('button',{name:'Menu',exact:true}).click();
      await expect(page.locator('.workspace-sidebar.is-open')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('.workspace-sidebar.is-open')).toHaveCount(0);
    }
    report.checks.push('Club '+width+': bounded lone directory card, original header and workspace layout');

    await page.goto(origin+'/calendar');
    await expect(page.getByRole('button',{name:'Week',exact:true})).toHaveAttribute('aria-pressed','true');
    await matchesNavigationFrame(page,'.schedule-bounded-workspace');
    await expect(page.getByRole('button',{name:'Calendar filters',exact:true})).toHaveCount(0);
    await capture(page,'calendar-'+width);
    report.checks.push('Calendar '+width+': Week default, original sidebar layout, no document overflow');
    await context.close();
  }
  for(const [width,theme] of [[1366,'dark'],[390,'dark'],[2560,'dark'],[1280,'light']]) {
    const {context,page}=await setup(width,'guest',theme);
    await page.goto(origin+'/');
    const map=page.locator('[data-landing-map-viewport]');
    await expect(map).toBeVisible();
    const before=await map.boundingBox();
    expect(before.height).toBeLessThanOrEqual(680);
    const after=await map.boundingBox();
    expect(Math.abs(after.height-before.height)).toBeLessThan(2);
    expect((await page.locator('.landing-content-frame').boundingBox()).width).toBeLessThanOrEqual(2241);
    await capture(page,'landing-'+width+'-'+theme);
    report.checks.push('Landing '+width+' '+theme+': bounded map container and centered width; remote tiles blocked in isolated test, actual map wheel zoom checked by live rehearsal');
    await context.close();
  }
  const {context,page}=await setup(1280,'player');
  await page.goto(origin+'/home');
  await expect(page.getByText(posts[0].content,{exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:/Workspace —/})).toHaveCount(0);
  await page.getByRole('button',{name:'Shortcuts',exact:true}).click();
  await expect(page.getByRole('menuitem',{name:/Workspace —/})).toHaveCount(0);
  report.checks.push('Player cannot see staff shortcuts; backend authorization unchanged');
  await context.close();
  expect(report.errors).toEqual([]);
  report.passed=true;
} catch(error) {
  report.passed=false; report.failure=String(error.stack); process.exitCode=1;
  for (const context of browser.contexts()) for (const page of context.pages()) {
    report.lastPage={url:page.url(),text:(await page.locator('body').innerText()).slice(0,7000)};
    await page.screenshot({path:path.join(output,'failure.png'),fullPage:true});
  }
} finally {
  await writeFile(path.join(output,'results.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  await browser.close(); await server.close();
}
