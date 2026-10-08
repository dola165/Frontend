import {chromium,expect} from '@playwright/test';import {readFile,writeFile} from 'node:fs/promises';
const sample=JSON.parse(await readFile('review/atlas-verification/live-route.json','utf8'));
const browser=await chromium.launch({headless:true,channel:'chrome'});const page=await browser.newPage();
await page.goto('http://127.0.0.1:5186/');
const result=await page.evaluate(async({origin,destination})=>{const {loadWalkingRoute}=await import('/src/components/map/walkingRoutes.ts');try{const route=await loadWalkingRoute(origin,destination,new AbortController().signal);return {distanceKm:route.distanceKm,coordinates:route.coordinates,minutes:route.minutes,steps:route.steps};}catch(error){return {error:error.message}}},sample);
console.log(JSON.stringify({distanceKm:result.distanceKm,minutes:result.minutes,pathNodes:result.coordinates?.length,error:result.error}));
expect(result.error).toBeUndefined();expect(result.coordinates.length).toBeGreaterThan(3);
await writeFile('review/atlas-verification/live-worker-route.json',JSON.stringify(result));await browser.close();
