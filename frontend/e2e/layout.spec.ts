import { expect, test } from '@playwright/test';

// This is a Playwright-only structural suite. Vitest also discovers *.spec.ts,
// so keep collection inert there and run it with `npm run qa:layout`.
if (process.env.VITEST) {
    describe.skip('layout regression — Playwright-only suite', () => {});
} else {

const mockMode = process.env.E2E_MOCKS === 'true';

test.beforeEach(async ({ page }) => {
    if (!mockMode) return;

    await page.goto('/clubs');
    await expect(page.getByRole('heading', { name: /club directory/i })).toBeVisible({ timeout: 15000 });
    await page.evaluate(async () => {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'organizer@test.dev', password: 'mock' })
        });
        if (!response.ok) throw new Error(`Mock login failed with ${response.status}.`);
        const data = await response.json() as { accessToken?: string };
        if (!data.accessToken) throw new Error('Mock login did not return an access token.');
        const payload = JSON.parse(atob(data.accessToken.split('.')[1])) as { sub: number };
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('userId', String(payload.sub));
    });
    await page.reload();
    await expect(page.getByRole('link', { name: /profile/i })).toBeVisible({ timeout: 15000 });
});

const destinationRoutes = [
    { path: '/clubs', readyText: /club directory/i, bleed: true },
    { path: '/clubs/1', readyText: /creekside fc/i, bleed: true },
    { path: '/account', readyText: /account settings/i, bleed: false },
    { path: '/notifications', readyText: /^notifications$/i, bleed: false },
    { path: '/tournaments', readyText: /find your next competition/i, bleed: false },
    { path: '/tournaments/1', readyText: /summer cup 2026/i, bleed: false }
] as const;

const desktopViewports = [
    { width: 1024, height: 768 },
    { width: 1280, height: 720 },
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
    { width: 2560, height: 1440 }
] as const;

test.describe('wide destination layout invariants', () => {
    for (const viewport of desktopViewports) {
        test(`${viewport.width}x${viewport.height} keeps showcase destinations wide and aligned`, async ({ page }) => {
            await page.setViewportSize(viewport);

            for (const route of destinationRoutes) {
                await page.goto(route.path);
                await expect(page.getByRole('heading', { name: route.readyText }).first()).toBeVisible();
                await expect(page.locator('#app-top-navigation')).toBeVisible();
                await expect(page.getByRole('button', { name: /hide navigation/i })).toHaveCount(0);
                await expect(page.getByRole('button', { name: /show navigation/i })).toHaveCount(0);

                const metrics = await page.evaluate(() => {
                    const routeFrame = document.querySelector<HTMLElement>('.app-route-frame');
                    const routeContent = routeFrame?.firstElementChild as HTMLElement | null;
                    const navContent = document.querySelector<HTMLElement>('nav [data-layout-frame="wide"] > div:first-child');
                    const frameRect = routeFrame?.getBoundingClientRect();
                    const contentRect = routeContent?.getBoundingClientRect();
                    const navRect = navContent?.getBoundingClientRect();

                    return {
                        viewportWidth: window.innerWidth,
                        documentWidth: document.documentElement.scrollWidth,
                        frameWidth: frameRect?.width ?? 0,
                        contentWidth: contentRect?.width ?? 0,
                        contentLeft: contentRect?.left ?? -1,
                        navLeft: navRect?.left ?? -2
                    };
                });

                expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
                expect(metrics.frameWidth).toBeGreaterThanOrEqual(Math.min(viewport.width, 2240) * 0.98);
                expect(metrics.contentWidth).toBeGreaterThan(metrics.frameWidth * 0.9);
                if (route.bleed) {
                    expect(metrics.contentLeft).toBeLessThanOrEqual(1);
                } else {
                    expect(Math.abs(metrics.contentLeft - metrics.navLeft)).toBeLessThanOrEqual(1);
                }
            }
        });
    }
});

