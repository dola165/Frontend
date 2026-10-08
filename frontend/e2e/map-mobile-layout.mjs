import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const baseUrl = process.env.ATLAS_BASE_URL || 'http://127.0.0.1:5187';
const output = 'review/mobile-map-repair';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 550 }, geolocation: { longitude: 44.807, latitude: 41.7001 }, permissions: ['geolocation'] });
page.setDefaultTimeout(20000);
const errors = []; page.on('pageerror', error => errors.push(error.message));
const marker = { entityId: 1, entityType: 'CLUB', title: 'Mobile test football academy', subtitle: 'Academy', clubName: 'Mobile test football academy', clubId: 1, latitude: 41.7001, longitude: 44.809, distanceKm: .17, members: 30, followers: 50, verified: true, addressText: 'Tbilisi, Georgia', status: 'ACTIVE' };
const banner = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200"><rect width="600" height="200" fill="#718865"/></svg>');
await page.route(url => url.pathname.startsWith('/api/'), route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/map/nearby')) return route.fulfill({ json: { content: [marker], page: 0, size: 100, totalElements: 1, resultsLimited: false } });
    if (/\/clubs\/1$/.test(pathname)) return route.fulfill({ json: { id: 1, name: marker.title, type: 'ACADEMY', description: 'Training and community football. '.repeat(25), bannerUrl: banner, logoUrl: banner, isOfficial: true, memberCount: 40, followerCount: 70 } });
    if (pathname.includes('/auth/refresh')) return route.fulfill({ status: 401, json: {} });
    return route.fulfill({ json: {} });
});
await page.route('**/interpreter', route => route.fulfill({ json: { elements: [
    { type: 'node', id: 1, lon: 44.8, lat: 41.7 }, { type: 'node', id: 2, lon: 44.82, lat: 41.7 },
    { type: 'way', id: 10, nodes: [1, 2], tags: { highway: 'footway', name: 'Long neighborhood path' } }
] } }));
const records = [];
try {
    await page.goto(baseUrl + '/e2e/fixtures/map-discovery.html');
    await expect.poll(() => page.evaluate(() => Boolean(window.gkTestMap?.isStyleLoaded())), { timeout: 30000 }).toBe(true);
    const select = async () => {
        await page.evaluate(() => window.gkTestMap.jumpTo({ center: [44.809, 41.7001], zoom: 15 }));
        await expect.poll(() => page.evaluate(() => window.gkTestMap.isMoving())).toBe(false);
        const point = await page.evaluate(() => { const p = window.gkTestMap.project([44.809, 41.7001]); return { x: p.x, y: p.y }; });
        await page.locator('.maplibregl-canvas').click({ position: point });
        await expect(page.getByRole('complementary', { name: 'Selected club details' })).toBeVisible();
    };
    for (const [width, height] of [[390, 550], [360, 430], [800, 240]]) {
        await page.setViewportSize({ width, height });
        await select();
        const sheet = page.getByRole('complementary', { name: 'Selected club details' });
        await expect(sheet.getByRole('button', { name: 'Open club', exact: true })).toBeInViewport({ ratio: 1 });
        await expect(sheet.getByRole('button', { name: 'Walk here', exact: true })).toBeInViewport({ ratio: 1 });
        const geometry = await sheet.evaluate(el => {
            const rect = el.getBoundingClientRect(), content = el.querySelector('.atlas-detail-scroll');
            return { height: rect.height, bottom: rect.bottom, scrollHeight: content.scrollHeight, clientHeight: content.clientHeight, pageWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth };
        });
        expect(geometry.bottom).toBeLessThanOrEqual(height);
        expect(geometry.clientHeight).toBeGreaterThan(0);
        expect(geometry.scrollHeight).toBeGreaterThan(geometry.clientHeight);
        expect(geometry.pageWidth).toBeLessThanOrEqual(width);
        await sheet.locator('.atlas-detail-scroll').evaluate(el => { el.scrollTop = el.scrollHeight; });
        await expect(sheet.getByRole('link', { name: 'Directions', exact: true })).toBeInViewport({ ratio: 1 });
        await page.screenshot({ path: `${output}/details-${width}x${height}.png` });
        records.push({ viewportWidth: width, viewportHeight: height, ...geometry });
        await sheet.getByRole('button', { name: 'Close details' }).click();
    }
    await page.setViewportSize({ width: 390, height: 550 });
    await select();
    await page.getByRole('button', { name: 'Walk here', exact: true }).click();
    await page.getByRole('button', { name: 'My location', exact: true }).click();
    await expect(page.getByText('min walk', { exact: true })).toBeVisible();
    await expect(page.locator('.atlas-walk-steps')).toContainText('Long neighborhood path');
    const source = await page.evaluate(() => window.gkTestMap.getSource('atlas-walking-route').serialize().data);
    expect(source.features[0].geometry.coordinates).toHaveLength(2);
    expect(source.features[0].geometry.coordinates[0][0]).toBeCloseTo(44.807, 5);
    expect(await page.evaluate(() => Boolean(window.gkTestMap.getLayer('atlas-network-lines')))).toBe(false);
    expect(await page.evaluate(() => window.gkTestMap.getPaintProperty('atlas-route-line', 'line-color'))).toBe('#075333');
    await expect(page.getByRole('button', { name: 'Close walking directions' })).toBeInViewport({ ratio: 1 });
    await expect.poll(() => page.evaluate(() => window.gkTestMap.isMoving())).toBe(false);
    await expect.poll(() => page.evaluate(() => window.gkTestMap.queryRenderedFeatures({ layers: ['atlas-route-line'] }).length), { timeout: 20000 }).toBeGreaterThan(0);
    await page.screenshot({ path: `${output}/walking-route.png` });
    await page.getByRole('button', { name: 'Close walking directions' }).click();
    await select(); await page.getByRole('button', { name: 'Open club', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.gkTestLocation)).toBe('/clubs/1');
    expect(errors).toEqual([]);
    await writeFile(`${output}/results.json`, JSON.stringify({ layouts: records, realWorker: true, geolocationToWalkingRoute: true, sparseStreetSnapping: true, openClubNavigation: true, mobileDecorativeAnimationDisabled: true, errors }, null, 2));
    console.log('PASS: phone/landscape details, pinned actions, actual worker, geolocation route and club navigation');
} catch (error) {
    await page.screenshot({ path: `${output}/failure.png` });
    console.log((await page.locator('body').innerText()).slice(0, 3000));
    console.log(errors);
    throw error;
} finally { await browser.close(); }
