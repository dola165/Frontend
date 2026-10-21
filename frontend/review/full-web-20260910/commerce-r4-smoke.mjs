import {createServer} from 'vite';import {chromium,expect} from '@playwright/test';import {mkdir,writeFile} from 'node:fs/promises';
// Regression: pending uploads cannot be discarded into a replacement draft.
await mkdir('review/full-web-20260910/commerce-r4',{recursive:true});
const server=await createServer({root:process.cwd(),define:{'import.meta.env.VITE_API_BASE_URL':'"http://127.0.0.1:5213/api"','import.meta.env.VITE_ENABLE_MOCKS':'"false"'},server:{host:'127.0.0.1',port:5212,strictPort:true,hmr:false}});await server.listen();const browser=await chromium.launch({channel:'chrome',headless:true});const results={};
try{for(const feature of ['Store','Campaigns']){
 const page=await browser.newPage();let started,finish;const received=new Promise(r=>started=r);
 await page.route('http://127.0.0.1:5213/api/**',async route=>{
  if(route.request().url().includes('/media/upload')){started();await new Promise(r=>finish=r);return route.fulfill({json:{url:'/uploads/first-draft.jpg'}});}
  return route.fulfill({json:[]});
 });
 await page.goto('http://127.0.0.1:5212/e2e/fixtures/commerce-drafts.html');await page.getByRole('link',{name:feature+' tab',exact:true}).click();
 const create=feature==='Store'?'Add product':'Create campaign',label=feature==='Store'?'Product name':'Campaign title';
 await page.getByRole('button',{name:create,exact:true}).click();await page.getByLabel(label,{exact:true}).fill('First draft');
 await page.getByRole('button',{name:'Close editor',exact:true}).click();
 await page.locator('input[type=file]').setInputFiles({name:'first.png',mimeType:'image/png',buffer:Buffer.from('synthetic upload intercepted before server')});await received;
 await expect(page.getByRole('button',{name:'Discard edits',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Discard edits',exact:true}).evaluate(el=>el.click());
 await expect(page.getByLabel(label,{exact:true})).toHaveValue('First draft');
 finish();await expect(page.getByRole('button',{name:/Remove photo 1/})).toBeVisible();
 await expect(page.getByRole('button',{name:'Discard edits',exact:true})).toBeEnabled();
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Discard edits',exact:true}).focus();await page.keyboard.press('Enter');
 await page.getByRole('button',{name:create,exact:true}).click();
 await page.getByLabel(label,{exact:true}).fill('Second unrelated draft');
 await expect(page.getByRole('button',{name:/Remove photo 1/})).toHaveCount(0);
 results[feature]={pendingDiscardBlocked:true,discardAfterCompletion:true,replacementHasNoOldPhoto:true};
 await page.screenshot({path:`review/full-web-20260910/commerce-r4/${feature.toLowerCase()}.png`,fullPage:true});
 await page.close();
}await writeFile('review/full-web-20260910/commerce-r4/results.json',JSON.stringify({regression:true,api:"mocked; actual components",...results},null,2));console.log('PASS',results);}finally{await browser.close();await server.close();}