test('Home keeps a readable social layout and preserves the legacy feed link', async ({ page }) => {
    const viewports = [
        { width: 1440, height: 900, leftRail: true, rightRail: true },
        { width: 1024, height: 768, leftRail: true, rightRail: false },
        { width: 1280, height: 720, leftRail: true, rightRail: true },
        { width: 1366, height: 768, leftRail: true, rightRail: true },
        { width: 1920, height: 1080, leftRail: true, rightRail: true },
        // Zoom-equivalent CSS viewports for a 1920px monitor at 80% and 67%.
        // The shared page maximum should keep the feed aligned with the nav
        // instead of allowing the rails to drift to the browser edges.
        { width: 2400, height: 1080, leftRail: true, rightRail: true },
        { width: 2866, height: 1080, leftRail: true, rightRail: true },
        { width: 390, height: 844, leftRail: false, rightRail: false }
    ] as const;

    for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await page.goto('/feed?view=following');
        await expect(page).toHaveURL(/\/home\?view=following$/);
        await expect(page.getByRole('textbox', { name: /create a post/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /add photo/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /add video/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /create event/i })).toBeVisible();
        await expect(page.getByText('Your network', { exact: true })).toHaveCount(0);
        await expect(page.getByText('Football updates, all in one place', { exact: true })).toHaveCount(0);
        await expect(page.getByRole('navigation', { name: /home posts/i })).toBeVisible();

        const metrics = await page.evaluate(() => {
            const main = document.querySelector<HTMLElement>('main')?.getBoundingClientRect();
            const feedGrid = document.querySelector<HTMLElement>('.feed-home-grid')?.getBoundingClientRect();
            const navFrame = document.querySelector<HTMLElement>('#app-top-navigation [data-layout-frame="wide"]')?.getBoundingClientRect();
            const asides = Array.from(document.querySelectorAll<HTMLElement>('aside')).map((aside) => ({
                display: getComputedStyle(aside).display,
                width: aside.getBoundingClientRect().width,
                left: aside.getBoundingClientRect().left,
                right: aside.getBoundingClientRect().right
            }));
            const textbox = document.querySelector<HTMLElement>('[aria-label="Create a post"]')?.getBoundingClientRect();
            const photo = document.querySelector<HTMLElement>('[aria-label="Add photo"]')?.getBoundingClientRect();
            const composer = document.querySelector<HTMLElement>('[aria-label="Create a post"]')?.closest('section')?.getBoundingClientRect();
            return {
                viewportWidth: window.innerWidth,
                documentWidth: document.documentElement.scrollWidth,
                mainWidth: main?.width ?? 0,
                feedGridLeft: feedGrid?.left ?? -1,
                feedGridRight: feedGrid?.right ?? -1,
                navFrameLeft: navFrame?.left ?? -1,
                navFrameRight: navFrame?.right ?? -1,
                leftRailVisible: asides[0]?.display !== 'none' && asides[0]?.width > 0,
                rightRailVisible: asides[1]?.display !== 'none' && asides[1]?.width > 0,
                leftRailLeft: asides[0]?.left ?? -1,
                rightRailRight: asides[1]?.right ?? -1,
                composerHeight: composer?.height ?? 0,
                textboxCenter: textbox ? textbox.top + textbox.height / 2 : 0,
                photoCenter: photo ? photo.top + photo.height / 2 : 0
            };
        });

        expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
        expect(metrics.leftRailVisible).toBe(viewport.leftRail);
        expect(metrics.rightRailVisible).toBe(viewport.rightRail);
        expect(metrics.composerHeight).toBeLessThanOrEqual(70);
        expect(Math.abs(metrics.textboxCenter - metrics.photoCenter)).toBeLessThanOrEqual(2);
        if (viewport.width >= 1024) {
            expect(metrics.mainWidth).toBeGreaterThanOrEqual(640);
            expect(metrics.mainWidth).toBeLessThanOrEqual(681);
            expect(metrics.leftRailLeft).toBeGreaterThanOrEqual(metrics.navFrameLeft - 1);
            expect(metrics.leftRailLeft).toBeLessThanOrEqual(metrics.navFrameRight);
            expect(metrics.feedGridLeft).toBeGreaterThanOrEqual(metrics.navFrameLeft - 1);
            expect(metrics.feedGridRight).toBeLessThanOrEqual(metrics.navFrameRight + 1);
        } else {
            expect(metrics.mainWidth).toBeGreaterThanOrEqual(viewport.width - 48);
        }
        if (viewport.rightRail) {
            expect(metrics.rightRailRight).toBeLessThanOrEqual(metrics.navFrameRight + 1);
            expect(metrics.rightRailRight).toBeGreaterThanOrEqual(metrics.navFrameLeft);
        }
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    // Keep this client-side so the mock worker's in-memory conversation is not
    // reset by a document reload before the Home rail requests it.
    await page.evaluate(() => {
        window.history.pushState({}, '', '/home');
        window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.getByRole('button', { name: /open menu/i }).click();
    await expect(page.getByRole('menuitem', { name: /account settings/i })).toBeVisible();
    await expect(page.getByRole('menuitemradio', { name: /^light mode/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /sign out/i })).toBeVisible();
});

test('club stores expose scoped filters, collections, and the global Store', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/clubs/1/store');
    await expect(page.getByRole('heading', { name: 'Creekside FC' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Collections' })).toBeVisible();
    await expect(page.getByRole('button', { name: /open global store/i })).toBeVisible();

    await page.getByRole('button', { name: /kits & footwear/i }).click();
    await expect(page.getByText('1 product', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: /home kit/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /academy scarf/i })).toHaveCount(0);

    await page.getByPlaceholder(/search this club store/i).fill('not-a-real-product');
    await expect(page.getByText(/no products match these filters/i)).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/clubs/1/store');
    const mobileMetrics = await page.evaluate(() => ({
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth
    }));
    expect(mobileMetrics.documentWidth).toBeLessThanOrEqual(mobileMetrics.viewportWidth + 1);
    await expect(page.getByRole('button', { name: /open global store/i })).toBeVisible();
    await page.getByRole('button', { name: /open global store/i }).click();
    await expect(page).toHaveURL(/\/store$/);
    await expect(page.getByRole('heading', { name: /^Store$/i })).toBeVisible();
    await page.getByRole('link', { name: /^Jobs$/i }).click();
    await expect(page).toHaveURL(/\/jobs$/);
    await expect(page.getByRole('heading', { name: /jobs & volunteer opportunities/i })).toBeVisible();
});

test('Jobs uses football filters while Campaigns stays honestly deferred', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/jobs');
    await expect(page.getByRole('heading', { name: /jobs & volunteer opportunities/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /location and club/i })).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('combobox', { name: 'Country' }).selectOption({ label: 'United Kingdom' });
    await page.getByRole('combobox', { name: 'City' }).selectOption({ label: 'Bristol' });
    await page.getByRole('radio', { name: /media & communications/i }).check({ force: true });
    await page.getByRole('radio', { name: /^volunteering$/i }).check({ force: true });
    await expect(page.getByRole('button', { name: /volunteer social media coordinator/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /goalkeeper coach/i })).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileMetrics = await page.evaluate(() => ({
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth
    }));
    expect(mobileMetrics.documentWidth).toBeLessThanOrEqual(mobileMetrics.viewportWidth + 1);

    await page.getByRole('link', { name: /^Campaigns$/i }).click();
    await expect(page).toHaveURL(/\/campaigns$/);
    await expect(page.getByRole('heading', { name: /^Campaigns$/i })).toBeVisible();
    await expect(page.getByText(/fundraiser data remains intentionally disconnected/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /location and club/i })).toBeVisible();
});

test('discovery filters are prominent and the product canvas follows light mode', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/jobs');

    const filterRail = page.getByRole('complementary', { name: /job filters/i });
    await expect(filterRail).toBeVisible();
    const filterBox = await filterRail.boundingBox();
    expect(filterBox?.width ?? 0).toBeGreaterThanOrEqual(290);
    await expect(page.getByText(/narrow the directory by football role/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /location and club/i })).toHaveAttribute('aria-expanded', 'true');

    await page.evaluate(() => localStorage.setItem('theme', 'dark'));
    await page.reload();
    await page.getByRole('button', { name: /open menu/i }).click();
    await page.getByRole('menuitemradio', { name: /^light mode/i }).click();
    await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(false);

    await expect.poll(() => page.evaluate(() => {
        const app = document.querySelector<HTMLElement>('.product-app-shell');
        const route = document.querySelector<HTMLElement>('.app-page-shell');
        return Boolean(app && route && getComputedStyle(app).backgroundColor === getComputedStyle(route).backgroundColor);
    })).toBe(true);
});

