// Read-only release verification. Requires an explicit named local build.
// Example: node e2e/tournament-public-release.mjs --build dist/RELEASE_NAME
import { chromium, expect } from '@playwright/test';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const argument = (name, fallback) => {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : fallback;
};
const build = argument('--build');
if (!build) throw new Error('Pass --build with the exact deployed named build directory.');
const root = argument('--origin', 'https://app.grasskickz.com').replace(/\/$/, '');
const out = argument('--out', 'review/tournament-redesign-20260915/public-release');
await mkdir(out, { recursive: true });
const report = { passed: false, root, build: resolve(build), hashes: {}, protectedRoutes: [], publicTournament: null, pageErrors: [], blockedMutations: [], blockedTelemetry: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
let page;
try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'en-GB', reducedMotion: 'reduce' });
    await context.route('**/*', route => {
        if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) {
            const request = { method: route.request().method(), url: route.request().url() };
            if (new URL(request.url).pathname === '/cdn-cgi/rum') report.blockedTelemetry.push(request);
            else report.blockedMutations.push(request);
            return route.abort();
        }
        return route.continue();
    });
    await context.addInitScript(() => {
        localStorage.setItem('i18nextLng', 'en');
        localStorage.setItem('theme-preference', 'dark');
        // Explicit anonymous session in this fresh isolated browser profile.
        localStorage.setItem('gk-session-id', 'public-release-anonymous');
    });
    const manifest = JSON.parse(await readFile(`${build}/.vite/manifest.json`, 'utf8'));
    const files = new Set(['index.html']);
    const visited = new Set();
    const collect = key => {
        if (visited.has(key)) return;
        visited.add(key);
        const item = manifest[key];
        if (!item) throw new Error(`Missing build entry: ${key}`);
        files.add(item.file);
        (item.css ?? []).forEach(file => files.add(file));
        (item.imports ?? []).forEach(collect);
    };
    ['index.html', 'src/pages/TournamentWorkspacePage.tsx', 'src/pages/TournamentSetupPage.tsx', 'src/pages/TournamentDetailPage.tsx', 'src/pages/BrowseTournamentsPage.tsx'].forEach(collect);
    // Scoped releases re-export the three routes through a new shared overlay.
    // Those direct imports and the added stylesheet are outside the baseline
    // Vite manifest, so include them explicitly in the byte comparison.
    for (const file of await readdir(`${build}/assets`)) {
        if (/^tournament-routes.*\.(js|css)$/.test(file)) files.add(`assets/${file}`);
    }
    const hash = bytes => createHash('sha256').update(bytes).digest('hex');
    for (const file of files) {
        const response = await context.request.get(`${root}/${file}`);
        expect(response.status()).toBe(200);
        const served = await response.body();
        const local = await readFile(`${build}/${file}`);
        report.hashes[file] = hash(served);
        if (file === 'index.html') {
            // Cloudflare can inject its analytics script into HTML. Match the
            // exact ordered release assets, as the production publish check
            // does; every referenced release asset is still byte-verified.
            const assetReferences = bytes => [...bytes.toString('utf8').matchAll(/(?:src|href)="(\/assets\/[^" ]+)"/g)].map(match => match[1]);
            expect(assetReferences(served)).toEqual(assetReferences(local));
            report.html = { localSha256: hash(local), servedSha256: hash(served), exactBytes: hash(local) === hash(served), releaseAssetReferences: assetReferences(served) };
        } else expect(report.hashes[file]).toBe(hash(local));
    }
    page = await context.newPage();
    page.on('pageerror', error => report.pageErrors.push(error.message));
    if (process.argv.includes('--legacy-label-only')) {
        const response = await context.request.get(`${root}/api/tournaments/${argument('--tournament', '1')}`);
        expect(response.status()).toBe(200);
        const detail = await response.json();
        await page.goto(`${root}/tournaments/${detail.id}`);
        await expect(page.getByRole('heading', { name: detail.name, exact: true })).toBeVisible();
        const legacyStages = detail.stages.filter(stage => stage.stageType === 'KNOCKOUT' && detail.fixtures.some(fixture => fixture.stageId === stage.id) && detail.fixtures.filter(fixture => fixture.stageId === stage.id).every(fixture => fixture.roundNumber == null));
        expect(legacyStages.length).toBeGreaterThan(0);
        for (const stage of legacyStages) {
            await page.getByRole('combobox', { name: 'Stage', exact: true }).selectOption(String(stage.id));
            await expect(page.locator('.tw-round h3')).toHaveText(stage.name);
        }
        await page.getByRole('combobox', { name: 'Stage', exact: true }).selectOption(String(legacyStages[0].id));
        await page.screenshot({ path: `${out}/legacy-stage-desktop.png`, fullPage: true });
        await page.setViewportSize({ width: 390, height: 844 });
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: `${out}/legacy-stage-mobile.png`, fullPage: true });
        report.publicTournament = { id: detail.id, legacyStageNames: legacyStages.map(stage => stage.name), labelCheckOnly: true };
    } else {
    await page.goto(`${root}/tournaments`);
    await expect(page.getByRole('heading', { name: 'Find your next competition', exact: true })).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `${out}/tournaments-desktop.png`, fullPage: true });
    for (const route of ['/tournaments/setup', '/tournaments/1/workspace']) {
        await page.goto(root + route);
        await expect(page).toHaveURL(/\/login\?next=/);
        report.protectedRoutes.push(route);
    }
    const listing = await context.request.get(`${root}/api/tournaments?page=0&size=10`);
    expect(listing.status()).toBe(200);
    const summaries = (await listing.json()).content ?? [];
    const requested = argument('--tournament');
    const candidates = requested ? [{ id: Number(requested) }] : summaries;
    const accessible = [];
    for (const candidate of candidates) {
        const response = await context.request.get(`${root}/api/tournaments/${candidate.id}`);
        if (response.status() !== 200) continue;
        const detail = await response.json();
        if (detail.visibility !== 'PUBLIC') continue;
        accessible.push(detail);
    }
    const detail = accessible.find(item => item.fixtures.length > 0 && item.stages.some(stage => stage.stageType === 'KNOCKOUT')) ?? accessible[0];
    if (detail) {
        await page.goto(`${root}/tournaments/${detail.id}`);
        await expect(page.locator('.tournament-public-page')).toBeVisible();
        await expect(page.getByRole('heading', { name: detail.name, exact: true })).toBeVisible();
        await expect(page.getByRole('tab', { name: 'Bracket', exact: true })).toHaveAttribute('aria-selected', 'true');
        const knockout = detail.stages.find(stage => stage.stageType === 'KNOCKOUT' && detail.fixtures.some(fixture => fixture.stageId === stage.id));
        if (knockout && detail.stages.length > 1) await page.getByRole('combobox', { name: 'Stage', exact: true }).selectOption(String(knockout.id));
        if (knockout) await expect(page.locator('.tw-bracket .tw-match-card').first()).toBeVisible();
        await page.getByRole('button', { name: 'Refresh results', exact: true }).click();
        await expect(page.getByText('Results are up to date.', { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Refresh results', exact: true })).toBeEnabled();
        if (knockout) await expect(page.locator('.tw-bracket .tw-match-card').first()).toBeVisible();
        await expect(page.getByRole('heading', { name: detail.name, exact: true })).toBeVisible();
        await page.screenshot({ path: `${out}/tournament-public-desktop.png`, fullPage: true });
        await page.setViewportSize({ width: 390, height: 844 });
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: `${out}/tournament-public-mobile.png`, fullPage: true });
        report.publicTournament = { id: detail.id, stageCount: detail.stages.length, fixtureCount: detail.fixtures.length, entryCount: detail.entries.length, bracketStageId: knockout?.id ?? null, refreshSucceeded: true };
    }
    }
    if (!report.publicTournament) throw new Error('No accessible public tournament was available for a rendering check. No live sample was created.');
    expect(report.pageErrors).toEqual([]);
    expect(report.blockedMutations).toEqual([]);
    report.passed = true;
    console.log(JSON.stringify({ passed: true, verifiedAssets: files.size, publicTournament: report.publicTournament, pageErrors: report.pageErrors }));
} catch (error) {
    report.failure = error.message;
    if (page) {
        report.failureUrl = page.url();
        report.failureHeadings = await page.getByRole('heading').allTextContents();
        await page.screenshot({ path: `${out}/failure.png`, fullPage: true });
    }
    throw error;
} finally {
    await writeFile(`${out}/results.json`, JSON.stringify(report, null, 2));
    await browser.close();
}
