// Screenshot harness: visits routes, captures desktop/mobile × dark/light, records errors
// and synthetic-API gaps. Usage: node sandbox/shots.mjs <label> [routes.json] [--only=substr] [--themes=dark,light] [--widths=1440,390]
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const label = args.find(a => !a.startsWith('--')) || 'run';
const routesFile = args.filter(a => !a.startsWith('--'))[1] || path.join(here, 'routes.json');
const opt = k => args.find(a => a.startsWith(`--${k}=`))?.split('=')[1];
const only = opt('only');
const themes = (opt('themes') || 'dark').split(',');
const widths = (opt('widths') || '1440,390').split(',').map(Number);
const base = opt('base') || 'http://localhost:4300';
const full = args.includes('--full');
const outDir = path.join(here, 'shots', label);
await mkdir(outDir, { recursive: true });
let routes = JSON.parse(await readFile(routesFile, 'utf8'));
if (only) routes = routes.filter(r => r.name.includes(only) || r.path.includes(only));

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const report = [];
for (const theme of themes) for (const width of widths) {
  const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 960 }, deviceScaleFactor: 1, locale: 'en-GB', timezoneId: 'Asia/Tbilisi', colorScheme: theme });
  await context.addInitScript(t => { try { localStorage.setItem('theme-preference', t); if (!localStorage.getItem('gk-session-id')) { const id = 'sandbox-session'; localStorage.setItem('gk-session-id', id); } localStorage.setItem('i18nextLng', 'en'); } catch {} }, theme);
  // Only the sandbox origin is reachable; fail everything else fast (fonts, Google, map tiles).
  await context.route(url => !url.href.startsWith(base) && !url.href.startsWith('data:') && !url.href.startsWith('blob:'), route => route.abort());
  for (const r of routes) {
    const page = await context.newPage();
    const entry = { name: r.name, path: r.path, theme, width, errors: [], failed: [] };
    page.on('pageerror', e => entry.errors.push(String(e.message).slice(0, 300)));
    page.on('console', m => { if (m.type() === 'error') entry.errors.push(m.text().slice(0, 300)); });
    page.on('response', res => { const u = res.url(); if (u.includes('/api/') && res.status() >= 400) entry.failed.push(`${res.status()} ${res.request().method()} ${u.replace(base, '')}`); });
    try {
      await page.goto(base + r.path, { waitUntil: 'networkidle', timeout: 20000 });
    } catch (e) { entry.errors.push('navigation: ' + e.message.split('\n')[0]); }
    if (r.wait) await page.waitForTimeout(r.wait);
    await page.waitForTimeout(600);
    const file = `${r.name}-${width}-${theme}.png`;
    await page.screenshot({ path: path.join(outDir, file), fullPage: full || r.full === true }).catch(e => entry.errors.push('shot: ' + e.message));
    entry.overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1).catch(() => null);
    entry.file = file;
    report.push(entry);
    await page.close();
  }
  await context.close();
}
await browser.close();
await writeFile(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
const bad = report.filter(e => e.errors.length || e.failed.length || e.overflow);
console.log(`${report.length} captures in ${outDir}; ${bad.length} with issues`);
for (const e of bad.slice(0, 60)) console.log(`- ${e.name} ${e.width} ${e.theme}${e.overflow ? ' OVERFLOW' : ''}: ${[...new Set(e.failed)].slice(0, 6).join(' | ')} ${e.errors.slice(0, 2).join(' | ')}`);
