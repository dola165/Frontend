import {createServer} from 'vite';
import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const out='review/full-web-20260910/commerce-r3';await mkdir(out,{recursive:true});
const server=await createServer({root:process.cwd(),define:{'import.meta.env.VITE_API_BASE_URL':'"http://127.0.0.1:5197/api"','import.meta.env.VITE_ENABLE_MOCKS':'"false"'},server:{host:'127.0.0.1',port:5196,strictPort:true,hmr:false}});
await server.listen();const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1100,height:850}}), revisions=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 let product={id:1,clubId:10,name:'Home shirt',price:10,currency:'GEL',version:0,active:true,variants:[{id:1,label:'M',stock:5}]},archived=false;
 await page.route('http://127.0.0.1:5197/api/**',route=>{
  const request=route.request(),url=new URL(request.url());
  if(request.method()==='DELETE') {
   const version=url.searchParams.get('version');revisions.push(version);
   if(Number(version)!==product.version || version===null) return route.fulfill({status:409,json:{error:'This product changed. It was not archived. Reload products and review it before confirming again.'}});
   archived=true;return route.fulfill({json:{message:'Store product archived.'}});
  }
  return route.fulfill({json:archived?[]:[product]});
 });
 await page.goto('http://127.0.0.1:5196/e2e/fixtures/commerce-drafts.html');
 await page.getByRole('button',{name:'Archive Home shirt',exact:true}).click();
 product={...product,name:'Updated home shirt',version:1,price:15};
 await page.getByRole('button',{name:'Confirm archive',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('It was not archived');expect(archived).toBe(false);
 await page.getByRole('button',{name:'Reload products'}).click();
 await expect(page.getByRole('heading',{name:'Updated home shirt'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Confirm archive',exact:true})).toHaveCount(0);
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Archive Updated home shirt',exact:true}).click();
 await page.screenshot({path:out+'/fresh-confirmation-narrow.png',fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Confirm archive',exact:true}).focus();await page.keyboard.press('Enter');
 await expect(page.getByRole('status')).toHaveText('Product archived.');
 await expect(page.getByRole('heading',{name:'Updated home shirt'})).toHaveCount(0);
 expect(revisions).toEqual(['0','1']);expect(errors).toEqual([]);
 await writeFile(out+'/results.json',JSON.stringify({staleArchiveRejected:true,reloadRequiresNewConfirmation:true,freshArchive:true,queryRevisions:revisions,keyboardAndNarrow:true,api:'mocked; actual workspace and API client'},null,2));
 console.log('PASS stale archive rejection, explicit fresh confirmation and version query');
} finally {await browser.close();await server.close();}
