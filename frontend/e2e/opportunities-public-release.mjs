// Read-only verification: exact deployed bytes, public shop and protected routes.
import {chromium,expect} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root='https://app.grasskickz.com',build='dist/opportunities-approved-20260913',out='review/opportunities-release-20260913';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const manifest=JSON.parse(await readFile(build+'/.vite/manifest.json','utf8'));
 const entries=['index.html','src/pages/ClubWorkspacePage.tsx','src/pages/ParentHubPage.tsx','src/pages/CommerceDemoPage.tsx',Object.keys(manifest).find(key=>key.startsWith('_ClubStorePage-')),'src/pages/StoreProductPage.tsx'];
 const files=new Set(['index.html']);const visited=new Set();
 const collect=key=>{if(visited.has(key))return;visited.add(key);const item=manifest[key];if(!item)throw Error('Missing build entry: '+key);files.add(item.file);(item.css||[]).forEach(file=>files.add(file));(item.imports||[]).forEach(collect);};entries.forEach(collect);
 const hashes={};const hash=data=>createHash('sha256').update(data).digest('hex');
 for(const file of files){const res=await context.request.get(root+'/'+file);expect(res.status()).toBe(200);hashes[file]=hash(await res.body());expect(hashes[file]).toBe(hash(await readFile(build+'/'+file)));}
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(root+'/store');await expect(page.getByRole('heading',{name:'Store',exact:true})).toBeVisible();await page.screenshot({path:out+'/public-store.png'});
 for(const route of ['/parent','/demo/commerce','/clubs/1/workspace']){await page.goto(root+route);await expect(page).toHaveURL(/\/login\?next=/);}
 const parent=await context.request.get(root+'/api/parents/hub');expect([401,403]).toContain(parent.status());
 expect(errors).toEqual([]);const report={passed:true,root,release:'opportunities-approved-20260913',verifiedAssetCount:files.size,hashes,protectedRoutes:true,parentUnauthenticatedStatus:parent.status(),errors};await writeFile(out+'/public-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,verifiedAssets:files.size,errors}));
} finally {await browser.close();}
