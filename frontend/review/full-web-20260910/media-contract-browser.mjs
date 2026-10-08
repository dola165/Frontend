// Fresh real-API media workflow, then current Home composer vs the upload contract.
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium, expect} from '@playwright/test';
await import('../../e2e/gk18-media-smoke.mjs');
const fixture=JSON.parse(await readFile(process.argv[2],'utf8'));
const out='C:/Users/daddo/IdeaProjects/GrassKickZ/docs/review-reproductions/full-web-20260910/media-contract';
await mkdir(out,{recursive:true});
const server=await createServer({root:process.env.GK_MEDIA_FRONTEND,configFile:process.env.GK_MEDIA_FRONTEND+'/vite.config.ts',define:{'import.meta.env.VITE_API_BASE_URL':JSON.stringify(fixture.backend+'/api'),'import.meta.env.VITE_ENABLE_MOCKS':'"false"'},server:{host:'127.0.0.1',port:5184,strictPort:true,hmr:false}});
await server.listen();const browser=await chromium.launch({channel:'chrome',headless:true});const results={diagnosticAssertsBug:true,backend:'real disposable Spring/PostgreSQL',cases:[]};
try {
 const context=await browser.newContext({viewport:{width:1280,height:900}});
 await context.addInitScript(token=>{localStorage.setItem('accessToken',token);localStorage.setItem('i18nextLng','en');},fixture.token);
 await context.route('**/*',route=>{
   const url=new URL(route.request().url());
   return [fixture.backend,'http://127.0.0.1:5184'].includes(url.origin)?route.continue():route.abort();
 });
 const page=await context.newPage();
 await page.goto('http://127.0.0.1:5184/home');
 const text=page.getByRole('textbox',{name:'Create a post'});
 await expect(text).toBeVisible({timeout:20000});
 await text.fill('Synthetic media capability review');
 for(const [name,mimeType,buffer,selector] of [
  ['review.mp4','video/mp4',Buffer.from('synthetic selected video'),'input[accept="video/*"]'],
  ['review-large.png','image/png',Buffer.concat([Buffer.from(fixture.image,'base64'),Buffer.alloc(11*1024*1024)]),'input[accept="image/*"]'],
 ]) {
   await page.locator(selector).setInputFiles({name,mimeType,buffer});
   await expect(page.getByRole('button',{name:'Publish post'})).toBeEnabled();
   await expect(page.getByRole('button',{name:'Remove attachment'})).toBeVisible();
   const uploadOutcome=Promise.race([
     page.waitForResponse(r=>r.url().includes('/media/upload') && r.request().method()==='POST').then(async response=>({kind:'response',status:response.status(),body:await response.text()})),
     page.waitForEvent('requestfailed',{predicate:r=>r.url().includes('/media/upload') && r.method()==='POST'}).then(request=>({kind:'request-failed',error:request.failure()?.errorText})),
   ]);
   await page.getByRole('button',{name:'Publish post'}).click();
   const outcome=await uploadOutcome;
   if(outcome.kind==='response') expect([400,413]).toContain(outcome.status);
   else expect(mimeType).toBe('image/png');
   await expect(page.getByText(/Failed to publish this post/)).toBeVisible();
   await expect(text).toHaveValue('Synthetic media capability review');
   results.cases.push({name,clientAccepted:true,...outcome});
   await page.screenshot({path:out+'/'+name+'.png',fullPage:true});
   await page.getByRole('button',{name:'Remove attachment'}).click();
 }
 console.log('REPRODUCED: Home accepts video and >10 MiB images; real backend refuses both.');
}finally {await writeFile(out+'/results.json',JSON.stringify(results,null,2));await browser.close();await server.close();}
