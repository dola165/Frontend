import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,channel:'chrome'});const page=await browser.newPage();
await page.goto('http://127.0.0.1:5186/');
const result=await page.evaluate(async()=>{const q='[out:json][timeout:15];way[highway=footway](41.706,44.772,41.714,44.785);(._;>;);out body;';try {const r=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',body:new URLSearchParams({data:q}),signal:AbortSignal.timeout(22000)});return {status:r.status,body:await r.text()};}catch(e){return {error:e.message};}});
console.log(JSON.stringify({...result,body:result.body?.slice(0,180)}));
if(result.status===200)await writeFile('review/atlas-verification/live-osm.json',result.body);
await browser.close();
