// Measure the real schedule with deterministic local data, using production assets.
import { build, preview } from 'vite';
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [label = 'before'] = process.argv.slice(2);
const output = path.resolve(`review/schedule-performance-20260914/${label}`);
const dist = path.join(output, 'dist');
await mkdir(output, { recursive: true });
await build({ build: { outDir: dist, reportCompressedSize: false, rollupOptions: { input: path.resolve('e2e/fixtures/schedule-preview.html') } }, logLevel: 'error' });
const server = await preview({ build: { outDir: dist }, preview: { host: '127.0.0.1', port: 0, strictPort: false } });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { label, conditions: { cpuSlowdown: 4, api: 'Local deterministic fixture; no live data', assets: 'Production build', viewport: '1440×900' }, samples: [] };
try {
    for (const load of [0, 210]) {
        for (let sample = 0; sample < 2; sample++) {
            const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-GB' });
            await context.addInitScript(() => {
                localStorage.setItem('i18nextLng', 'en');
                window.__dateConstructors = 0;
                Intl.DateTimeFormat = new Proxy(Intl.DateTimeFormat, { construct(target, args) {
                    window.__dateConstructors++;
                    return Reflect.construct(target, args);
                } });
                window.__longTasks = [];
                new PerformanceObserver(list => window.__longTasks.push(...list.getEntries().map(entry => ({ start: entry.startTime, ms: entry.duration })))).observe({ type: 'longtask', buffered: true });
            });
            await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
            const page = await context.newPage(), errors = [];
            page.on('pageerror', error => errors.push(error.message));
            const cdp = await context.newCDPSession(page);
            await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
            await cdp.send('Performance.enable');
            await page.goto(`${origin}/e2e/fixtures/schedule-preview.html?lang=en&load=${load}`, { waitUntil: 'networkidle' });
            await page.locator('.swb-week-board').waitFor();
            const initial = await page.evaluate(() => ({ constructors: window.__dateConstructors, nodes: document.querySelectorAll('*').length, cards: document.querySelectorAll('.swb-event').length }));
            const switches = [];
            for (const view of ['Agenda', 'Calendar', 'Week board', 'Agenda', 'Calendar', 'Week board']) {
                const startMetrics = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
                const measurement = await page.evaluate(async label => {
                    const start = performance.now(), constructors = window.__dateConstructors;
                    const button = Array.from(document.querySelectorAll('[data-tutorial="calendar-view-mode"] button')).find(button => button.textContent.trim() === label);
                    if (!button) throw new Error('Missing schedule view ' + label);
                    button.click();
                    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                    return { presentationMs: performance.now() - start, dateConstructors: window.__dateConstructors - constructors };
                }, view);
                const endMetrics = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
                switches.push({ view, ...measurement, mainThreadMs: (endMetrics.TaskDuration - startMetrics.TaskDuration) * 1000 });
            }
            const scroll = await page.evaluate(async () => {
                const node = document.querySelector('.schedule-direction'), frames = [];
                let last = performance.now();
                for (let frame = 0; frame < 90; frame++) {
                    await new Promise(resolve => requestAnimationFrame(resolve));
                    const now = performance.now();
                    frames.push(now - last); last = now;
                    node.scrollTop += frame < 45 ? 45 : -45;
                }
                return { scrollHeight: node.scrollHeight, visibleHeight: node.clientHeight, framesOver32ms: frames.filter(ms => ms > 32).length, p95FrameMs: frames.toSorted((a,b) => a-b)[Math.floor(frames.length * .95)] };
            });
            const final = await page.evaluate(() => ({ constructors: window.__dateConstructors, longTasks: window.__longTasks, js: performance.getEntriesByType('resource').filter(entry => new URL(entry.name).pathname.endsWith('.js')).map(entry => new URL(entry.name).pathname) }));
            const result = { load, sample, initial, switches, scroll, ...final, errors };
            report.samples.push(result);
            console.log(JSON.stringify({ label, load, sample, initial, switches, scroll, errors }));
            await context.close();
        }
    }
    await writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2));
} finally {
    await browser.close();
    await new Promise(resolve => server.httpServer.close(resolve));
}
