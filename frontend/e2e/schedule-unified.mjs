import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const output='C:/Users/daddo/IdeaProjects/GrassKickZ/outputs/schedule-unified-20260921/visual';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1536,height:1000},timezoneId:'Asia/Tbilisi'});
const page=await context.newPage();const errors=[];const checks=[];
page.on('pageerror',error=>errors.push(error.message));
const base='http://127.0.0.1:5191';
await context.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
const open=async(query='')=>{await page.goto(`${base}/e2e/fixtures/schedule-unified.html${query}`);await expect(page.getByRole('button',{name:'New event',exact:true})).toBeVisible();};
const capture=async name=>{await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`${output}/${name}.png`,fullPage:await page.getByRole('dialog').count()===0});checks.push(name);};
const next=()=>page.getByRole('button',{name:'Continue',exact:true}).click();
try {
    await open();await expect(page.locator('.swb-week-board .swb-event')).toHaveCount(6);await capture('01-busy-week-desktop');
    await page.getByRole('button',{name:'New event',exact:true}).click();await expect(page.getByRole('dialog',{name:'New event',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Activity',exact:true}).click();await page.getByLabel('Event name',{exact:true}).fill('Squad review & preparation');
    await page.getByRole('button',{name:/Repeat weekly/}).click();await capture('02-event-plan');await next();
    await page.getByRole('button',{name:'Thursday',exact:true}).click();await page.getByLabel('Location',{exact:true}).fill('Academy · Analysis room');await capture('03-dates-and-location');await next();
    await expect(page.getByRole('button',{name:'Create & send invitations'})).toBeEnabled();
    await page.getByText('Edit invited players',{exact:false}).click();await page.getByLabel('Levan Japaridze',{exact:true}).uncheck();await page.getByText('Edit invited players',{exact:false}).click();await expect(page.getByRole('button',{name:'Create & send invitations'})).toBeEnabled();await capture('04-invitations-review');
    await page.getByRole('button',{name:'Create & send invitations'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.swb-event').filter({hasText:'Squad review & preparation'}).first()).toBeVisible();checks.push('created-recurring-activity-with-selected-participants');
    await page.getByRole('button',{name:'Agenda',exact:true}).click();await page.reload();await expect(page.getByRole('button',{name:'Agenda',exact:true})).toHaveAttribute('aria-pressed','true');checks.push('remembers-calendar-view');
    await page.getByRole('button',{name:'Week board',exact:true}).click();
    await open('?empty=1');await capture('05-empty-week');await expect(page.locator('.swb-rail')).toHaveCount(0);
    await open('?theme=light');await capture('06-light-week');
    for(const width of [390,320,768]){
        await page.setViewportSize({width,height:844});await open();await capture(`07-week-${width}`);
        await page.getByRole('button',{name:'New event',exact:true}).click();await page.getByLabel('Event name',{exact:true}).fill('Evening training');await capture(`08-editor-${width}`);
        await next();await next();await expect(page.getByRole('button',{name:'Create & send invitations'})).toBeEnabled();await expect(page.getByRole('button',{name:'Create & send invitations'})).toBeInViewport();await capture(`09-review-${width}`);
        await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.getByRole('button',{name:'Discard',exact:true}).click();
    }
    await page.setViewportSize({width:1536,height:1000});await open();
    await page.locator('.swb-week-board .swb-event').filter({hasText:'Technical development'}).click();await page.getByRole('button',{name:'Edit or reschedule'}).click();
    await page.getByLabel('Apply to').selectOption('FOLLOWING');await next();await page.getByLabel('Location',{exact:true}).fill('Pitch 3');await next();
    await expect(page.getByRole('button',{name:'Confirm changes',exact:true})).toBeEnabled();await capture('10-series-change-review');
    if(errors.length)throw Error(errors.join('\n'));
}finally{await writeFile(`${output}/results.json`,JSON.stringify({checks,errors},null,2));await browser.close();}
console.log(JSON.stringify({checks,errors},null,2));
