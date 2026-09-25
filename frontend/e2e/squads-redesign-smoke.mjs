import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const out='review/squads-redesign-20260914', origin='http://127.0.0.1:5300', fixture=`${origin}/e2e/fixtures/squads-preview.html`;
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1600,height:1000},locale:'en-GB'});
const page=await context.newPage();page.setDefaultTimeout(8000);
const result={checks:[],errors:[],unexpectedNetwork:[]};
page.on('pageerror',error=>result.errors.push(error.message));
await context.route('**/*',route=>{const url=route.request().url();if(!url.startsWith(origin)&&!url.startsWith('data:')&&!url.startsWith('blob:')){if(!/fonts\.(googleapis|gstatic)\.com/.test(url))result.unexpectedNetwork.push(url);return route.abort();}return route.continue();});
const capture=async name=>{await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`${out}/${name}.png`,fullPage:true});result.checks.push(name);};
const click=async name=>page.getByRole('button',{name,exact:true}).first().click();
const selectFirst=async()=>page.locator('.sw-squad-option').filter({hasText:'First Team'}).click();
try{
 await page.goto(fixture);await page.locator('.sr-roster').waitFor();await selectFirst();await expect(page.locator('.sr-table tbody > tr')).toHaveCount(16);
 await capture('squads-desktop');
 const search=page.locator('.sw-roster-toolbar input');await search.fill('Giorgi Loria');await expect(page.locator('.sr-table tbody > tr')).toHaveCount(1);await search.fill('');
 await click('Cards');await expect(page.locator('.sr-player-card')).toHaveCount(16);await capture('squad-cards-desktop');await click('Roster');
 await page.getByRole('button',{name:'Edit shirt number for Mikheil Makatsaria'}).click();await page.getByRole('spinbutton',{name:'Shirt number'}).fill('31');await click('Save changes');await expect(page.getByRole('button',{name:'Edit shirt number for Mikheil Makatsaria'})).toHaveText('31');result.checks.push('jersey-save');
 await click('New squad');await page.getByLabel('Squad name',{exact:true}).fill('U15 Development');await page.getByLabel('Age group',{exact:true}).fill('U15');await page.getByRole('dialog').locator('select').selectOption('MIXED');await capture('new-squad-desktop');await click('Create squad');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('#sw-squad-title')).toHaveText('U15 Development');result.checks.push('created-squad-selected');
 await click('Add players');await page.getByRole('checkbox',{name:'Select Giorgi Loria',exact:true}).check();await page.getByRole('dialog').getByRole('button',{name:/^Add to squad/}).click();await expect(page.locator('.sr-table')).toContainText('Giorgi Loria');result.checks.push('add-existing-player');
 await click('Edit squad');await page.getByLabel('Squad name',{exact:true}).fill('U15 Academy');await click('Save changes');await expect(page.locator('#sw-squad-title')).toHaveText('U15 Academy');result.checks.push('edit-squad');
 await page.getByRole('link',{name:'View club teams',exact:true}).click();await expect(page.locator('.sp-squad-card')).toHaveCount(9);await capture('public-teams-desktop');
 await page.locator('.sp-squad-card').filter({hasText:'U15 Academy'}).click();await expect(page.locator('.sp-roster-main')).toContainText('Giorgi Loria');await expect(page.getByRole('button',{name:'Add players',exact:true})).toHaveCount(0);await expect(page.locator('.sr-management,.sr-card-actions,.sr-row-actions')).toHaveCount(0);result.checks.push('public-workspace-consistency-and-readonly');
 await page.goto(`${fixture}?view=roster`);await page.locator('.sr-roster').waitFor();await capture('public-roster-desktop');await click('Cards');await capture('public-cards-desktop');
 await page.goto(`${fixture}?view=players`);await page.locator('.players-table-body').waitFor();await capture('players-desktop');await page.getByRole('button',{name:/^On trial/}).click();await expect(page.getByRole('button',{name:'Promote',exact:true})).toHaveCount(4);await page.getByRole('button',{name:'Promote',exact:true}).first().click();await expect(page.getByRole('button',{name:'Promote',exact:true})).toHaveCount(3);result.checks.push('trial-promotion-callback');
 for(const width of [390,320]){
  await page.setViewportSize({width,height:844});await page.goto(fixture);await page.locator('.sr-roster').waitFor();await capture(`squads-mobile-${width}`);await click('New squad');await capture(`new-squad-mobile-${width}`);await click('Cancel');
  await page.goto(`${fixture}?view=public`);await page.locator('.sp-squad-card').first().waitFor();await capture(`public-teams-mobile-${width}`);await page.locator('.sp-squad-card').first().click();await page.locator('.sr-roster').waitFor();await capture(`public-roster-mobile-${width}`);
  await page.goto(`${fixture}?view=players`);await page.locator('.players-table-body').waitFor();await capture(`players-mobile-${width}`);
 }
 await page.setViewportSize({width:1440,height:1000});await page.goto(`${fixture}?view=public&theme=light&lang=ka`);await page.locator('.sp-squad-card').first().waitFor();await capture('public-teams-georgian-light');
 await page.goto(`${fixture}?race=1&lang=en`);await page.locator('.sw-squad-option').first().waitFor();await selectFirst();await page.locator('.sw-squad-option').filter({hasText:'U14 Girls'}).click();await expect(page.locator('#sw-squad-title')).toHaveText('U14 Girls');await click('Roster');await expect(page.locator('.sr-table tbody > tr')).toHaveCount(8);await page.waitForTimeout(550);await expect(page.locator('.sr-table tbody > tr')).toHaveCount(8);result.checks.push('late-roster-response-discarded');
 expect(result.errors).toEqual([]);expect(result.unexpectedNetwork).toEqual([]);
}catch(error){result.failed=String(error);await page.screenshot({path:`${out}/failure.png`,fullPage:true});throw error;}
finally{await writeFile(`${out}/results.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));await browser.close();}



