import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const output = 'review/opportunities-design-20260913';
const origin = 'http://127.0.0.1:5298';
await mkdir(output, {recursive: true});
const browser = await chromium.launch({channel: 'chrome', headless: true});
const context = await browser.newContext({viewport: {width: 1600, height: 1060}});
const page = await context.newPage();
const results = {checks: [], errors: [], apiRequests: [], externalRequests: []};
page.on('pageerror', error => results.errors.push(error.message));
await context.route('**/*', route => {
    const url = route.request().url();
    if (url.includes('/api/')) {results.apiRequests.push(url); return route.abort();}
    if (!url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:')) {results.externalRequests.push(url); return route.abort();}
    return route.continue();
});
const tab = async name => page.locator(page.viewportSize().width <= 850 ? '.op-mobile-navigation' : '.op-sidebar nav').getByRole('button', {name, exact: true}).click();
const capture = async name => {
    await page.evaluate(() => window.scrollTo({top: 0, behavior: 'instant'}));
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path: `${output}/${name}.png`, fullPage: true});
    results.checks.push(name);
};
try {
    await page.goto(`${origin}/e2e/fixtures/opportunities-preview.html`);
    await expect(page.getByRole('heading', {name: 'Club store', exact: true})).toBeVisible();
    await expect(page.locator('.op-product-row')).toHaveCount(7);
    await capture('01-store-workspace');
    await page.getByRole('textbox', {name: 'Search store', exact: true}).fill('Scarf');
    await expect(page.locator('.op-product-row')).toHaveCount(1);
    await page.getByRole('button', {name: 'Clear search'}).click();
    await page.locator('.op-filter-tabs').getByRole('button', {name: /^Out of stock/}).click();
    await expect(page.locator('.op-product-row')).toHaveCount(2);
    await page.locator('.op-filter-tabs').getByRole('button', {name: /^All products/}).click();
    await page.getByRole('button', {name: 'Add product', exact: true}).click();
    await capture('02-store-editor-empty');
    await page.getByRole('button', {name: 'Use sample details'}).click();
    await page.getByLabel('Product name', {exact: true}).fill('Academy Away Shirt');
    await capture('03-store-details');
    await page.getByRole('button', {name: 'Continue', exact: true}).click();
    await page.getByLabel('Price per item', {exact: true}).fill('129');
    await expect(page.getByLabel('Variant 1', {exact: true})).toHaveValue('S');
    await capture('04-store-stock');
    await page.getByRole('button', {name: 'Continue', exact: true}).click();
    await page.getByRole('radio', {name: /Publish in the club store/}).check();
    await capture('05-store-review');
    await page.getByRole('button', {name: 'Save product', exact: true}).click();
    await expect(page.locator('.op-product-row').filter({hasText: 'Academy Away Shirt'})).toContainText('Published');
    await expect(page.getByRole('status')).toContainText('No server changes');

    await tab('Campaigns');
    await capture('06-campaigns-workspace');
    await page.getByRole('button', {name: 'Create campaign', exact: true}).click();
    await page.getByRole('button', {name: 'Use sample details'}).click();
    await page.getByLabel('Campaign title', {exact: true}).fill('Boots for our next generation');
    await capture('07-campaign-story');
    await page.getByRole('button', {name: 'Continue', exact: true}).click();
    await capture('08-campaign-goal');
    await page.getByRole('button', {name: 'Continue', exact: true}).click();
    await capture('09-campaign-review');
    await page.getByRole('button', {name: 'Save campaign', exact: true}).click();
    const campaign = page.locator('.op-campaign-row').filter({hasText: 'Boots for our next generation'});
    await expect(campaign).toContainText('Draft');
    await campaign.getByLabel('More actions for Boots for our next generation').click();
    await campaign.getByRole('button', {name: 'Publish campaign', exact: true}).click();
    await expect(campaign).toContainText('Active');

    await tab('Jobs');
    await capture('10-jobs-workspace');
    await page.getByRole('button', {name: 'Post job', exact: true}).click();
    await page.getByRole('button', {name: 'Use sample details'}).click();
    await page.getByLabel('Job title', {exact: true}).fill('U16 assistant coach');
    await capture('11-job-details');
    await page.getByRole('button', {name: 'Continue', exact: true}).click();
    await page.getByRole('combobox', {name: 'Age group', exact: true}).selectOption('U16');
    await capture('12-job-applications');
    await page.getByRole('button', {name: 'Continue', exact: true}).click();
    await capture('13-job-review');
    await page.getByRole('button', {name: 'Post job', exact: true}).click();
    await expect(page.locator('.op-job-row').filter({hasText: 'U16 assistant coach'})).toContainText('Open');

    await tab('Store');
    await page.getByRole('button', {name: 'Add product', exact: true}).click();
    await page.getByLabel('Product name', {exact: true}).fill('Unfinished shirt');
    await tab('Campaigns');
    await tab('Store');
    await expect(page.getByLabel('Product name', {exact: true})).toHaveValue('Unfinished shirt');
    await page.getByRole('button', {name: 'Back to products', exact: true}).click();
    await page.getByRole('button', {name: 'Keep editing', exact: true}).click();
    await expect(page.getByLabel('Product name', {exact: true})).toHaveValue('Unfinished shirt');
    await page.getByRole('button', {name: 'Back to products', exact: true}).click();
    await page.getByRole('button', {name: 'Discard changes', exact: true}).click();
    results.checks.push('filter-save-publish-and-draft-return');

    await page.setViewportSize({width: 390, height: 844});
    for (const name of ['Store', 'Campaigns', 'Jobs']) {
        await tab(name);
        await capture(`mobile-${name.toLowerCase()}-workspace`);
        await page.getByRole('button', {name: name === 'Store' ? 'Add product' : name === 'Campaigns' ? 'Create campaign' : 'Post job', exact: true}).click();
        await page.getByRole('button', {name: 'Use sample details'}).click();
        await capture(`mobile-${name.toLowerCase()}-editor`);
    }
    expect(results.errors).toEqual([]);
    expect(results.apiRequests).toEqual([]);
    expect(results.externalRequests).toEqual([]);
    await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
} catch(error) {
    await page.screenshot({path: `${output}/failure.png`, fullPage: true});
    await writeFile(`${output}/results.json`, JSON.stringify({...results, failure: String(error)}, null, 2));
    throw error;
} finally {await context.close(); await browser.close();}
