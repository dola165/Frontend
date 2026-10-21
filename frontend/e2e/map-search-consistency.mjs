import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

// Integration check against the isolated, current API and copied demo data.
// No map, geocoder, or club API responses are mocked here.
const output = 'review/atlas-search-verification';
const baseUrl = process.env.ATLAS_BASE_URL || 'http://127.0.0.1:5187';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1536, height: 960 }, geolocation: { latitude: 41.714, longitude: 44.778 } });
const page = await context.newPage();
page.setDefaultTimeout(25000);
const errors = [], queries = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { const url = new URL(request.url()); if (url.pathname === '/api/map/nearby') queries.push(Object.fromEntries(url.searchParams)); });
const filters = page.getByLabel('Simple map filters');
const list = page.getByRole('complementary', { name: 'Nearby results' });
const apply = () => page.getByRole('button', { name: 'Show results', exact: true }).click();
const count = async n => {
  await expect(list.getByRole('listitem')).toHaveCount(n);
  await expect(filters.getByText(`${n} loaded results`, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Toggle nearby results' })).toContainText(String(n));
};
try {
  await page.goto(baseUrl + '/e2e/fixtures/map-discovery.html');
  await expect.poll(() => page.evaluate(() => Boolean(window.gkTestMap?.isStyleLoaded())), { timeout: 45000 }).toBe(true);
  await page.getByRole('button', { name: 'Within radius', exact: true }).click();
  await apply();
  await expect(page.getByRole('region', { name: 'Search origin' })).toContainText('Use my location or choose a point');
  expect(queries.at(-1).west).toBeDefined();
  await context.grantPermissions(['geolocation']);
  await page.getByRole('button', { name: 'Use my location', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Search origin' })).toContainText('41.71400, 44.77800');
  await page.getByRole('button', { name: '400 km', exact: true }).click();
  await apply();
  await expect.poll(() => queries.at(-1).west).toBeUndefined();
  await page.getByRole('button', { name: 'Toggle nearby results' }).click();
  await count(14);
  await expect(list.getByRole('status')).toContainText('Within 400 km');
  await page.screenshot({ path: output + '/radius-14.png' });

  // Blank card padding and distance text focus the club, while its actions stay independent.
  const firstCard = list.getByRole('listitem').first();
  await firstCard.click({ position: { x: 8, y: 8 } });
  await expect(firstCard.locator('.atlas-result-main')).toHaveAttribute('aria-pressed', 'true');
  await expect(list).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.gkTestMap.isMoving())).toBe(false);
  const clubPoint = await page.evaluate(() => window.gkTestMap.getSource('selected-point').serialize().data.features[0].geometry.coordinates);
  const bothPointsVisible = () => page.evaluate(club => {
    const map = window.gkTestMap, canvas = map.getContainer();
    return [[44.778, 41.714], club].every(coordinates => {
      const point = map.project(coordinates);
      return point.x >= 20 && point.x <= canvas.clientWidth - 20 && point.y >= 20 && point.y <= canvas.clientHeight - 20;
    });
  }, clubPoint);
  expect(await bothPointsVisible()).toBe(true);
  await page.evaluate(() => window.gkTestMap.jumpTo({ center: [44.86, 41.75] }));
  const distanceBox = await firstCard.locator('.atlas-result-footer>span').boundingBox();
  await page.mouse.click(distanceBox.x + distanceBox.width / 2, distanceBox.y + distanceBox.height / 2);
  await expect.poll(() => page.evaluate(() => window.gkTestMap.isMoving())).toBe(false);
  expect(await bothPointsVisible()).toBe(true);
  await firstCard.locator('.atlas-result-main').focus();
  await firstCard.locator('.atlas-result-main').press('Enter');
  await expect(list).toBeVisible();
  await page.screenshot({ path: output + '/football-card-focus.png' });
  await page.evaluate(() => window.gkTestMap.jumpTo({ center: [44.86, 41.75] }));
  const clubHref = await firstCard.getByRole('link', { name: 'View club' }).getAttribute('href');
  await firstCard.getByRole('link', { name: 'View club' }).click();
  await expect.poll(() => page.evaluate(() => window.gkTestLocation)).toBe(clubHref);
  expect(await page.evaluate(() => window.gkTestMap.getCenter().lng)).toBeCloseTo(44.86, 4);

  // Opening the list is read-only; it must never silently switch search coverage.
  const beforeToggle = queries.length;
  await page.getByRole('button', { name: 'Toggle nearby results' }).click();
  await page.getByRole('button', { name: 'Toggle nearby results' }).click();
  expect(queries.length).toBe(beforeToggle);
  await page.evaluate(() => window.gkTestMap.jumpTo({ center: [44.795, 41.729], zoom: 12 }));
  await page.getByRole('button', { name: 'Search visible map', exact: true }).click();
  await count(2);
  const searchedArea = { ...queries.at(-1) };
  await expect(list.getByRole('status')).toContainText('Searched map area');
  await expect(page.getByRole('button', { name: 'Visible map', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#map-search-radius')).toBeDisabled();
  await apply();
  await count(2);
  expect(queries.at(-1)).toEqual(searchedArea);
  await page.screenshot({ path: output + '/area-2-after-apply.png' });

  // Camera movement changes neither the saved area nor the chosen origin.
  await page.evaluate(() => window.gkTestMap.jumpTo({ center: [44.86, 41.75], zoom: 11 }));
  await apply();
  await count(2);
  expect(queries.at(-1)).toEqual(searchedArea);
  await page.getByRole('button', { name: 'Within radius', exact: true }).click();
  await apply();
  await count(14);
  expect(Number(queries.at(-1).lat)).toBeCloseTo(41.714, 5);
  expect(Number(queries.at(-1).lng)).toBeCloseTo(44.778, 5);

  // Germany is browsable even with a start in Georgia: region + origin cooperate.
  await page.getByLabel('Country', { exact: true }).fill('Germany');
  await page.getByRole('button', { name: 'Germany DE', exact: true }).click();
  await apply();
  await count(5);
  await expect(list.getByRole('status')).toContainText('All of Germany');
  expect(queries.at(-1)).toMatchObject({ countries: 'Germany', west: '-180', east: '180', lat: '41.714', lng: '44.778' });
  await expect.poll(() => page.evaluate(() => window.gkTestMap.getCenter().lng)).toBeLessThan(20);
  await page.getByLabel('City', { exact: true }).fill('Berlin');
  await page.locator('.map-simple-suggestion').filter({ hasText: 'Berlin' }).first().click();
  await apply();
  await count(1);
  await expect(list.getByRole('status')).toContainText('All of Berlin');
  await expect(list).toContainText('Berlin Industrie SV');
  await expect(page.getByRole('region', { name: 'Search origin' })).toContainText('41.71400, 44.77800');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: output + '/berlin-with-georgia-start.png' });

  await page.getByRole('button', { name: 'Map view and gestures' }).click();
  await expect(page.getByRole('region', { name: 'Map view controls' })).toContainText('Right-click and drag');
  await page.getByRole('slider', { name: 'Map tilt' }).focus();
  await page.getByRole('slider', { name: 'Map tilt' }).press('End');
  await expect.poll(() => page.evaluate(() => window.gkTestMap.getPitch())).toBeCloseTo(60);
  await page.getByRole('button', { name: 'Rotate right', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.gkTestMap.getBearing())).toBeCloseTo(30);
  await page.screenshot({ path: output + '/map-view-controls.png' });
  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.gkTestMap.getPitch())).toBe(0);
  await expect.poll(() => page.evaluate(() => window.gkTestMap.getBearing())).toBe(0);
  await page.getByRole('button', { name: 'Close map view controls' }).click();
  await page.getByRole('button', { name: 'Close results' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Toggle filters' }).click();
  await expect.poll(async () => Math.round((await filters.boundingBox()).x)).toBe(0);
  await expect(page.getByRole('button', { name: 'Show results', exact: true })).toBeInViewport();
  await page.getByRole('region', { name: 'Search origin' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: output + '/mobile-location.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  // On mobile the point chooser exposes the map and can replace an existing start.
  await page.getByRole('button', { name: 'Change on map', exact: true }).click();
  await expect(filters).not.toBeInViewport();
  const mobileStart = await page.evaluate(() => {
    const map = window.gkTestMap, center = map.getCenter(), point = map.project(center);
    return { x: point.x, y: point.y, lat: center.lat, lng: center.lng };
  });
  await page.locator('.maplibregl-canvas').click({ position: { x: mobileStart.x, y: mobileStart.y } });
  await page.getByRole('button', { name: 'Toggle filters' }).click();
  await expect(page.getByRole('region', { name: 'Search origin' })).toContainText(mobileStart.lat.toFixed(5));

  // Existing permission starts the next visit nearby, without a fresh prompt.
  const returningContext = await browser.newContext({ permissions: ['geolocation'], geolocation: { latitude: 52.52, longitude: 13.405 } });
  const returning = await returningContext.newPage();
  await returning.goto(baseUrl + '/e2e/fixtures/map-discovery.html');
  await expect(returning.getByRole('region', { name: 'Search origin' })).toContainText('52.52000, 13.40500');
  await expect(returning.getByRole('button', { name: 'Within radius', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => returning.evaluate(() => window.gkTestMap?.getCenter().lng)).toBeCloseTo(13.405, 2);
  // A denied retry offers a manual fallback without discarding the previous point.
  await returning.evaluate(() => { navigator.geolocation.getCurrentPosition = (_success, failure) => failure({ code: 1 }); });
  await returning.getByRole('button', { name: 'Use my location', exact: true }).click();
  await expect(returning.getByRole('region', { name: 'Search origin' })).toContainText('Location access is off');
  await expect(returning.getByRole('region', { name: 'Search origin' })).toContainText('52.52000, 13.40500');
  await returning.getByRole('button', { name: 'Change on map', exact: true }).click();
  await expect(returning.getByRole('region', { name: 'Search origin' })).not.toContainText('Location access is off');
  await returningContext.close();
  expect(errors).toEqual([]);
  await writeFile(output + '/results.json', JSON.stringify({ realApi: true, radiusClubs: 14, areaClubs: 2, applyPreservesArea: true, allCountersAgree: true, listDoesNotChangeSearch: true, originPreservedAfterPan: true, germanyClubs: 5, berlinClubs: 1, crossCountryOrigin: true, mapViewControls: true, mobile: true, mobileStartReplacement: true, permittedLocationOnReturn: true, deniedLocationFallback: true, wholeCardMapFocus: true, keyboardCardFocus: true, viewClubIndependent: true, errors }, null, 2));
  console.log('PASS: real API radius/area consistency, region/origin cooperation, camera controls and mobile');
} catch (error) {
  await page.screenshot({ path: output + '/failure.png' });
  console.error((await page.locator('body').innerText()).slice(0, 4500));
  console.error(queries.slice(-3));
  throw error;
} finally { await browser.close(); }
