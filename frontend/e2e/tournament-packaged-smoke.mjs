// Actual production output and real App shell; HTTP responses stay in this test.
import { chromium, expect } from '@playwright/test';
import { AxiosError } from 'axios';
import ts from 'typescript';
import vm from 'node:vm';
import http from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const argument = (name, fallback) => {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : fallback;
};
const build = argument('--build');
if (!build) throw new Error('Pass --build with the scoped candidate output directory.');
const buildRoot = resolve(build);
const port = Number(argument('--port', '5187'));
const origin = `http://127.0.0.1:${port}`;
const out = argument('--out', 'review/tournament-redesign-20260915/packaged');
await mkdir(out, { recursive: true });

// Reuse the exact in-memory API fixture while exercising real packaged HTTP
// clients. React/UI/bootstrap imports are intentionally outside this prefix.
const fixtureSource = await readFile('e2e/fixtures/tournament-preview.tsx', 'utf8');
const prefix = fixtureSource.slice(0, fixtureSource.indexOf('async function bootstrap()'));
const dataScript = ts.transpileModule(prefix, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace(/^import[^;]*;\s*/gm, '').replace(/^export\s*\{\s*\};?\s*/gm, '');
const runtime = search => {
    const axios = { defaults: {} };
    const window = {};
    vm.runInNewContext(dataScript, { axios, AxiosError, window, location: { search, origin }, URL, URLSearchParams, structuredClone, Date });
    return { ...window.tournamentPreview, adapter: axios.defaults.adapter };
};
let data = runtime('');
const server = http.createServer(async (request, response) => {
    try {
        const pathname = decodeURIComponent(new URL(request.url, origin).pathname);
        if (pathname === '/__fixture-blank.html') { response.writeHead(200, { 'content-type': 'text/html' }); response.end('<!doctype html><title>Fixture initialization</title>'); return; }
        let file = resolve(buildRoot, `.${pathname}`);
        if (file !== buildRoot && !file.startsWith(buildRoot + sep)) { response.writeHead(403).end(); return; }
        try { if (!(await stat(file)).isFile()) file = resolve(buildRoot, 'index.html'); }
        catch { file = resolve(buildRoot, 'index.html'); }
        const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
        response.writeHead(200, { 'content-type': mime[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
        response.end(await readFile(file));
    } catch { response.writeHead(500).end(); }
});
await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'en-GB', reducedMotion: 'reduce' });
const page = await context.newPage();
page.setDefaultTimeout(10000);
const report = { passed: false, build: buildRoot, checks: [], pageErrors: [], consoleErrors: [], unexpectedRequests: [], assets: [] };
page.on('pageerror', error => report.pageErrors.push(error.message));
page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
page.on('response', response => { if (new URL(response.url()).pathname.startsWith('/assets/') && response.status() === 200) report.assets.push(new URL(response.url()).pathname); });
await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) {
        try {
            const response = await data.adapter({ url: url.href, method: request.method(), data: request.postData(), headers: {} });
            return route.fulfill({ status: response.status, contentType: 'application/json', body: JSON.stringify(response.data) });
        } catch (error) {
            return route.fulfill({ status: error.response?.status ?? 500, contentType: 'application/json', body: JSON.stringify(error.response?.data ?? { message: error.message }) });
        }
    }
    if (url.origin !== origin && !['data:', 'blob:'].includes(url.protocol)) {
        if (!/fonts\.(googleapis|gstatic)\.com/.test(url.hostname) && url.href !== 'https://accounts.google.com/gsi/client') report.unexpectedRequests.push(request.url());
        return route.abort();
    }
    return route.continue();
});
const user = { id: 901, username: 'nino.preview', fullName: 'Nino Beridze', role: 'ORGANIZER', profileComplete: true, emailVerified: true };
const token = `eyJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify({ sub: '901', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.fixture`;
const visit = async (path, query = '', anonymous = false, language = 'en', theme = 'dark', initialTournament = null) => {
    data = runtime(query);
    await page.goto(origin + '/__fixture-blank.html');
    await page.evaluate(({ user, token, anonymous, language, theme }) => {
        localStorage.clear();
        localStorage.setItem('gk-session-id', 'packaged-tournament-test');
        localStorage.setItem('i18nextLng', language);
        localStorage.setItem('theme-preference', theme);
        localStorage.setItem('theme', theme);
        if (!anonymous) {
            localStorage.setItem('accessToken', token);
            localStorage.setItem('gk-session-token:packaged-tournament-test', token);
            localStorage.setItem('userId', '901');
            localStorage.setItem('user', JSON.stringify(user));
        }
    }, { user, token, anonymous, language, theme });
    data = runtime(query);
    if (initialTournament) data.replaceTournament(initialTournament);
    await page.goto(origin + path);
};
const capture = async name => {
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
    report.checks.push(name);
};
const button = (name, scope = page) => scope.getByRole('button', { name, exact: typeof name === 'string' });
const card = id => page.locator(`.tw-bracket [data-fixture-id="${id}"]`);
const match = id => data.snapshot().fixtures.find(item => item.id === id);
const checkRequests = () => { expect(data.unexpected).toEqual([]); };
try {
    if (process.argv.includes('--legacy-only')) {
        const live = await context.request.get('https://app.grasskickz.com/api/tournaments/1');
        expect(live.status()).toBe(200);
        const legacy = await live.json();
        await visit(`/tournaments/${legacy.id}`, '', true, 'en', 'dark', legacy);
        await page.getByRole('heading', { name: legacy.name, exact: true }).waitFor();
        const legacyStages = legacy.stages.filter(stage => stage.stageType === 'KNOCKOUT');
        for (const stage of legacyStages) {
            await page.getByRole('combobox', { name: 'Stage', exact: true }).selectOption(String(stage.id));
            await expect(page.locator('.tw-round h3')).toHaveText(stage.name);
            report.checks.push(`legacy-stage-${stage.id}-${stage.name}`);
        }
        await page.getByRole('combobox', { name: 'Stage', exact: true }).selectOption(String(legacyStages[0].id));
        await capture('packaged-legacy-quarter-finals-desktop');
        await page.setViewportSize({ width: 390, height: 844 });
        await capture('packaged-legacy-quarter-finals-mobile');
        checkRequests();
        await visit('/tournaments/42/workspace', '?active=1');
        await button('Bracket').click();
        await expect(page.locator('.tw-round h3').last()).toHaveText('Final');
        report.checks.push('new-complete-draw-still-has-final');
        checkRequests();
    } else {
    await visit('/tournaments/42/workspace', '?active=1');
    await page.getByRole('heading', { name: 'Horizon Community Cup', exact: true }).waitFor();
    await expect(page.getByRole('img', { name: 'Grasskickz', exact: true })).toBeVisible();
    await expect(page.locator('nav.tw-tabs button')).toHaveCount(2);
    await button('Bracket').click();
    await card(101).getByLabel('Score for Saburtalo United', { exact: true }).fill('2');
    await button('Add goal for Saburtalo United', card(101)).click();
    await button('Save score', card(101)).click();
    await expect.poll(() => match(101).homeScore).toBe(3);
    data.failNext('POST', '/tournaments/42/fixtures/101/complete', 'Please retry advancing this winner.');
    await button('Advance Saburtalo United', card(101)).click();
    await expect(page.getByText('Please retry advancing this winner.', { exact: true })).toBeVisible();
    await expect(card(101).getByLabel('Score for Saburtalo United', { exact: true })).toHaveValue('3');
    expect(match(105).homeEntryId).toBe(null);
    await button('Advance Saburtalo United', card(101)).click();
    await expect.poll(() => match(105).homeEntryId).toBe(1);
    await card(102).getByLabel('Score for Vake Athletic', { exact: true }).fill('2');
    await button(/Vake Athletic.*R1 Match 2 HOME/).dragTo(button(/Winner of R1.*Match 2.*R2 Match 1 AWAY/));
    await expect.poll(() => match(105).awayEntryId).toBe(3);
    report.checks.push('packaged-inline-save-retry-button-and-winner-drag');
    await capture('packaged-active-desktop');
    checkRequests();
    await visit('/tournaments/42/workspace');
    await button('Add participants').click();
    await page.getByRole('textbox', { name: 'Club or team name' }).fill('Packaged Guest Team');
    await button('Add guest club').click();
    await expect(page.locator('.tw-entry-row').filter({ hasText: 'Packaged Guest Team' })).toBeVisible();
    await button('Edit tournament').click();
    const editor = page.getByRole('dialog');
    await editor.getByRole('textbox', { name: 'About the tournament', exact: true }).fill('Verified on the exact candidate bundle.');
    await button('Save changes', editor).click();
    await expect.poll(() => data.snapshot().description).toBe('Verified on the exact candidate bundle.');
    await button('Close tournament editor', editor).click();
    report.checks.push('packaged-guest-and-editor-save');
    checkRequests();
    await visit('/tournaments/setup');
    await page.getByLabel('Tournament name', { exact: true }).fill('Candidate Community Cup');
    await page.getByLabel('Starts', { exact: true }).fill('2026-10-17T09:00');
    await page.getByLabel('Ends', { exact: true }).fill('2026-10-18T19:00');
    await button('Continue').click();
    await button('Review tournament').click();
    await capture('packaged-setup-review');
    await button('Create tournament').click();
    await page.getByRole('heading', { name: 'Candidate Community Cup', exact: true }).waitFor();
    report.checks.push('packaged-create-organization-hosted-tournament');
    checkRequests();
    for (const [language, theme] of [['en', 'light'], ['ka', 'dark']]) {
        await page.setViewportSize({ width: 390, height: 844 });
        await visit('/tournaments/42/workspace', '?active=1', false, language, theme);
        await page.getByRole('heading', { name: 'Horizon Community Cup', exact: true }).waitFor();
        await button(language === 'en' ? 'Bracket' : 'ბადე').click();
        await card(101).scrollIntoViewIfNeeded();
        await capture(`packaged-mobile-${language}-${theme}`);
        checkRequests();
    }
    await page.setViewportSize({ width: 320, height: 844 });
    await visit('/tournaments/42/workspace', '?filled=1', false, 'en', 'light');
    await button('Edit tournament').click();
    await expect.poll(() => page.locator('#tw-edit-tournament-title').evaluate(element => {
        const rect = element.getBoundingClientRect();
        const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return rect.top >= 0 && (top === element || element.contains(top));
    })).toBe(true);
    await capture('packaged-editor-light-320');
    await button('Close tournament editor', page.getByRole('dialog')).click();
    await button('Start tournament').click();
    await expect(page.locator('#confirm-dialog-title')).toBeVisible();
    await expect.poll(() => page.evaluate(() => !document.elementFromPoint(20, 20)?.closest('nav'))).toBe(true);
    await capture('packaged-lifecycle-confirmation-light-320');
    await button('Confirm', page.getByRole('dialog')).click();
    await expect.poll(() => data.snapshot().status).toBe('ACTIVE');
    await button('Bracket').click();
    await card(101).scrollIntoViewIfNeeded();
    await button('Add goal for Saburtalo United', card(101)).click();
    await button('Save score', card(101)).click();
    await expect.poll(() => match(101).homeScore).toBe(1);
    await capture('packaged-inline-light-320');
    checkRequests();
    await visit('/tournaments/42', '?results=1', true);
    await page.getByRole('heading', { name: 'Horizon Community Cup', exact: true }).waitFor();
    await expect(page.locator('.tw-bracket input')).toHaveCount(0);
    await button('Refresh results').click();
    await expect(page.getByRole('tab', { name: 'Bracket', exact: true })).toHaveAttribute('aria-selected', 'true');
    expect(data.requests.every(request => request.path === '/tournaments/42')).toBe(true);
    await capture('packaged-public-mobile');
    checkRequests();
    }
    expect(report.pageErrors).toEqual([]);
    report.applicationErrors = report.consoleErrors.filter(message => !message.startsWith('Failed to load resource:'));
    expect(report.applicationErrors).toEqual([]);
    expect(report.unexpectedRequests).toEqual([]);
    report.assets = [...new Set(report.assets)];
    report.passed = true;
    console.log(JSON.stringify({ passed: true, checks: report.checks.length, assetCount: report.assets.length }));
} catch (error) {
    report.failure = error.message;
    report.unexpectedAdapter = data.unexpected;
    await page.screenshot({ path: `${out}/failure.png`, fullPage: true });
    console.error(error);
    process.exitCode = 1;
} finally {
    await writeFile(`${out}/results.json`, JSON.stringify(report, null, 2));
    await browser.close();
    await new Promise(resolve => server.close(resolve));
}
