import {chromium,expect} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root='https://app.grasskickz.com', build='dist/landing-redesign', out='review/landing-public-release-20260913';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const context=await browser.newContext({viewport:{width:1600,height:1000},reducedMotion:'reduce'});
 const page=await context.newPage(), errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const manifest=JSON.parse(await readFile(build+'/.vite/manifest.json','utf8'));
 const entries=['index.html','src/pages/LandingPage.tsx','src/components/landing/LandingPlayground.tsx'];
 const files=['index.html','landing/after-the-whistle.png',...entries.flatMap(key=>[manifest[key].file,...(manifest[key].css||[])])];
 const hashes={};
 for(const file of new Set(files)) {
  const response=await context.request.get(root+'/'+file);
  expect(response.status()).toBe(200);
  const hash=data=>createHash('sha256').update(data).digest('hex');
  const actual=hash(await response.body());
  expect(actual).toBe(hash(await readFile(build+'/'+file)));
  hashes[file]=actual;
 }
 await page.goto(root+'/');
 await expect(page.getByRole('heading',{name:'Find your place in football.'})).toBeVisible();
 await expect(page.getByRole('button',{name:/^Open filters/})).toBeVisible();
 await page.waitForTimeout(2500);
 await page.screenshot({path:out+'/live-desktop.png'});
 for(const [name,scene] of [['I want to play','player'],['I run a club','club'],['I love the game','supporter']]) {
  await page.getByRole('tab',{name}).click();
  await expect(page.locator('[data-role-scene]')).toHaveAttribute('data-role-scene',scene);
  await expect(page.locator('.landing-role-copy')).toHaveCount(1);
 }
 await page.getByRole('tabpanel').scrollIntoViewIfNeeded();
 await page.screenshot({path:out+'/live-roles.png'});
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:/^Open filters/}).click();
 const dialog=page.getByRole('dialog',{name:'Find football clubs'});
 await expect(dialog).toBeVisible();
 await expect(dialog.getByRole('button',{name:'Show results',exact:true})).toBeInViewport();
 await page.screenshot({path:out+'/live-mobile-filters.png'});
 await page.keyboard.press('Escape');
 await expect(dialog).toHaveCount(0);
 expect(errors).toEqual([]);
 await writeFile(out+'/report.json',JSON.stringify({passed:true,root,hashes,errors},null,2));
 console.log(JSON.stringify({passed:true,verifiedAssets:Object.keys(hashes).length,errors}));
}finally{await browser.close();}