test('club directory switches views and shares one responsive filter state', async ({ page }) => {
    test.skip(!mockMode, 'requires the deterministic mock session');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/clubs');
    await expect(page.getByRole('heading', { name: /club directory/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /grid view/i })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('section[aria-label="Club results"] article')).toHaveCount(4);
    const firstClubLinks = page.locator('section[aria-label="Club results"] article').first().locator('a[href^="/clubs/"]');
    await expect(firstClubLinks).toHaveCount(3);
    const firstClubHref = await firstClubLinks.first().getAttribute('href');
    expect(firstClubHref).toMatch(/\/clubs\/\d+/);
    for (let linkIndex = 1; linkIndex < 3; linkIndex += 1) {
        await expect(firstClubLinks.nth(linkIndex)).toHaveAttribute('href', firstClubHref ?? '');
    }

    await page.getByRole('button', { name: /list view/i }).click();
    await expect(page.getByRole('button', { name: /list view/i })).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(page.getByRole('button', { name: /list view/i })).toHaveAttribute('aria-pressed', 'true');

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('button', { name: /open filters/i })).toBeVisible();
    await expect(page.getByRole('complementary', { name: /filters/i })).toHaveCount(0);
    await page.getByRole('button', { name: /open filters/i }).click();
    const filterDialog = page.getByRole('dialog', { name: /filters/i });
    await expect(filterDialog).toBeVisible();
    await filterDialog.getByRole('button', { name: 'ACADEMY', exact: true }).click();
    await expect.poll(() => new URL(page.url()).searchParams.getAll('type')).toEqual(['ACADEMY']);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: /open filters/i })).toBeFocused();
    await expect(filterDialog).toHaveCount(0);
    await page.getByRole('button', { name: /remove filter academy/i }).click();
    await expect.poll(() => new URL(page.url()).searchParams.getAll('type')).toEqual([]);
});

