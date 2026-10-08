import {chromium} from '@playwright/test';
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1600,height:1080}});
await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:5300')?r.continue():r.abort());
await page.goto('http://127.0.0.1:5300/e2e/fixtures/schedule-preview.html?lang=en&newEvent=1');
await page.getByRole('button',{name:/^Weekly training A regular/}).click();await page.getByLabel('Training name',{exact:true}).fill('U16 · Evening training');await page.getByLabel('Squad',{exact:true}).selectOption('71101');await page.getByRole('button',{name:'Continue',exact:true}).click();
await page.getByRole('button',{name:'Wednesday',exact:true}).click();await page.getByRole('button',{name:'Friday',exact:true}).click();await page.getByLabel('Start time',{exact:true}).fill('18:00');await page.getByRole('button',{name:'1½ hours',exact:true}).click();await page.getByLabel('Location',{exact:true}).fill('Dinamo Academy · Pitch 2');await page.locator('.schedule-compose-card h3').focus();
await page.locator('.schedule-compose').screenshot({path:'review/schedule-redesign-20260913/preview-weekly-editor.png'});await browser.close();
