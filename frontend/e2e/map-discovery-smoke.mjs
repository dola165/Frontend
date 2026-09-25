import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
const fixture = JSON.parse(await readFile(process.argv[2], 'utf8'));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(path.dirname(process.argv[2]), 'map-browser');
await mkdir(output, { recursive: true });
const server = await createServer({ root, configFile:path.join(root,'vite.config.ts'),
 define:{'import.meta.env.VITE_API_BASE_URL':JSON.stringify(fixture.backend+'/api'),'import.meta.env.VITE_ENABLE_MOCKS':'"false"'},
 server:{host:'127.0.0.1',port:5178,strictPort:true,hmr:false} });
await server.listen();
const browser = await chromium.launch({headless:true,channel:'chrome'});
try {
 const context = await browser.newContext({viewport:{width:1280,height:900}});
 context.setDefaultTimeout(15000);
 const page = await context.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 // Force external tile/style failure while every discovery request reaches the real backend.
 await page.route('**/*',route=> {
   const url=new URL(route.request().url());
   return url.hostname==='127.0.0.1' || url.protocol==='data:' ? route.continue() : route.abort();
 });
 await page.goto('http://127.0.0.1:5178/e2e/fixtures/map-discovery.html');
 const list = page.getByRole('complementary',{name:'Nearby results'});
 await expect(list).toBeVisible();
 await expect(list.getByRole('listitem')).toHaveCount(100);
 await expect(list).toContainText('More exist');
 await expect(page.getByText('The map could not load.',{exact:false})).toBeVisible();
 console.log('PASS: tile failure opens a usable list with 100 bounded clubs and a clear limit notice');
 await list.getByRole('button',{name:'Close results'}).click();
 await page.getByRole('button',{name:'Toggle filters'}).click();
 await page.getByRole('checkbox',{name:'Matches',exact:true}).check();
 await page.getByRole('checkbox',{name:'Tournaments',exact:true}).check();
 await page.getByRole('button',{name:'Show results',exact:true}).click();
 await expect(page.getByText('103 loaded results',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Close filters'}).click();
 await page.getByRole('button',{name:'Toggle nearby results'}).click();
 await expect(list.getByRole('listitem')).toHaveCount(103);
 await expect(list).toContainText('GK17 Public Cup');
 await expect(list).not.toContainText('GK17 Unlisted Cup');
 const fixtureRow=list.getByRole('listitem').filter({hasText:'CONFIRMED'});
 await fixtureRow.getByRole('button').focus();
 await page.keyboard.press('Enter');
 await expect(page.getByRole('button',{name:'Open club'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Respond',exact:true})).toHaveCount(0);
 await page.screenshot({path:path.join(output,'spectator-match.png')});
 console.log('PASS: guests browse public clubs, matches and tournaments; keyboard opens confirmed match, with no staff action');
 // A failed initial request must stop the spinner and offer a retry.
 let fail=true;
 await page.route('**/map/nearby?**',route=>{
   if(fail){fail=false;return route.fulfill({status:503,contentType:'application/json',body:'{}'});}
   return route.continue();
 });
 await page.reload();
 await expect(page.getByRole('alert')).toContainText('Unable to load');
 await expect(page.getByText('Loading map...', {exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Retry search'}).click();
 await expect(list.getByRole('listitem')).toHaveCount(100);
 await page.setViewportSize({width:390,height:844});
 await expect(list).toBeVisible();
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
 expect(overflow).toBe(false);
 await page.screenshot({path:path.join(output,'mobile-web-list.png')});
 console.log('PASS: initial failure has working retry; results list works at 390px without horizontal overflow');
 // Verify real WebGL rendering with a deterministic style, independently of external tile uptime.
 await page.unroute('**/*');
 await page.route('https://**/*',route => route.fulfill({contentType:'application/json',body:JSON.stringify({version:8,glyphs:'http://127.0.0.1:5178/glyphs/{fontstack}/{range}.pbf',sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#dfeee8'}}]})}));
 await page.route('**/glyphs/**',route=>route.fulfill({contentType:'application/x-protobuf',body:Buffer.alloc(0)}));
 await page.setViewportSize({width:1280,height:900});
 await page.reload();
 await expect(page.locator('.maplibregl-canvas')).toBeVisible();
 await expect(page.getByText('100 shown within 50 km',{exact:true})).toBeVisible();
 await expect(page.getByText('The map could not load.',{exact:false})).toHaveCount(0);
 await expect.poll(()=>page.evaluate(()=>window.gkTestMap?.getLayer('points-clusters') ? window.gkTestMap.queryRenderedFeatures({layers:['points-clusters']}).length : 0)).toBeGreaterThan(0);
 await page.screenshot({path:path.join(output,'webgl-map.png')});
 console.log('PASS: real MapLibre WebGL renders the cluster from public API results and a deterministic background style');
 expect(errors).toEqual([]);
 await writeFile(path.join(output,'results.json'),JSON.stringify({guestDiscovery:true,hiddenUnlisted:true,boundedResults:100,combinedResults:103,keyboardMatchDetails:true,noGuestRespond:true,tileFallback:true,webglCluster:true,initialFailureRetry:true,narrowWeb:true,pageErrors:errors},null,2));
} finally {await browser.close();await server.close();}
