import {createServer} from 'vite';
import {chromium, expect} from '@playwright/test';
import {mkdir, writeFile} from 'node:fs/promises';
const out='review/commerce-r2'; await mkdir(out,{recursive:true});
const server=await createServer({root:process.cwd(),define:{'import.meta.env.VITE_API_BASE_URL':'"http://127.0.0.1:5195/api"','import.meta.env.VITE_ENABLE_MOCKS':'"false"'},server:{host:'127.0.0.1',port:5194,strictPort:true,hmr:false}});
await server.listen(); const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1200,height:900}}), errors=[], writes=[];
 page.on('pageerror',e=>errors.push(e.message));
 let job={id:1,clubId:10,title:'Youth coach',description:'Original terms',status:'OPEN',version:0,engagementType:'VOLUNTEER',category:'COACHING'};
 await page.route('http://127.0.0.1:5195/api/**',async route=>{
  const request=route.request();
  if(request.method()==='PATCH') {
   const body=request.postDataJSON(); writes.push(body);
   if(body.version!==job.version) return route.fulfill({status:409,json:{error:'This posting changed. Your changes were not applied.'}});
   job={...job,...body,version:job.version+1}; return route.fulfill({json:job});
  }
  return route.fulfill({json:request.url().endsWith('/jobs/all')?[job]:[]});
 });
 await page.goto('http://127.0.0.1:5194/e2e/fixtures/commerce-drafts.html');
 await page.getByRole('link',{name:'Jobs tab',exact:true}).click();
 await page.getByRole('button',{name:'Edit Youth coach'}).click();
 await page.getByLabel('Job description').fill('My unsaved terms');
 job={...job,version:1,description:'New paid terms',engagementType:'PAID'};
 await page.getByRole('button',{name:/^Save/}).click();
 await expect(page.getByText('This posting changed. Your changes were not applied.')).toBeVisible();
 await page.getByRole('button',{name:'View latest saved posting'}).click();
 await expect(page.getByRole('region',{name:'Latest saved posting'})).toContainText('New paid terms');
 await expect(page.getByLabel('Job description')).toHaveValue('My unsaved terms');
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:out+'/conflict-recovery-narrow.png',fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 const replace=page.getByRole('button',{name:'Discard my draft and use latest posting'});
 await replace.focus(); await page.keyboard.press('Enter');
 await expect(page.getByLabel('Job description')).toHaveValue('New paid terms');
 await page.getByRole('button',{name:/^Save/}).click();
 await expect(page.getByLabel('Job description')).toHaveCount(0);
 expect(writes.map(w=>w.version)).toEqual([0,1]); expect(job.engagementType).toBe('PAID'); expect(errors).toEqual([]);
 await writeFile(out+'/results.json',JSON.stringify({draftRetained:true,latestPreview:true,explicitKeyboardReplacement:true,narrowLayout:true,retryVersions:[0,1],api:'mocked; actual workspace and API client'},null,2));
 console.log('PASS Jobs stale draft, latest preview, explicit replacement and revision-aware retry');
} finally {await browser.close();await server.close();}
