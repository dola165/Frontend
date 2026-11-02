// Synthetic browser checks of the real competition pages. This is not backend/DB evidence.
// Start sandbox/server.mjs 4318 and sandbox/web.mjs 4318 5188 first.
// Run: node sandbox/competitions-foundation-qa.mjs <private-evidence-directory> [base-url]
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tournamentById, tournamentDetail } from './api/world-football.mjs';

const output = process.argv[2];
if (!output || !path.isAbsolute(output)) throw new Error('Supply an absolute private evidence directory.');
const base = process.argv[3] || 'http://localhost:5188';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error('Local synthetic server only.');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const report = [];
try {
  for (const theme of ['light', 'dark']) for (const width of [1920, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1080 }, locale: 'en-GB', timezoneId: 'Asia/Tbilisi', colorScheme: theme });
    await context.addInitScript(theme => {
      localStorage.setItem('theme-preference', theme); localStorage.setItem('i18nextLng', 'en');
      const b64 = value => btoa(JSON.stringify(value)).replaceAll('=', '').replaceAll('+', '-').replaceAll('/', '_');
      const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: '1', exp: 4102444800 })}.sandbox`;
      localStorage.setItem('gk-session-id', 'competitions-synthetic');
      localStorage.setItem('gk-session-token:competitions-synthetic', token); localStorage.setItem('accessToken', token);
    }, theme);
    const page = await context.newPage();
    const entry = { theme, width, captures: [], failures: [], commands: [], externalBlocked: 0 };
    page.on('pageerror', error => entry.failures.push(error.message));
    let detail = structuredClone(tournamentDetail(tournamentById(301)));
    let revision = 3;
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== base) { entry.externalBlocked++; return route.abort(); }
      const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      if (url.pathname === '/api/tournaments/301' && request.method() === 'GET') return json(detail);
      if (url.pathname === '/api/competitions/301/rules') {
        const response = await route.fetch(); const profile = await response.json(); return json({ ...profile, revision });
      }
      if (url.pathname === '/api/tournaments/301/guest-entries') {
        const { name } = request.postDataJSON();
        detail.entries.push({ id: 90001, displayName: name, status: 'PENDING', clubId: null, squadId: null, userId: null });
        return json(detail);
      }
      if (url.pathname === '/api/competitions/301/fixtures/result') {
        const command = request.postDataJSON(); entry.commands.push(command);
        assert.equal(command.revision, revision); assert.ok(command.requestId); assert.ok(command.reason);
        const fixture = detail.fixtures.find(value => value.id === command.fixtureId);
        assert.ok(fixture);
        if (command.action === 'CORRECT') {
          assert.equal(command.winnerEntryId, null); fixture.homeScore = command.homeScore; fixture.awayScore = command.awayScore;
          fixture.winnerEntryId = command.homeScore === command.awayScore ? null : command.homeScore > command.awayScore ? fixture.homeEntryId : fixture.awayEntryId;
        } else if (command.action === 'CANCEL') {
          assert.equal(command.homeScore, null); assert.equal(command.awayScore, null); fixture.status = 'CANCELLED';
        } else throw new Error(`Unexpected synthetic action ${command.action}`);
        revision++;
        return json(detail);
      }
      return route.continue();
    });
    async function capture(name) {
      await page.screenshot({ path: path.join(output, `${name}-${width}-${theme}.png`), fullPage: true });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      assert.equal(overflow, false, `${name}: viewport overflow`);
      entry.captures.push(name);
    }
    await page.goto(`${base}/tournaments/301`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Tbilisi Community League', exact: true })).toBeVisible();
    await capture('public');
    detail.status = 'PLANNING';
    await page.goto(`${base}/tournaments/301/workspace?view=participants`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Add participants', exact: true }).click();
    await page.getByLabel('Club or team name', { exact: true }).fill('Synthetic occasional visitors');
    await page.getByRole('button', { name: 'Add guest club', exact: true }).click();
    await expect(page.getByText('Synthetic occasional visitors added. Review eligibility before confirming the entry.', { exact: true })).toBeVisible();
    await capture('pending-guest');
    detail.status = 'ACTIVE';
    const fixture = detail.fixtures.find(value => value.status === 'COMPLETED');
    await page.goto(`${base}/tournaments/301/workspace?view=schedule&fixtureId=${fixture.id}`, { waitUntil: 'networkidle' });
    const dialog = page.getByRole('dialog', { name: 'Match details', exact: true });
    await expect(dialog).toBeVisible();
    assert.ok(await dialog.evaluate(element => element.contains(document.activeElement)), 'Dialog receives keyboard focus');
    await page.keyboard.press('Shift+Tab');
    assert.ok(await dialog.evaluate(element => element.contains(document.activeElement)), 'Dialog keeps keyboard focus');
    const goals = dialog.getByLabel(/^Goals for/);
    await goals.nth(0).fill('0'); await goals.nth(1).fill('9');
    await dialog.getByLabel('Reason or result note').fill('Synthetic organiser checked the original score sheet');
    await dialog.getByRole('button', { name: 'Save score correction', exact: true }).click();
    await expect(dialog.getByText('Saved. The competition is up to date.', { exact: true })).toBeVisible();
    assert.equal(fixture.winnerEntryId, fixture.awayEntryId);
    await capture('changed-winner');
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(page).not.toHaveURL(/fixtureId/);
    await capture('matchday-return');
    assert.equal(entry.commands.length, 1);
    report.push(entry);
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2));
}
assert.ok(report.every(entry => !entry.failures.length), JSON.stringify(report));
console.log(JSON.stringify(report, null, 2));
