import { chromium, expect } from '@playwright/test';
import { createServer, preview } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Real MapLibre camera and UI, with fixed discovery data and a tile-independent style.
const built = process.env.MAP_FRAMING_BUILD;
const output = built ? 'review/map-location-framing-packaged' : 'review/map-location-framing';
await mkdir(output, { recursive: true });
const server = built
    ? await preview({ build: { outDir: built }, preview: { host: '127.0.0.1', port: 5199, strictPort: true } })
    : await createServer({ server: { host: '127.0.0.1', port: 5199, strictPort: true, hmr: false } });
if (!built) await server.listen();
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const origin = [44.778, 41.714];
const clubs = [
    { entityId: 1, title: 'Nearby Club', longitude: 44.85, latitude: 41.74 },
    { entityId: 2, title: 'Distant Club', longitude: 46.85, latitude: 41.74 }
].map(club => ({ ...club, entityType: 'CLUB', clubId: club.entityId, clubName: club.title, subtitle: 'Grassroots', status: 'ACTIVE', members: 20, followers: 30 }));
const checks = [];
const errors = [];

async function openMap(width, height) {
    const context = await browser.newContext({ viewport: { width, height }, geolocation: { longitude: origin[0], latitude: origin[1] } });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (built && url.hostname === '127.0.0.1' && url.pathname.includes('/maplibre-gl-')) {
            const module = await readFile(path.join(built, url.pathname), 'utf8');
            const exported = module.match(/export\{(\w+) as m\}/)?.[1];
            if (!exported) throw Error('MapLibre module export missing');
            return route.fulfill({ contentType: 'application/javascript', body: module + `\nconst gkOriginalOn=${exported}.default.Map.prototype.on; ${exported}.default.Map.prototype.on=function(...args){window.gkTestMap=this;return gkOriginalOn.apply(this,args)};` });
        }
        if (url.pathname.startsWith('/api/')) {
            if (url.pathname.endsWith('/map/nearby')) return route.fulfill({ json: { content: clubs, page: 0, size: 100, totalElements: clubs.length } });
            if (url.pathname.includes('/auth/')) return route.fulfill({ status: 401, json: {} });
            const club = clubs.find(club => url.pathname === `/api/clubs/${club.clubId}`);
            return route.fulfill({ json: club ? { ...club, id: club.clubId, name: club.title, type: 'Grassroots' } : {} });
        }
        if (url.hostname !== '127.0.0.1' && route.request().resourceType() === 'script') return route.fulfill({ contentType: 'application/javascript', body: '' });
        if (url.hostname !== '127.0.0.1' && url.protocol.startsWith('http')) return route.fulfill({ json: {
            version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#e8e7df' } }]
        } });
        return route.continue();
    });
    await page.goto('http://127.0.0.1:5199' + (built ? '/world' : '/e2e/fixtures/map-discovery.html'));
    await expect.poll(() => page.evaluate(() => Boolean(window.gkTestMap?.isStyleLoaded()))).toBe(true);
    return { context, page };
}

async function settle(page) {
    await expect.poll(() => page.evaluate(() => window.gkTestMap.isMoving())).toBe(false);
}

async function clickMarker(page, club) {
    await page.evaluate(club => window.gkTestMap.jumpTo({ center: [club.longitude, club.latitude], zoom: 14 }), club);
    await expect.poll(() => page.evaluate(() => window.gkTestMap.queryRenderedFeatures({ layers: ['points-circle', 'selected-point-pin'].filter(id => window.gkTestMap.getLayer(id)) }).length)).toBeGreaterThan(0);
    const point = await page.evaluate(club => {
        const map = window.gkTestMap, rect = map.getCanvas().getBoundingClientRect();
        const point = map.project([club.longitude, club.latitude]);
        return { x: rect.left + point.x, y: rect.top + point.y };
    }, club);
    await page.mouse.click(point.x, point.y);
    await expect(page.getByRole('complementary', { name: 'Selected club details' })).toContainText(club.title);
    await settle(page);
}

