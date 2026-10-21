import {chromium,expect} from '@playwright/test';
const browser=await chromium.launch({headless:true,channel:'chrome'});const page=await browser.newPage({viewport:{width:1536,height:960}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5187/world');await page.waitForTimeout(6500);
console.log((await page.locator('body').innerText()).slice(0,1000));console.log('Errors',JSON.stringify(errors));await page.screenshot({path:'review/atlas-verification/local-world.png'});
await browser.close();
