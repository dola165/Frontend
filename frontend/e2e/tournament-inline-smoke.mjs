import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const origin = 'http://127.0.0.1:5186';
const fixture = `${origin}/e2e/fixtures/tournament-preview.html`;
const out = 'review/tournament-redesign-20260915/inline';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'en-GB', reducedMotion: 'reduce' });
const page = await context.newPage();
page.setDefaultTimeout(10000);
const result = { passed: false, checks: [], errors: [], unexpectedNetwork: [], unexpectedAdapter: [] };
page.on('pageerror', error => result.errors.push(error.message));
await context.route('**/*', route => {
    const url = route.request().url();
    if (!url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:')) {
        if (!/fonts\.(googleapis|gstatic)\.com/.test(url)) result.unexpectedNetwork.push(url);
        return route.abort();
    }
    if (new URL(url).pathname.startsWith('/api/')) { result.unexpectedNetwork.push(url); return route.abort(); }
    return route.continue();
});
const check = name => result.checks.push(name);
const capture = async name => {
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
    check(name);
};
const adapterCheck = async () => {
    const unexpected = await page.evaluate(() => window.tournamentPreview.unexpected);
    result.unexpectedAdapter.push(...unexpected);
    expect(unexpected).toEqual([]);
};
const goto = async (query = '') => {
    await page.goto(fixture + query);
    await page.getByRole('heading', { name: 'Horizon Community Cup', exact: true }).waitFor();
    await expect(page.getByRole('img', { name: 'Grasskickz', exact: true })).toBeVisible();
    await expect(page.locator('.tpreview-header, .tpreview-toolbar')).toHaveCount(0);
};
const button = (name, scope = page) => scope.getByRole('button', { name, exact: typeof name === 'string' });
const card = id => page.locator(`.tw-bracket [data-fixture-id="${id}"]`);
const snapshot = () => page.evaluate(() => window.tournamentPreview.snapshot());
const savedMatch = id => page.evaluate(id => window.tournamentPreview.snapshot().fixtures.find(item => item.id === id), id);