async function expectBothVisible(page, club, label) {
    const geometry = await page.evaluate(({ origin, club }) => {
        const map = window.gkTestMap, canvas = map.getContainer(), rect = canvas.getBoundingClientRect();
        const sheet = document.querySelector('.atlas-detail-dock')?.getBoundingClientRect();
        const bottom = sheet && innerWidth < 1100 ? sheet.top - rect.top : rect.height;
        return { width: rect.width, bottom, zoom: map.getZoom(), points: [origin, [club.longitude, club.latitude]].map(p => { const point = map.project(p); return { x: point.x, y: point.y }; }) };
    }, { origin, club });
    for (const point of geometry.points) {
        expect(point.x, label).toBeGreaterThanOrEqual(20);
        expect(point.x, label).toBeLessThanOrEqual(geometry.width - 20);
        expect(point.y, label).toBeGreaterThanOrEqual(85);
        expect(point.y, label).toBeLessThanOrEqual(geometry.bottom - 45);
    }
    checks.push({ label, ...geometry });
}

try {
    const { context, page } = await openMap(1536, 960);
    // No chosen location: browse-area searches keep the existing close focus.
    await page.getByRole('button', { name: 'Search visible map', exact: true }).click();
    await page.getByRole('button', { name: 'Show Nearby Club on map', exact: true }).click();
    await settle(page);
    expect(await page.evaluate(() => window.gkTestMap.getZoom())).toBeGreaterThanOrEqual(14);
    expect(await page.evaluate(() => window.gkTestMap.getCenter().lng)).toBeCloseTo(clubs[0].longitude, 4);
    await clickMarker(page, clubs[0]);
    expect(await page.evaluate(() => window.gkTestMap.getZoom())).toBeGreaterThanOrEqual(14);
    checks.push({ label: 'Browse area without location retains close zoom for cards and markers' });

    // Choosing the origin after a marker click also checks that its callback is fresh.
    await page.getByRole('button', { name: 'Choose on map', exact: true }).click();
    await page.evaluate(origin => window.gkTestMap.jumpTo({ center: origin, zoom: 12 }), origin);
    const canvas = await page.locator('.maplibregl-canvas').boundingBox();
    await page.mouse.click(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
    await expect(page.getByLabel('Search start. Drag to move.')).toBeVisible();
    await clickMarker(page, clubs[0]);
    await expectBothVisible(page, clubs[0], 'Manual location and nearby marker');
    await page.screenshot({ path: `${output}/desktop-nearby.png` });

    await page.getByRole('button', { name: 'Toggle nearby results' }).click();
    await page.getByRole('button', { name: 'Show Nearby Club on map', exact: true }).click();
    await settle(page);
    await expectBothVisible(page, clubs[0], 'Nearby result card retains location');
    await page.evaluate(club => window.gkTestMap.jumpTo({ center: [club.longitude, club.latitude], zoom: 12 }), clubs[1]);
    await page.getByRole('button', { name: 'Search visible map', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Show Distant Club on map', exact: true })).toBeVisible();
    await clickMarker(page, clubs[1]);
    expect(await page.evaluate(() => window.gkTestMap.getZoom())).toBeGreaterThanOrEqual(14);
    expect(await page.evaluate(() => window.gkTestMap.getCenter().lng)).toBeCloseTo(clubs[1].longitude, 4);
    checks.push({ label: 'Club over 100 km away retains close zoom' });
    await context.close();

    for (const [width, height] of [[390, 844], [360, 437]]) {
        const { context, page } = await openMap(width, height);
        await context.grantPermissions(['geolocation']);
        await page.getByRole('button', { name: 'Toggle filters' }).click();
        await page.getByRole('button', { name: 'Use my location', exact: true }).click();
        await expect(page.getByLabel('Search start. Drag to move.')).toBeAttached();
        await page.getByRole('button', { name: 'Close filters', exact: true }).click();
        await settle(page);
        await clickMarker(page, clubs[0]);
        await expectBothVisible(page, clubs[0], `GPS location stays above detail sheet at ${width}x${height}`);
        await page.screenshot({ path: `${output}/nearby-${width}x${height}.png` });
        await context.close();
    }
    expect(errors).toEqual([]);
    await writeFile(`${output}/results.json`, JSON.stringify({ checks, errors }, null, 2));
    console.log(`PASS: ${checks.length} map location framing checks`);
} finally {
    await browser.close();
    if (built) await new Promise(resolve => server.httpServer.close(resolve));
    else await server.close();
}
