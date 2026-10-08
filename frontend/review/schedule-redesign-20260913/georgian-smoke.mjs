import {chromium, expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1600,height:1000},locale:'ka-GE',timezoneId:'Asia/Tbilisi'});
await context.addInitScript(()=>localStorage.setItem('i18nextLng','ka'));
const page=await context.newPage();
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
await context.route('https://fonts.googleapis.com/**',route=>route.abort());
await context.route('https://fonts.gstatic.com/**',route=>route.abort());
try {
 await page.goto('http://127.0.0.1:5300/e2e/fixtures/schedule-preview.html?newEvent=1');
 const modal=page.getByRole('dialog');
 await expect(modal).toHaveAccessibleName('ახალი ღონისძიება');
 await modal.getByRole('button',{name:/ყოველკვირეული ვარჯიში რეგულარული/}).click();
 await expect(modal).toHaveAccessibleName('ახალი ვარჯიშის განრიგი');
 await modal.getByLabel('ვარჯიშის დასახელება',{exact:true}).fill('U16 · ტექნიკური ვარჯიში');
 await modal.getByLabel('გუნდი',{exact:true}).selectOption('71101');
 await page.screenshot({path:'review/schedule-redesign-20260913/14-georgian-plan.png',fullPage:true});
 await modal.getByRole('button',{name:'გაგრძელება',exact:true}).click();
 await expect(modal.getByRole('button',{name:'ორშაბათი',exact:true})).toBeVisible();
 await expect(modal.getByRole('button',{name:'ოთხშაბათი',exact:true})).toBeVisible();
 await expect(modal.getByRole('complementary')).not.toContainText('First sessions');
 await modal.getByRole('button',{name:'ოთხშაბათი',exact:true}).click();
 await page.screenshot({path:'review/schedule-redesign-20260913/15-georgian-days.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await expect.poll(()=>modal.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
 await expect(modal.getByRole('button',{name:'გაგრძელება',exact:true})).toBeInViewport();
 await page.screenshot({path:'review/schedule-redesign-20260913/16-georgian-mobile.png',fullPage:true});
 await modal.getByRole('button',{name:'გაგრძელება',exact:true}).click();
 await expect(modal.getByRole('button',{name:'ვარჯიშის განრიგის შექმნა',exact:true})).toBeInViewport();
 await modal.getByRole('button',{name:'ვარჯიშის განრიგის შექმნა',exact:true}).click();
 await expect(modal).toHaveCount(0);
 await expect(page.getByRole('button',{name:/U16 · ტექნიკური ვარჯიში/}).first()).toBeVisible();
 if(errors.length)throw new Error(errors.join('\n'));
 await writeFile('review/schedule-redesign-20260913/georgian-results.json',JSON.stringify({passed:true,checks:['Georgian editor labels','localized weekdays and dates','mobile layout and footer','Georgian create flow'],errors},null,2));
 process.stdout.write('Georgian editor, weekday/date, mobile layout and local save checks passed.\n');
} finally {await browser.close();}

