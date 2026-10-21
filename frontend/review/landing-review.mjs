import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const out='review/landing-redesign-20260913';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5187/');
await page.waitForTimeout(5500);
await page.screenshot({path:out+'/desktop-entry.png'});
for(const [name,selector] of [['story','#the-game'],['roles','#landing-audiences'],['journey','#landing-pillars'],['footer','.landing-final']]){
 await page.locator(selector).scrollIntoViewIfNeeded();await page.waitForTimeout(800);
 await page.screenshot({path:out+'/'+name+'.png'});
}
await page.getByRole('tab',{name:'I run a club'}).click();
await expect(page.getByRole('tabpanel')).toContainText('Less chasing.');
await page.getByRole('tab',{name:'I run a club'}).press('ArrowRight');
await expect(page.getByRole('tabpanel')).toContainText('Every club has a story.');
await page.getByRole('button',{name:'Open Playground'}).click();
await expect(page.getByRole('dialog')).toBeVisible();await page.screenshot({path:out+'/playground.png'});
await page.getByRole('button',{name:'Shoot',exact:true}).click();
await expect(page.getByRole('dialog').getByRole('status')).toContainText('That’s a goal!',{timeout:5000});
await page.getByRole('button',{name:'Next ball',exact:true}).click();
await expect(page.getByRole('dialog').getByRole('status')).toContainText('Drag the ball backwards');
await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
await expect(page.getByRole('button',{name:'Open Playground'})).toBeFocused();
await page.getByRole('button',{name:'Open Playground'}).click();
await expect(page.getByRole('dialog')).toBeVisible();
await page.getByRole('button',{name:'Play the rebounds',exact:true}).click();
await page.getByRole('button',{name:'Close Playground'}).click();
for (const width of [390,768,1920]) {
 await page.setViewportSize({width,height:900});await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(800);
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 await page.screenshot({path:out+`/entry-${width}.png`});
 if(width===390){await page.locator('#landing-audiences').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/roles-mobile.png'});await page.getByRole('button',{name:'Open Playground'}).click();await page.screenshot({path:out+'/playground-mobile.png'});await page.getByRole('button',{name:'Close Playground'}).click();}
}
await writeFile(out+'/report.json',JSON.stringify({errors,checks:['entry widths','role tabs and keyboard','playground opens, scores, resets, closes and restores focus']},null,2));
console.log(JSON.stringify({errors}));await browser.close();
