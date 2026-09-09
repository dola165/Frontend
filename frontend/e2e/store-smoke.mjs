import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url'; import path from 'node:path';
import {createServer} from 'vite'; import {chromium,expect} from '@playwright/test';
const fixture=JSON.parse(await readFile(process.argv[2],'utf8'));
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'), output=path.resolve(path.dirname(process.argv[2]),'store-browser');
await mkdir(output,{recursive:true});
const server=await createServer({root,configFile:path.join(root,'vite.config.ts'),define:{'import.meta.env.VITE_API_BASE_URL':JSON.stringify(fixture.backend+'/api'),'import.meta.env.VITE_ENABLE_MOCKS':'"false"'},server:{host:'127.0.0.1',port:5179,strictPort:true,hmr:false}});
await server.listen(); const browser=await chromium.launch({channel:'chrome',headless:true}); const results={};
try {
 const context=await browser.newContext({viewport:{width:1280,height:900}});context.setDefaultTimeout(12000);
 await context.addInitScript(owner=>{localStorage.setItem('accessToken',owner.token);localStorage.setItem('userId',String(owner.id));},fixture.owner);
 const headers={Authorization:'Bearer '+fixture.owner.token};
 // Only synthetic image bytes are stubbed; catalog, inventory and cart use real HTTP/database records.
 await context.route('**/uploads/store-demo-*.svg',route=>route.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750"><rect width="600" height="750" fill="#142a27"/><path d="M180 140 90 210 145 330 200 300 200 590 400 590 400 300 455 330 510 210 420 140 360 160Q300 240 240 160Z" fill="${route.request().url().includes('back')?'#446761':'#e9e7d8'}"/><text x="300" y="375" text-anchor="middle" font-size="34" font-family="sans-serif" fill="#132c27">DEMO FC</text><text x="300" y="690" text-anchor="middle" font-size="17" font-family="sans-serif" fill="#acbbb6">SYNTHETIC PRODUCT IMAGE</text></svg>`}));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url='http://127.0.0.1:5179/e2e/fixtures/store.html?club='+fixture.club;
 await page.goto(url); await page.evaluate(()=>document.documentElement.classList.add('dark')); await page.getByRole('button',{name:'Add product'}).click();
 await page.getByLabel('Product name').fill('Demo home shirt'); await page.getByLabel('Description',{exact:true}).fill('Synthetic demonstration merchandise.');
 await page.getByLabel('Price',{exact:true}).fill('12.34'); await page.getByLabel('Variant 1',{exact:true}).fill('M'); await page.getByLabel('Stock 1',{exact:true}).fill('5');
 await page.getByRole('button',{name:'Save product',exact:true}).click(); await expect(page.getByRole('status')).toContainText('Product saved.');
 let response=await context.request.get(fixture.backend+'/api/store/products?clubId='+fixture.club);expect((await response.json()).totalElements).toBe(0);

 await page.getByRole('button',{name:'Publish Demo home shirt',exact:true}).click();await expect(page.getByRole('status')).toContainText('Product published.');
 response=await context.request.get(fixture.backend+'/api/store/products?clubId='+fixture.club);let product=(await response.json()).content[0];expect(product.variants[0].stock).toBe(5);expect(product.version).toBe(1);
 await page.screenshot({path:path.join(output,'workspace.png'),fullPage:true});
 response=await context.request.patch(`${fixture.backend}/api/clubs/${fixture.club}/store/products/${product.id}`,{headers,data:{version:product.version,images:['/uploads/store-demo-front.svg','/uploads/store-demo-back.svg'],variants:[...product.variants,{label:'XL',stock:0}]}});expect(response.status()).toBe(200);product=await response.json();

 await page.getByRole('link',{name:'View club store'}).click();await expect(page.getByRole('heading',{name:'Store Demo FC store'})).toBeVisible();
 await page.getByRole('link',{name:/Demo home shirt/}).click();await expect(page.getByRole('heading',{name:'Demo home shirt'})).toBeVisible();
 await page.getByRole('button',{name:'View photo 2'}).focus();await page.keyboard.press('Enter');
 await expect(page.getByRole('img',{name:'Demo home shirt - photo 2'})).toBeVisible();
 await expect(page.getByRole('button',{name:'XL - out of stock'})).toBeDisabled();
 await page.screenshot({path:path.join(output,'product-desktop.png'),fullPage:true});
 await page.getByLabel('Quantity',{exact:true}).fill('2');await page.getByRole('button',{name:'Add to cart'}).click();await expect(page.getByRole('status')).toContainText('Added to your cart');
 await page.getByRole('link',{name:'Open cart'}).click();await expect(page.getByText('Product subtotal:')).toContainText('24.68');await expect(page.getByRole('button',{name:'Checkout unavailable'})).toBeDisabled();
 await page.screenshot({path:path.join(output,'cart.png'),fullPage:true});
 results.managerAndCart={draftHidden:true,published:true,stockPersisted:true,exactSubtotal:2468,checkoutDisabled:true};
 // Concurrent editing through the real API must produce a conflict and preserve the form.
 await page.getByRole('link',{name:'Manage Store'}).click();await page.getByRole('button',{name:'Edit Demo home shirt',exact:true}).click();
 await page.getByLabel('Stock 1',{exact:true}).fill('4');
 response=await context.request.patch(`${fixture.backend}/api/clubs/${fixture.club}/store/products/${product.id}`,{headers,data:{version:product.version,variants:[{...product.variants[0],stock:1}]}});expect(response.status()).toBe(200);
 await page.getByRole('button',{name:'Save product',exact:true}).click();await expect(page.getByRole('alert')).toContainText('This product changed');await expect(page.getByLabel('Stock 1',{exact:true})).toHaveValue('4');
 await page.getByRole('button',{name:'Close editor'}).click();await page.getByRole('button',{name:'Discard edits',exact:true}).click();
 await page.getByRole('link',{name:'View club store'}).click();await page.getByRole('link',{name:'Open cart'}).click();await expect(page.getByRole('alert')).toContainText('Not enough stock');await expect(page.getByText('Product subtotal:')).toHaveCount(0);
 results.concurrentEdit={conflict:true,editsRetained:true,changedStockRejected:true};
 for(const [name,price] of [['Demo away shirt',35],['Demo training top',24],['Demo supporter kit',42]]) {
  response=await context.request.post(`${fixture.backend}/api/clubs/${fixture.club}/store/products`,{headers,data:{name,price,category:'SHIRT',currency:'GEL',images:['/uploads/store-demo-front.svg'],variants:[{label:'M',stock:3}],active:true}});expect(response.status()).toBe(201);
 }
 await page.getByRole('link',{name:'Browse all stores'}).click();await expect(page.getByRole('heading',{name:'Demo home shirt'})).toBeVisible();
 await page.getByLabel('Search',{exact:true}).fill('no matching product');await expect(page.getByRole('status')).toHaveText('0 products matching this search');
 await page.getByRole('button',{name:'Reset filters'}).click();await expect(page.getByRole('heading',{name:'Demo home shirt'})).toBeVisible();
 await page.screenshot({path:path.join(output,'catalog-desktop.png'),fullPage:true});
 const panel=await page.locator('.store-filter-panel').boundingBox(),grid=await page.locator('.store-product-grid').boundingBox();expect(panel.x+panel.width).toBeLessThan(grid.x);expect(grid.y).toBeLessThan(400);
 await page.setViewportSize({width:390,height:844});
 await expect(page.locator('#store-filters')).toBeHidden();
 await page.getByRole('button',{name:'Filters',exact:true}).focus();await page.keyboard.press('Enter');await expect(page.locator('#store-filters')).toBeVisible();
 await page.getByRole('button',{name:'Show products'}).click();await expect(page.getByRole('button',{name:'Filters',exact:true})).toBeFocused();
expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:path.join(output,'store-narrow.png'),fullPage:true});
 // Genuine guest product access, and no products leaking into another club storefront.
 const guest=await browser.newContext();const guestPage=await guest.newPage();
 await guestPage.goto(url+'&path='+encodeURIComponent('/store/products/'+product.id));await expect(guestPage.getByRole('heading',{name:'Demo home shirt'})).toBeVisible();
 response=await guest.request.get(`${fixture.backend}/api/store/products?clubId=${fixture.otherClub}`);expect((await response.json()).totalElements).toBe(0);
 response=await guest.request.get(`${fixture.backend}/api/clubs/${fixture.club}/store/products/all`);expect([401,403]).toContain(response.status());
 results.layout={desktopSidebar:true,productsAbove400px:true,mobileFiltersToggle:true,focusReturns:true,keyboardGallery:true};
 results.discovery={globalAndClub:true,guestDetails:true,otherClubExcluded:true,narrowLayoutFits:true};
 expect(errors).toEqual([]);console.log('PASS',JSON.stringify(results));
} finally {await writeFile(path.join(output,'results.json'),JSON.stringify(results,null,2));await browser.close();await server.close();}