try {
    await goto('?tab=bracket');
    await expect(page.locator('nav.tw-tabs button')).toHaveCount(2);
    await expect(button('Settings')).toHaveCount(0);
    await expect(button(/^Matches & results/)).toHaveCount(0);
    await expect(button('Edit tournament')).toBeVisible();
    await capture('real-shell-planning-desktop');
    check('actual-app-navigation-and-two-workspace-tabs');
    if (!process.argv.includes('--shell-only')) {
        await button('Edit tournament').click();
        const dialog = page.getByRole('dialog');
        await dialog.getByRole('textbox', { name: 'About the tournament', exact: true }).fill('Community football organized by Horizon Health.');
        await capture('edit-tournament-dialog-desktop');
        await button('Save changes', dialog).click();
        await expect.poll(async () => (await snapshot()).description).toBe('Community football organized by Horizon Health.');
        if (await dialog.count()) await button('Close tournament editor', dialog).click();
        check('edit-tournament-from-header');
        await button(/^Participants/).click();
        await button('Add participants').click();
        await page.getByRole('textbox', { name: 'Club or team name' }).fill('Avlabari Friends');
        await button('Add guest club').click();
        await expect(page.locator('.tw-entry-row').filter({ hasText: 'Avlabari Friends' })).toBeVisible();
        await page.locator('.tw-entry-row').filter({ hasText: 'Old Tbilisi FC' }).getByRole('button', { name: 'Confirm', exact: true }).click();
        const guest = (await snapshot()).entries.find(entry => entry.displayName === 'Avlabari Friends');
        expect([guest.clubId, guest.userId, guest.draftTeamId]).toEqual([null, null, null]);
        check('name-only-guest-and-pending-confirmation');
        await button('Bracket').click();
        const board = page.locator('.tw-bracket:visible');
        await board.locator('.tw-team-pool').getByRole('button', { name: /^Dighomi Rangers/ }).dragTo(button(/Open spot.*R1 Match 3 top spot/, board));
        await expect.poll(async () => (await savedMatch(103)).homeEntryId).toBe(5);
        await button(/Saburtalo United.*R1 Match 1 top spot/, board).dragTo(button(/Riverbank FC.*R1 Match 1 bottom spot/, board));
        await expect.poll(async () => (await savedMatch(101)).homeEntryId).toBe(2);
        check('native-guest-placement-and-opponent-swap');
        await button(/Vake Athletic.*R1 Match 2 top spot/, board).click();
        await button(/^Saburtalo United/, page.getByRole('dialog')).click();
        await expect.poll(async () => (await savedMatch(102)).homeEntryId).toBe(1);
        check('button-placement-and-cross-match-swap');
        await button('Place teams for me').click();
        await expect.poll(async () => (await snapshot()).fixtures.filter(item => item.roundNumber === 1).flatMap(item => [item.homeEntryId, item.awayEntryId]).filter(Boolean).length).toBe(8);
        await adapterCheck();

        await goto('?active=1&tab=bracket');
        const first = card(101);
        await expect(first.getByLabel('Score for Saburtalo United', { exact: true })).toBeVisible();
        await first.getByLabel('Score for Saburtalo United', { exact: true }).fill('2');
        await first.getByLabel('Score for Riverbank FC', { exact: true }).fill('1');
        await button('Add goal for Saburtalo United', first).click();
        await expect(first.getByLabel('Score for Saburtalo United', { exact: true })).toHaveValue('3');
        await button('Save score', first).click();
        await expect.poll(async () => (await savedMatch(101)).homeScore).toBe(3);
        expect((await savedMatch(101)).status).toBe('SCHEDULED');
        check('inline-score-typing-plus-save-without-advancing');
        await first.getByLabel('Score for Saburtalo United', { exact: true }).fill('4');
        await page.evaluate(() => window.tournamentPreview.failNext('PATCH', '/tournaments/42/fixtures/101/scores', 'Score could not be saved. Please try again.'));
        await button('Save score', first).click();
        await expect(page.getByText('Score could not be saved. Please try again.', { exact: true })).toBeVisible();
        await expect(first.getByLabel('Score for Saburtalo United', { exact: true })).toHaveValue('4');
        expect((await savedMatch(101)).homeScore).toBe(3);
        await capture('inline-score-failure-retained');
        await button('Save score', first).click();
        await expect.poll(async () => (await savedMatch(101)).homeScore).toBe(4);
        check('failed-score-preserves-draft-and-retries');
        await page.evaluate(() => window.tournamentPreview.failNext('POST', '/tournaments/42/fixtures/101/complete', 'Winner could not be advanced. Please try again.'));
        await button('Advance Saburtalo United', first).click();
        await expect(page.getByText('Winner could not be advanced. Please try again.', { exact: true })).toBeVisible();
        expect((await savedMatch(101)).status).toBe('SCHEDULED');
        expect((await savedMatch(105)).homeEntryId).toBe(null);
        await expect(first.getByLabel('Score for Saburtalo United', { exact: true })).toHaveValue('4');
        await button('Advance Saburtalo United', first).click();
        await expect.poll(async () => (await savedMatch(101)).status).toBe('COMPLETED');
        await expect.poll(async () => (await savedMatch(105)).homeEntryId).toBe(1);
        check('advance-button-failure-retention-and-retry');
        const second = card(102);
        await second.getByLabel('Score for Vake Athletic', { exact: true }).fill('2');
        await second.getByLabel('Score for Horizon Medics', { exact: true }).fill('0');
        await button(/Vake Athletic.*R1 Match 2 HOME/, board).dragTo(button(/Winner of R1.*Match 2.*R2 Match 1 AWAY/, board));
        await expect.poll(async () => (await savedMatch(102)).status).toBe('COMPLETED');
        await expect.poll(async () => (await savedMatch(105)).awayEntryId).toBe(3);
        check('legal-winner-drag-completes-source-and-advances');
        expect((await savedMatch(106)).homeEntryId).toBe(null);
        expect((await savedMatch(107)).homeEntryId).toBe(null);
        await expect(card(106).locator('input')).toHaveCount(0);
        await expect(card(107).locator('input')).toHaveCount(0);
        await capture('inline-results-and-pending-rounds-desktop');
        const beforeInvalidDrop = (await savedMatch(103));
        await button(/Dighomi Rangers.*R1 Match 3 HOME/, board).dragTo(button(/Saburtalo United.*R2 Match 1 HOME/, board));
        expect(await savedMatch(103)).toEqual(beforeInvalidDrop);
        expect((await savedMatch(105)).homeEntryId).toBe(1);
        check('unrelated-winner-drop-does-not-change-bracket');
        await button('Advance Dighomi Rangers', card(103)).click();
        await button('Advance Avlabari Friends', card(104)).click();
        await button('Advance Saburtalo United', card(105)).click();
        await button('Advance Dighomi Rangers', card(106)).click();
        await expect(card(107).getByLabel('Score for Saburtalo United', { exact: true })).toBeVisible();
        await card(107).getByLabel('Score for Saburtalo United', { exact: true }).fill('3');
        await card(107).getByLabel('Score for Dighomi Rangers', { exact: true }).fill('2');
        await button('Declare Saburtalo United winner', card(107)).click();
        await expect.poll(async () => (await savedMatch(107)).winnerEntryId).toBe(1);
        await button('Finish tournament').click();
        await button('Confirm', page.getByRole('dialog')).click();
        await expect.poll(async () => (await snapshot()).status).toBe('COMPLETED');
        check('semifinals-final-champion-and-finish');
        await capture('complete-bracket-desktop');
        await adapterCheck();

        await goto('?empty=1&tab=bracket');
        await button('Create your draw').click();
        await page.getByLabel('Draw name (optional)', { exact: true }).fill('Community knockout');
        await button('Create draw', page.getByRole('dialog')).click();
        await expect.poll(async () => (await snapshot()).fixtures.length).toBe(7);
        check('create-draw-from-empty-workspace');
        await capture('new-draw-desktop');
        await adapterCheck();
    }

    for (const width of [390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        for (const language of ['en', 'ka']) {
            for (const theme of ['dark', 'light']) {
                await goto(`?active=1&tab=bracket&lang=${language}&theme=${theme}`);
                await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(theme === 'dark');
                await capture(`real-shell-inline-${language}-${theme}-${width}`);
                await card(101).scrollIntoViewIfNeeded();
                if (language === 'en') {
                    await button('Add goal for Saburtalo United', card(101)).click();
                    await expect(card(101).getByLabel('Score for Saburtalo United', { exact: true })).toHaveValue('1');
                    await button('Save score', card(101)).click();
                    await expect.poll(async () => (await savedMatch(101)).homeScore).toBe(1);
                }
                await capture(`mobile-score-controls-${language}-${theme}-${width}`);
                await adapterCheck();
            }
        }
        await goto('?tab=bracket&theme=light');
        await button('Edit tournament').click();
        await capture(`edit-tournament-dialog-light-${width}`);
        await button('Close tournament editor', page.getByRole('dialog')).click();
        await button(/^Participants/).click();
        await button('Add participants').click();
        await capture(`guest-editor-light-${width}`);
        await adapterCheck();
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await goto('?active=1&tab=bracket');
    await button('Open menu').click();
    await page.getByRole('menuitemradio', { name: /Light/ }).click();
    await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(false);
    await button('Close menu').click();
    await capture('real-app-theme-control-light');
    check('real-app-theme-menu-updates-tournament');

    for (const language of ['en', 'ka']) {
        await page.setViewportSize({ width: language === 'en' ? 1440 : 390, height: 1000 });
        await goto(`?view=public&results=1&lang=${language}&theme=${language === 'en' ? 'dark' : 'light'}`);
        const publicCalls = await page.evaluate(() => window.tournamentPreview.requests);
        expect(publicCalls.every(request => request.path === '/tournaments/42')).toBe(true);
        await expect(page.locator('.tw-bracket input')).toHaveCount(0);
        await capture(`actual-shell-public-${language}`);
        check(`anonymous-read-only-bracket-${language}`);
        await adapterCheck();
    }
    expect(result.errors).toEqual([]);
    expect(result.unexpectedNetwork).toEqual([]);
    expect(result.unexpectedAdapter).toEqual([]);
    result.passed = true;
    console.log(JSON.stringify({ passed: true, checkpoints: result.checks.length }));
} catch (error) {
    result.failure = error.message;
    await page.screenshot({ path: `${out}/failure.png`, fullPage: true });
    console.error(error);
    process.exitCode = 1;
} finally {
    await writeFile(`${out}/results.json`, JSON.stringify(result, null, 2));
    await browser.close();
}
