// One public-network request using synthetic Tbilisi coordinates, never a tester's location.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
try {
    await page.goto((process.env.ATLAS_BASE_URL || 'http://127.0.0.1:5187') + '/e2e/fixtures/map-discovery.html');
    const result = await page.evaluate(async () => {
        const { loadWalkingRoute } = await import('/src/components/map/walkingRoutes.ts');
        const started = performance.now();
        try {
            const route = await loadWalkingRoute([44.82, 41.714], [44.8271, 41.7151], new AbortController().signal);
            return { success: true, durationMs: Math.round(performance.now() - started), pathPoints: route.coordinates.length, distanceKm: route.distanceKm, minutes: route.minutes, startOffsetM: route.startOffsetM, endOffsetM: route.endOffsetM };
        } catch (error) { return { success: false, durationMs: Math.round(performance.now() - started), error: error.message }; }
    });
    await mkdir('review/mobile-map-repair', { recursive: true });
    await writeFile('review/mobile-map-repair/live-walking.json', JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
    if (!result.success) process.exitCode = 1;
} finally { await browser.close(); }
