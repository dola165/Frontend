import {createServer} from 'vite';
import {chromium,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
// Diagnostic: passing assertions below confirm a defect, not healthy behavior.
const server=await createServer({root:process.cwd(),define:{'import.meta.env.VITE_API_BASE_URL':'"http://127.0.0.1:5201/api"','import.meta.env.VITE_ENABLE_MOCKS':'"false"'},server:{host:'127.0.0.1',port:5200,strictPort:true,hmr:false}});
await server.listen();const browser=await chromium.launch({channel:'chrome',headless:true});const results={};
try {
 for(const feature of ['Store','Campaigns','Jobs']) {
  const page=await browser.newPage(); let pending,finish,done; const received=new Promise(r=>pending=r), completed=new Promise(r=>done=r);
  let job={id:1,clubId:10,title:'Review coach',description:'Terms',status:'OPEN',version:0,category:'COACHING',engagementType:'PAID'};
  const product={id:1,clubId:10,name:'Review shirt',price:10,currency:'GEL',version:0,active:true,variants:[{id:1,label:'M',stock:3}]};
  const campaign={id:1,clubId:10,title:'Review pitch',summary:'Pitch',description:'Youth pitch',beneficiary:'Youth',category:'FACILITIES',currency:'GEL',status:'PUBLISHED',phase:'ACTIVE',version:0,images:[],updates:[]};
  await page.route('http://127.0.0.1:5201/api/**',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(req.method()==='PATCH'||req.method()==='POST'||req.method()==='DELETE') {
    pending();await new Promise(r=>finish=r);
    if(feature==='Jobs'){job={...job,status:'CLOSED',version:1};await route.fulfill({json:job});}
    else await route.fulfill({status:409,json:{error:'Review conflict: a colleague changed this record.'}});
    done();return;
   }
   return route.fulfill({json:url.pathname.includes('campaigns')?[campaign]:url.pathname.includes('jobs')?[job]:[product]});
  });
  await page.goto('http://127.0.0.1:5200/e2e/fixtures/commerce-drafts.html');
  await page.getByRole('link',{name:feature+' tab',exact:true}).click();
  if(feature==='Store'){await page.getByRole('button',{name:'Archive Review shirt',exact:true}).click();await page.getByRole('button',{name:'Confirm archive',exact:true}).click();}
  if(feature==='Campaigns')await page.getByRole('button',{name:'Pause Review pitch',exact:true}).click();
  if(feature==='Jobs')await page.getByRole('button',{name:'Close',exact:true}).click();
  await received;
  await page.getByRole('link',{name:'Overview tab',exact:true}).click();
  await page.getByRole('link',{name:feature+' tab',exact:true}).click();
  if(feature==='Jobs') {
   await expect(page.getByRole('button',{name:'Close',exact:true})).toBeEnabled();
   const warned=await page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented;});
   expect(warned).toBe(false);results.jobsPendingUntracked=true;
  } else await expect(page.getByRole('button',{name:feature==='Store'?'Archive Review shirt':'Pause Review pitch',exact:true})).toBeDisabled();
  finish();await completed;
  // Wait for the real client promise and its UI continuation to finish.
  if(feature!=='Jobs')await expect(page.getByRole('button',{name:feature==='Store'?'Archive Review shirt':'Pause Review pitch',exact:true})).toBeEnabled();
  else { await page.waitForResponse(r=>r.url().endsWith('/jobs/all')).catch(()=>{}); }
  await expect(page.getByRole('alert')).toHaveCount(0);
  if(feature==='Jobs'){await expect(page.getByRole('button',{name:'Close',exact:true})).toBeVisible();results.jobsServerClosedButRemountedListOpen=true;}
  else results[feature.toLowerCase()+'ConflictLostAfterRemount']=true;
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:`review/commerce-signoff/pending-${feature.toLowerCase()}.png`,fullPage:true});await page.close();
 }
 await writeFile('review/commerce-signoff/pending-results.json',JSON.stringify({diagnostic:true,api:'controlled delayed mocked responses; real workspace components and client',...results},null,2));console.log('REPRODUCED',results);
}finally{await browser.close();await server.close();}
