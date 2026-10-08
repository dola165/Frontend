import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const origin = 'http://127.0.0.1:5300';
const fixture = `${origin}/e2e/fixtures/club-overview.html`;
const output = 'review/club-overview-20260914';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, locale: 'en-GB' });
const page = await context.newPage();
const result = { checks: [], errors: [], unexpectedNetwork: [] };
page.on('pageerror', error => result.errors.push(error.message));
await context.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(origin) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    if (!/fonts\.(googleapis|gstatic)\.com/.test(url)) result.unexpectedNetwork.push(url);
    return route.abort();
});
const capture = async name => {
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
    result.checks.push(name);
};

try {
    await page.goto(fixture);
    await expect(page.getByText('3 outstanding', { exact: true })).toBeVisible();
    await capture('01-desktop');
    await page.getByRole('button', { name: /Overdue trial decisions/ }).click();
    await expect(page.getByLabel('Last preview action')).toHaveText('players:TRIALIST');
    await page.getByRole('button', { name: /Membership applications/ }).click();
    await expect(page.getByLabel('Last preview action')).toHaveText('tab:applications');
    await page.getByRole('button', { name: /Ana Kapanadze/ }).click();
    await expect(page.getByLabel('Last preview action')).toHaveText('players:ACTIVE');
    await page.getByRole('button', { name: 'Open U16 · Evening training in calendar', exact: true }).click();
    await expect(page.getByLabel('Last preview action')).toHaveText('calendar');
    result.checks.push('schedule-review-consent-navigation');
    for (const width of [1024, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await capture(`02-width-${width}`);
    }
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto(`${fixture}?lang=ka`);
    await expect(page.getByRole('heading', { name: 'კლუბის მიმოხილვა.' })).toBeVisible();
    await capture('03-georgian');
    await page.setViewportSize({ width: 390, height: 900 });
    await capture('04-georgian-mobile');
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto(`${fixture}?theme=light`);
    await expect(page.getByText('3 outstanding', { exact: true })).toBeVisible();
    await capture('05-light');
    await page.goto(`${fixture}?state=empty`);
    await expect(page.getByText('No decisions waiting', { exact: true })).toBeVisible();
    await expect(page.getByText('All current players checked.', { exact: true })).toBeVisible();
    await capture('06-empty');
    await page.goto(`${fixture}?state=partial`);
    await expect(page.getByText('3 found in checked players', { exact: true })).toBeVisible();
    await expect(page.getByText('Checked 48 of 168 current players. Open Players to review the rest.', { exact: true })).toBeVisible();
    await capture('07-partial-coverage');
    await page.goto(`${fixture}?state=error`);
    await expect(page.getByText('Could not check parent consent.', { exact: true })).toBeVisible();
    await capture('08-error');
    await page.getByRole('region', { name: 'Parent consent', exact: true }).getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(page.getByText('3 outstanding', { exact: true })).toBeVisible();
    await page.getByRole('region', { name: 'Coming up', exact: true }).getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(page.getByText('U16 · Evening training', { exact: true })).toBeVisible();
    result.checks.push('independent-retry');
    await page.goto(`${fixture}?role=coach`);
    await expect(page.getByRole('button', { name: 'Staff Roles and permissions', exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Parent consent' })).toBeVisible();
    await page.goto(`${fixture}?role=readonly`);
    await expect(page.getByRole('heading', { name: 'Parent consent' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Decisions & reviews' })).toHaveCount(0);
    result.checks.push('role-actions');
    expect(result.errors).toEqual([]);
    expect(result.unexpectedNetwork).toEqual([]);
} catch (error) {
    result.failed = String(error);
    await page.screenshot({ path: `${output}/failure.png`, fullPage: true });
    throw error;
} finally {
    await writeFile(`${output}/results.json`, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    await browser.close();
}