test('landing map keeps filters outside the canvas until requested', async ({ page }) => {
    test.skip(!mockMode, 'requires the deterministic mock session');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const toolbar = page.getByRole('region', { name: /map search and filters/i });
    const filterPanel = page.getByRole('complementary', { name: /simple map filters/i });
    await expect(toolbar).toBeVisible();
    await expect(page.locator('.map-canvas-frame')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.querySelector<HTMLElement>('.maplibregl-canvas')?.getBoundingClientRect().height ?? 0)).toBeGreaterThan(0);
    await expect(page.getByRole('button', { name: /open filters/i })).toBeVisible();
    await expect(filterPanel).toBeHidden();

    await page.getByRole('button', { name: /open filters/i }).click();
    await expect(filterPanel).toBeVisible();
    const desktopPlacement = await page.evaluate(() => {
        const panel = document.querySelector<HTMLElement>('#landing-map-filter-panel')?.getBoundingClientRect();
        const canvas = document.querySelector<HTMLElement>('.map-canvas-frame')?.getBoundingClientRect();
        const canvasElement = document.querySelector<HTMLElement>('.map-canvas-frame');
        const panelElement = document.querySelector<HTMLElement>('#landing-map-filter-panel');
        return {
            panelBottom: panel?.bottom ?? -1,
            canvasTop: canvas?.top ?? null,
            panelInsideCanvas: Boolean(canvasElement && panelElement && canvasElement.contains(panelElement))
        };
    });
    expect(desktopPlacement.panelInsideCanvas).toBe(false);
    if (desktopPlacement.canvasTop != null) {
        expect(desktopPlacement.panelBottom).toBeLessThanOrEqual(desktopPlacement.canvasTop + 1);
    }

    await filterPanel.getByRole('button', { name: /close filters/i }).click();
    await expect(filterPanel).toBeHidden();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: /open filters/i }).click();
    await expect(filterPanel).toBeVisible();
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector<HTMLElement>('#landing-map-filter-panel')!).position)).toBe('fixed');
    await filterPanel.getByRole('button', { name: /close filters/i }).click();
    await expect(filterPanel).toBeHidden();
});

