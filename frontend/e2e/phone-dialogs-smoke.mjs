import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const baseUrl = process.env.PHONE_QA_BASE_URL || 'http://127.0.0.1:5187';
const output = 'review/mobile-dialogs';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const layouts = [];
try {
    for (const [width, height] of [[390, 550], [360, 430], [800, 240]]) {
        await page.setViewportSize({ width, height });
        await page.goto(`${baseUrl}/e2e/fixtures/phone-dialogs.html`);
        const details = page.locator('.post-theater-details');
        await expect(details).toBeVisible();
        await expect(page.getByRole('button', { name: 'Next post media' })).toBeInViewport({ ratio: 1 });
        const geometry = await details.evaluate(el => ({ height: el.clientHeight, content: el.scrollHeight, right: el.getBoundingClientRect().right, bottom: el.getBoundingClientRect().bottom }));
        expect(geometry.height).toBeGreaterThan(80);
        expect(geometry.content).toBeGreaterThan(geometry.height);
        expect(geometry.right).toBeLessThanOrEqual(width);
        expect(geometry.bottom).toBeLessThanOrEqual(height);
        await details.evaluate(el => { el.scrollTop = el.scrollHeight; });
        const comment = page.getByRole('textbox', { name: "Write a comment on Phone test player's post" });
        await expect(comment).toBeInViewport({ ratio: 1 });
        await comment.fill('Works on a phone');
        await page.getByRole('button', { name: 'Post comment', exact: true }).click();
        await expect(comment).toHaveValue('');
        await page.screenshot({ path: `${output}/post-${width}x${height}.png` });
        await page.getByRole('button', { name: 'Close post viewer' }).click();
        await expect(page.getByRole('dialog')).toHaveCount(0);

        await page.goto(`${baseUrl}/e2e/fixtures/phone-dialogs.html?view=cropper`);
        const crop = page.getByRole('dialog', { name: 'Crop profile photo' });
        await expect(crop).toBeInViewport({ ratio: 1 });
        await expect(page.getByRole('button', { name: 'Apply Crop' })).toBeInViewport({ ratio: 1 });
        await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeInViewport({ ratio: 1 });
        await expect(page.getByRole('button', { name: 'Apply Crop' })).toBeEnabled();
        const cropBounds = await crop.boundingBox();
        expect(cropBounds.height).toBeLessThanOrEqual(height - 32);
        await page.screenshot({ path: `${output}/crop-${width}x${height}.png` });
        await page.getByRole('button', { name: 'Apply Crop' }).click();
        await expect(page.getByText('Crop applied', { exact: true })).toBeVisible();
        layouts.push({ width, height, longPostCommentsReachable: true, cropActionsVisible: true, geometry, cropBounds });
    }
    expect(errors).toEqual([]);
    await writeFile(`${output}/results.json`, JSON.stringify({ layouts, errors }, null, 2));
    console.log('PASS: long post comments and crop actions on portrait and short landscape phones');
} finally {
    await browser.close();
}
