import {chromium,expect} from '@playwright/test';
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:5300')?r.continue():r.abort());
const checks=[];
for(const width of [768,900,1024,1280]){
 await page.setViewportSize({width,height:800});await page.goto('http://127.0.0.1:5300/e2e/fixtures/schedule-preview.html?newEvent=1&lang=en');
 await page.getByLabel('Event name',{exact:true}).fill('Layout check');await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(page.getByRole('button',{name:'Create event',exact:true})).toBeInViewport();
 const size=await page.locator('.schedule-compose').evaluate(el=>({width:el.clientWidth,scrollWidth:el.scrollWidth}));if(size.scrollWidth>size.width+1)throw Error(`Editor overflow ${width}: ${JSON.stringify(size)}`);
 await page.screenshot({path:`review/schedule-redesign-20260913/editor-${width}.png`});checks.push(width);
}
console.log('Intermediate-width editor checks passed:',checks);await browser.close();