test('Followed Clubs opens its own focused directory', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/clubs/following');
    await expect(page.getByRole('heading', { name: 'Followed clubs', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /browse more clubs/i })).toBeVisible();
    await expect(page).toHaveURL(/\/clubs\/following$/);
});

test('mobile navigation exposes search and destinations hidden from desktop rails', async ({ page }) => {
    test.skip(!mockMode, 'requires the deterministic mock session');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/home');

    await expect(page.getByRole('button', { name: /open search/i })).toBeVisible();
    await page.getByRole('button', { name: /open search/i }).click();
    await expect(page.getByRole('textbox', { name: /global search/i })).toBeFocused();
    await page.getByRole('button', { name: /close search/i }).click();
    await expect(page.getByRole('button', { name: /open search/i })).toBeFocused();

    await page.getByRole('button', { name: /open menu/i }).click();
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('group', { name: /explore grasskickz/i })).toBeVisible();
    for (const label of ['People', 'Followed clubs', 'Store', 'Jobs & volunteering', 'Campaigns']) {
        await expect(menu.getByRole('menuitem', { name: label, exact: true })).toBeVisible();
    }
    await page.getByRole('button', { name: /close menu/i }).click();
    await expect(page.getByRole('button', { name: /open menu/i })).toBeFocused();
    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(documentWidth).toBeLessThanOrEqual(390);
});

test('anonymous mobile visitors keep public navigation and search usable', async ({ page }) => {
    test.skip(!mockMode, 'requires the deterministic mock session');
    await page.evaluate(() => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('userId');
    });
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/clubs');
    await expect(page.getByRole('heading', { name: /club directory/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /open search/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /^clubs$/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /^tournaments$/i })).toBeVisible();
    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(documentWidth).toBeLessThanOrEqual(375);
});

test('Recent contacts open a quick chat without leaving Home', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/home');
    await expect(page).toHaveURL(/\/home$/);
    const contact = page.getByRole('button', { name: /marcus rivera/i });
    await expect(contact).toBeVisible();
    await contact.click();

    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole('region', { name: /chat with marcus rivera/i })).toBeVisible();
    await page.getByPlaceholder(/write a message/i).fill('Quick chat works');
    await page.getByRole('button', { name: /send message/i }).click();
    await expect(page.getByText('Quick chat works')).toBeVisible();
});

