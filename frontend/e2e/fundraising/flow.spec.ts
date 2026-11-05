import { expect, test } from '@playwright/test';

for (const width of [390, 1440]) for (const theme of ['light', 'dark']) {
    test(`adult core flow at ${width}px in ${theme}`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 1000 });
        const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
        await page.goto(`/e2e/fundraising/index.html?theme=${theme}&long=1`);
        await expect(page.getByRole('heading', { name: 'Manage your appeal' })).toBeVisible();
        await expect(page.getByLabel('Title', { exact: true })).toBeVisible();
        await page.screenshot({ path: info.outputPath('manager.png'), fullPage: true });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect(await page.locator('.gk-appeal-manage .gk-btn').evaluateAll(nodes => nodes.every(n => n.getBoundingClientRect().height >= 44))).toBe(true);
        await page.getByRole('checkbox').check();
        await page.getByRole('button', { name: 'Publish', exact: true }).click();
        await page.getByRole('link', { name: 'View public page' }).click();
        await expect(page.getByText('Not reported yet')).toBeVisible();
        await expect(page.getByRole('link', { name: 'Ask the organizer how to give' })).toHaveAttribute('href', '/messages?chatWith=10');
        await expect(page.locator('a[href*="clubs/null"]')).toHaveCount(0);
        await page.screenshot({ path: info.outputPath('public.png'), fullPage: true });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.keyboard.press('Tab');
        expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('A');
        await page.getByRole('link', { name: 'Manage appeal', exact: true }).click();
        await page.getByLabel('Reported total (optional)').fill('50');
        await page.getByLabel('What this report covers').fill('Outside funds counted by me');
        await page.getByRole('button', { name: 'Save changes' }).click();
        await expect(page.getByLabel('Reported total (optional)')).toHaveValue('50');
        await page.getByLabel('Update title').fill('Kit ordered');
        await page.getByLabel('Message', { exact: true }).fill('The organizer has ordered the kit.');
        await page.getByRole('button', { name: 'Post update', exact: true }).click();
        await page.getByRole('button', { name: 'Pause', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Close appeal', exact: true }).click();
        await page.getByRole('link', { name: 'View public page' }).click();
        await expect(page.getByRole('button', { name: 'Closed', exact: true })).toBeDisabled();
        await expect(page.getByRole('link', { name: 'Ask the organizer how to give' })).toHaveCount(0);
        await expect(page.getByText('Kit ordered', { exact: true })).toBeVisible();
        await page.getByRole('link', { name: 'Manage appeal', exact: true }).click();
        await page.getByRole('button', { name: 'Take off the site' }).click();
        await expect(page.getByRole('link', { name: 'View public page' })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
        expect(errors).toEqual([]);
    });
}

test('temporary read failure and empty list have a useful recovery action', async ({ page }) => {
    await page.goto('/e2e/fundraising/index.html?error=1');
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Boots for my season' })).toBeVisible();
    await page.goto('/e2e/fundraising/index.html?empty=1');
    await expect(page.getByRole('link', { name: 'Start an appeal', exact: true })).toBeVisible();
});

test('an adult saves a new appeal and returns to its owned management record', async ({ page }) => {
    await page.goto('/e2e/fundraising/index.html?view=new');
    await page.getByLabel('Title', { exact: true }).fill('My football boots');
    await page.getByLabel('Short summary').fill('Support for my season');
    await page.getByLabel('Why you need support').fill('My boots have worn out.');
    await page.getByLabel('How the funds will be used').fill('Replacement boots');
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Manage your appeal' })).toBeVisible();
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('My football boots');
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled();
});
