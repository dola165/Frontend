import { expect, test, type Page } from '@playwright/test';

const event = {
    eventId: 1, occurrenceId: 'training-1', clubId: 1, clubName: 'City Football Academy', userId: null,
    eventType: 'TRAINING', title: 'Evening training with the first team', description: 'Warm-up, passing drills and a small-sided game. Bring your boots and water.',
    startsAt: '2099-01-05T18:00:00', endsAt: '2099-01-05T19:30:00', locationName: 'Training pitch, south entrance',
    locationLat: null, locationLng: null, visibility: 'PRIVATE', publishAt: null, publicNow: false,
    recurring: false, recurrence: null, opponentClubId: null, opponentClubName: null, challengeStatus: null,
    status: 'SCHEDULED', conflict: false, conflictingEventIds: [],
};

async function fixture(page: Page, role: 'OWNER' | 'PLAYER' | null = 'OWNER') {
    await page.route(url => url.pathname.startsWith('/api/'), route => {
        const path = new URL(route.request().url()).pathname;
        const body = path.endsWith('/my-membership-context')
            ? { hasClubMembership: Boolean(role), canCreateClub: !role, clubId: role ? 1 : null, clubName: 'City Football Academy', myRole: role }
            : path.includes('/schedule/clubs/') ? { events: [event] }
            : path.endsWith('/schedule/me/events') ? { events: [{ ...event, occurrenceId: 'personal-1', clubId: null, title: 'Personal training plan' }] }
            : [];
        return route.fulfill({ json: body });
    });
    await page.route('https://tiles.openfreemap.org/**', route => route.abort());
    await page.goto('/e2e/fixtures/mobile-schedule.html');
}

async function noHorizontalOverflow(page: Page) {
    const sizes = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, agenda: document.querySelector('.mobile-schedule')?.scrollWidth ?? 0 }));
    expect(sizes.document).toBeLessThanOrEqual(sizes.viewport + 1);
    expect(sizes.agenda).toBeLessThanOrEqual(sizes.viewport + 1);
}

for (const width of [320, 390, 600]) {
    test(`agenda, filters and editor remain usable at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 740 });
        await fixture(page);
        await expect(page.getByRole('button', { name: /Evening training with/ })).toBeVisible();
        await expect(page.getByRole('separator', { name: 'Resize sidebar' })).toHaveCount(0);
        await noHorizontalOverflow(page);
        await page.screenshot({ path: `review/android-mobile-20260913/schedule-${width}.png` });
        await page.getByRole('button', { name: 'Filters', exact: true }).click();
        const filters = page.getByRole('dialog', { name: 'Filters & routines' });
        await expect(filters).toBeVisible();
        await filters.getByRole('checkbox', { name: 'Training', exact: true }).uncheck();
        await filters.getByRole('button', { name: 'Show schedule' }).click();
        await expect(page.getByText('No events match your filters')).toBeVisible();
        await page.getByRole('button', { name: 'Reset filters' }).click();
        await page.getByRole('button', { name: /Evening training with/ }).click();
        const editor = page.getByRole('dialog');
        await expect(editor).toBeVisible();
        await editor.getByRole('button', { name: /continue/i }).click();
        await expect(editor.locator('input[type="date"]')).toBeInViewport();
        await expect(editor.getByRole('button', { name: 'Choose location on map' })).toBeVisible();
        await expect(editor.locator('.maplibregl-map')).toHaveCount(0);
        const sizes = await editor.evaluate(element => ({ width: element.clientWidth, scroll: element.scrollWidth, height: element.getBoundingClientRect().height, viewport: innerHeight }));
        expect(sizes.scroll).toBeLessThanOrEqual(sizes.width + 1);
        expect(sizes.height).toBeLessThanOrEqual(sizes.viewport + 1);
        await expect(editor.getByRole('button', { name: /continue/i })).toBeInViewport();
        await page.screenshot({ path: `review/android-mobile-20260913/schedule-editor-${width}.png` });
    });
}

test('club members get full read-only details, while personal event creation stays available', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 740 });
    await fixture(page, 'PLAYER');
    await page.getByRole('button', { name: 'Club schedule', exact: true }).click();
    await expect(page.getByRole('button', { name: 'New event' })).toHaveCount(0);
    await page.getByRole('button', { name: /Evening training with/ }).click();
    await expect(page.getByRole('dialog')).toContainText(event.description);
    await expect(page.getByRole('dialog').getByRole('button', { name: /save|continue/i })).toHaveCount(0);
    await page.getByRole('button', { name: 'Close event details' }).click();
    await page.getByRole('button', { name: 'My schedule', exact: true }).click();
    await expect(page.getByRole('button', { name: 'New event' })).toBeVisible();
});

test('desktop keeps its resizable calendar, then switches to agenda on a narrow window', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await fixture(page);
    await expect(page.getByRole('separator', { name: 'Resize sidebar' })).toBeVisible();
    await expect(page.locator('.mobile-schedule')).toHaveCount(0);
    await page.screenshot({ path: 'review/android-mobile-20260913/schedule-desktop.png' });
    await page.setViewportSize({ width: 390, height: 740 });
    await expect(page.getByRole('button', { name: 'Agenda', exact: true })).toBeVisible();
    await expect(page.getByRole('separator', { name: 'Resize sidebar' })).toHaveCount(0);
    await noHorizontalOverflow(page);
});

test('long club names and larger text wrap without pushing actions out of the phone', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await fixture(page);
    await expect(page.locator('.mobile-schedule')).toBeVisible();
    await page.locator('.mobile-schedule').evaluate(element => {
        const elements = Array.from(element.querySelectorAll<HTMLElement>('*'));
        const textElements = elements.filter(node => Array.from(node.childNodes).some(child => child.nodeType === Node.TEXT_NODE && child.textContent?.trim()));
        const sizes = textElements.map(node => Number.parseFloat(getComputedStyle(node).fontSize));
        textElements.forEach((node, index) => { node.style.fontSize = `${sizes[index] * 1.3}px`; });
    });
    await noHorizontalOverflow(page);
    await expect(page.getByRole('button', { name: 'New event' })).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Filters', exact: true })).toBeInViewport();
    await page.screenshot({ path: 'review/android-mobile-20260913/schedule-large-text-320.png' });
});

test('short Android-sized content scrolls controls away so the whole event can be read', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 437 });
    await fixture(page);
    await expect(page.getByRole('heading', { name: 'City Football Academy', exact: true })).toBeVisible();
    await expect(page.getByText('Your time, in one place')).toHaveCount(0);
    const surface = page.locator('.mobile-schedule');
    const headerHeight = await page.locator('.mobile-schedule-header').evaluate(element => element.getBoundingClientRect().height);
    expect(headerHeight).toBeLessThan(235);
    await noHorizontalOverflow(page);
    const minimumTarget = await surface.locator('header button').evaluateAll(elements => Math.min(...elements.map(element => element.getBoundingClientRect().height)));
    expect(minimumTarget).toBeGreaterThanOrEqual(44);
    await surface.evaluate(element => { element.scrollTop = element.scrollHeight; });
    await expect(page.getByText('View or edit event', { exact: true })).toBeInViewport();
    await expect(page.getByRole('button', { name: /Evening training with/ })).toBeInViewport({ ratio: 1 });
    const headerTop = await page.locator('.mobile-schedule-header').evaluate(element => element.getBoundingClientRect().top);
    expect(headerTop).toBeLessThan(-60);
    await page.screenshot({ path: 'review/android-mobile-20260913/schedule-short-android-scrolled.png' });
});