test('immersive workspaces fill their available canvas without document overflow', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const workspaces = [
        '/map',
        '/calendar',
        '/messages',
        '/clubs/1/workspace',
        '/tournaments/1/workspace'
    ] as const;

    for (const workspacePath of workspaces) {
        await page.goto(workspacePath);
        await page.waitForTimeout(1200);
        await expect(page.getByText('Something went wrong')).toHaveCount(0);
        await expect(page.locator('#app-top-navigation')).toBeVisible();
        await expect(page.getByRole('button', { name: /hide navigation/i })).toBeVisible();

        const metrics = await page.evaluate(() => {
            const main = document.querySelector<HTMLElement>('main');
            const rect = main?.getBoundingClientRect();
            return {
                viewportWidth: window.innerWidth,
                viewportHeight: window.innerHeight,
                documentWidth: document.documentElement.scrollWidth,
                mainWidth: rect?.width ?? 0,
                mainHeight: rect?.height ?? 0
            };
        });

        expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
        expect(metrics.mainWidth).toBeGreaterThanOrEqual(metrics.viewportWidth * 0.99);
        expect(metrics.mainHeight).toBeGreaterThanOrEqual(metrics.viewportHeight - 101);

        await page.getByRole('button', { name: /hide navigation/i }).click();
        await expect(page.locator('#app-top-navigation')).toHaveCount(0);
        await expect(page.getByRole('button', { name: /show navigation/i })).toBeVisible();

        const collapsedMetrics = await page.evaluate(() => {
            const main = document.querySelector<HTMLElement>('main');
            const rect = main?.getBoundingClientRect();
            return {
                viewportHeight: window.innerHeight,
                documentWidth: document.documentElement.scrollWidth,
                mainHeight: rect?.height ?? 0
            };
        });

        expect(collapsedMetrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
        expect(collapsedMetrics.mainHeight).toBeGreaterThanOrEqual(collapsedMetrics.viewportHeight * 0.99);

        await page.getByRole('button', { name: /show navigation/i }).click();
        await expect(page.locator('#app-top-navigation')).toBeVisible();
    }
});

test('immersive navigation remains usable on a narrow phone viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/map');
    await page.waitForTimeout(1200);

    await expect(page.locator('#app-top-navigation')).toBeVisible();
    await expect(page.getByRole('button', { name: /hide navigation/i })).toBeVisible();

    const visibleMetrics = await page.evaluate(() => {
        const nav = document.querySelector<HTMLElement>('#app-top-navigation')?.getBoundingClientRect();
        const main = document.querySelector<HTMLElement>('main')?.getBoundingClientRect();
        return {
            viewportWidth: window.innerWidth,
            documentWidth: document.documentElement.scrollWidth,
            navBottom: nav?.bottom ?? -1,
            mainTop: main?.top ?? -2
        };
    });

    expect(visibleMetrics.documentWidth).toBeLessThanOrEqual(visibleMetrics.viewportWidth + 1);
    expect(Math.abs(visibleMetrics.navBottom - visibleMetrics.mainTop)).toBeLessThanOrEqual(2);

    await page.getByRole('button', { name: /hide navigation/i }).click();
    await expect(page.getByRole('button', { name: /show navigation/i })).toBeVisible();

    const collapsedMetrics = await page.evaluate(() => {
        const main = document.querySelector<HTMLElement>('main')?.getBoundingClientRect();
        return {
            viewportHeight: window.innerHeight,
            documentWidth: document.documentElement.scrollWidth,
            mainHeight: main?.height ?? 0,
            mainTop: main?.top ?? -1
        };
    });

    expect(collapsedMetrics.documentWidth).toBeLessThanOrEqual(visibleMetrics.viewportWidth + 1);
    expect(collapsedMetrics.mainTop).toBeLessThanOrEqual(1);
    expect(collapsedMetrics.mainHeight).toBeGreaterThanOrEqual(collapsedMetrics.viewportHeight * 0.99);

    await page.getByRole('button', { name: /show navigation/i }).click();
    await expect(page.locator('#app-top-navigation')).toBeVisible();
});

test('a hidden immersive navigation state does not leak into the next route visit', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/tournaments/1/workspace');
    await expect(page.locator('#app-top-navigation')).toBeVisible();

    await page.getByRole('button', { name: /hide navigation/i }).click();
    await expect(page.getByRole('button', { name: /show navigation/i })).toBeVisible();

    await page.getByRole('link', { name: /public tournament/i }).click();
    await expect(page).toHaveURL(/\/tournaments\/1$/);
    await expect(page.locator('#app-top-navigation')).toBeVisible();
    await expect(page.getByRole('button', { name: /show navigation/i })).toHaveCount(0);

    await page.getByRole('link', { name: /open workspace/i }).click();
    await expect(page).toHaveURL(/\/tournaments\/1\/workspace$/);
    await expect(page.locator('#app-top-navigation')).toBeVisible();
    await expect(page.getByRole('button', { name: /hide navigation/i })).toBeVisible();
});

}
