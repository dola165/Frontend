import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const out = 'review/landing-refinement-20260913';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
 const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
 await page.goto(process.env.LANDING_BASE_URL || 'http://127.0.0.1:5187/');
 await page.waitForTimeout(4000);
 for (const width of [1600, 768, 390]) {
  await page.setViewportSize({ width, height: 1000 });
  await page.evaluate(() => scrollTo(0,0));
  await page.screenshot({ path: `${out}/entry-${width}.png` });
  await page.getByRole('button', { name: 'Open filters', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Find football clubs' });
  await expect(dialog).toBeVisible();
  await page.screenshot({ path: `${out}/filters-${width}.png` });
  console.log(width, 'dialog', await dialog.boundingBox(), 'rail', await page.getByLabel('Simple map filters').boundingBox());
  await page.keyboard.press('Escape');
  for (const [name, scene] of [['I want to play', 'player'], ['I run a club', 'club'], ['I love the game', 'supporter']]) {
   await page.getByRole('tab', { name }).click();
   await expect(page.locator(`[data-role-scene="${scene}"]`)).toBeVisible();
   await page.getByRole('tabpanel').scrollIntoViewIfNeeded();
   await page.waitForTimeout(650);
   await page.screenshot({ path: `${out}/${scene}-${width}.png` });
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 }
} finally { await browser.close(); }
