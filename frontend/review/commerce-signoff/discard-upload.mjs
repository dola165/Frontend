import {createServer} from 'vite';import {chromium,expect} from '@playwright/test';import {writeFile} from 'node:fs/promises';
// Diagnostic assertions deliberately prove the currently faulty cross-draft completion.
const server=await createServer({root:process.cwd(),define:{'import.meta.env.VITE_API_BASE_URL':'"http://127.0.0.1:5203/api"','import.meta.env.VITE_ENABLE_MOCKS':'"false"'},server:{host:'127.0.0.1',port:5202,strictPort:true,hmr:false}});await server.listen();const browser=await chromium.launch({channel:'chrome',headless:true});const results={};
try{for(const feature of ['Store','Campaigns']){
 const page=await browser.newPage();let started,finish;const received=new Promise(r=>started=r);
 await page.route('http://127.0.0.1:5203/api/**',async route=>{
  if(route.request().url().includes('/media/upload')){started();await new Promise(r=>finish=r);return route.fulfill({json:{url:'/uploads/first-draft.jpg'}});}
  return route.fulfill({json:[]});
 });
 await page.goto('http://127.0.0.1:5202/e2e/fixtures/commerce-drafts.html');await page.getByRole('link',{name:feature+' tab',exact:true}).click();
 const create=feature==='Store'?'Add product':'Create campaign',label=feature==='Store'?'Product name':'Campaign title';
 await page.getByRole('button',{name:create,exact:true}).click();await page.getByLabel(label,{exact:true}).fill('First draft');
 await page.getByRole('button',{name:'Close editor',exact:true}).click();
 await page.locator('input[type=file]').setInputFiles({name:'first.png',mimeType:'image/png',buffer:Buffer.from('synthetic upload intercepted before server')});await received;
 await expect(page.getByRole('button',{name:'Discard edits',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Discard edits',exact:true}).click();
 await page.getByRole('button',{name:create,exact:true}).click();await page.getByLabel(label,{exact:true}).fill('Second unrelated draft');
 finish();await expect(page.getByRole('button',{name:/Remove photo 1/})).toBeVisible();await expect(page.getByLabel(label,{exact:true})).toHaveValue('Second unrelated draft');
 results[feature]= {discardAllowedDuringUpload:true,oldUploadAppearedInNewDraft:true};await page.screenshot({path:`review/commerce-signoff/discard-upload-${feature.toLowerCase()}.png`,fullPage:true});await page.close();
}await writeFile('review/commerce-signoff/discard-upload-results.json',JSON.stringify({diagnostic:true,...results},null,2));console.log('REPRODUCED',results);}finally{await browser.close();await server.close();}
