// Candidate mode serves production assets in an isolated browser; all API data is live.
import { chromium, expect } from '@playwright/test';
import { readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
const root='C:/Users/daddo/IdeaProjects/GrassKickZ/outputs/agent-dola-venues-20260921';
const candidate=process.env.VENUE_BUILD_DIRECTORY;
const phase=candidate?'candidate':'live';
const output=path.join(root,phase);await mkdir(output,{recursive:true});
const credentials=JSON.parse(await readFile(path.join(homedir(),'Documents/GrassKickZ-demo/venue-owner-demo-login.json'),'utf8'));
const origin='https://app.grasskickz.com';
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[],checks=[];let activePage;
async function newPage(){
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  activePage=page;page.setDefaultTimeout(10000);
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{localStorage.setItem('i18nextLng','en');localStorage.setItem('theme-preference','light');});
  if(candidate) await page.route(origin+'/**',async route=>{
    const u=new URL(route.request().url());
    if(u.pathname.startsWith('/api/') || u.pathname.startsWith('/uploads/') || u.pathname.startsWith('/ws')) return route.continue();
    let file=path.resolve(candidate,'.'+decodeURIComponent(u.pathname));
    if(!file.startsWith(path.resolve(candidate)+path.sep))file=path.join(candidate,'index.html');
    try{if(!(await stat(file)).isFile())file=path.join(candidate,'index.html');}catch{file=path.join(candidate,'index.html');}
    const ext=path.extname(file),mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2','.json':'application/json'};
    await route.fulfill({path:file,contentType:mime[ext]||'application/octet-stream'});
  });
  return page;
}
try {
  for (const [width,height,theme] of [[1440,1000,'light'],[1100,850,'dark'],[390,844,'light']]) {
    const page=await newPage();let mutations=0;
    await page.setViewportSize({width,height});
    await page.addInitScript(theme=>localStorage.setItem('theme-preference',theme),theme);
    await page.route('**/api/venues/**',route=>{
      if(route.request().method()==='GET')return route.fallback();
      mutations++;return route.abort();
    });
    await page.goto(origin+'/login?next=%2Fstadiums%2F133%2Fmanage');
    await page.locator('#auth-login-email').fill(credentials.email);
    await page.locator('#auth-login-password').fill(credentials.password);
    await page.locator('form button[type="submit"]').click();
    await expect(page.getByRole('heading',{name:'Dighomi Sports Park · Demo',exact:true,level:1})).toBeVisible();
    if (!candidate) {
      await page.getByRole('link',{name:'Agent Dola',exact:true}).filter({visible:true}).first().click();
      const dock=page.getByRole('dialog',{name:'Agent Dola sidebar'});
      await expect(dock).toBeVisible();
      await expect(dock.getByRole('combobox',{name:'Dola context'})).toHaveValue('venue');
      await expect(dock.getByRole('button',{name:'Help me write a coach update.'})).toHaveCount(0);
      await page.screenshot({path:path.join(output,`${width}-dola-welcome.png`),fullPage:true});
      await dock.getByRole('button',{name:'Close chat'}).click();
    }
    await expect(page.getByRole('button',{name:'Overview',exact:true})).toHaveAttribute('aria-pressed','true');
    await expect(page.getByText('Checking upcoming requests…')).toHaveCount(0);
    await page.screenshot({path:path.join(output,`${width}-overview.png`),fullPage:true});
    await page.getByRole('button',{name:'Requests',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Booking requests',exact:true})).toBeVisible();
    await expect(page.getByText('Checking every upcoming request…')).toHaveCount(0);
    if(await page.getByRole('button',{name:'Accept',exact:true}).count()) {
      await page.getByRole('button',{name:'Accept',exact:true}).first().click();
      await expect(page.getByRole('region',{name:'Review booking decision'})).toBeVisible();
      await page.screenshot({path:path.join(output,`${width}-decision.png`),fullPage:true});
      await page.getByRole('button',{name:'Keep unchanged',exact:true}).click();
    }
    await page.screenshot({path:path.join(output,`${width}-requests.png`),fullPage:true});
    await page.getByRole('button',{name:'Setup & handover',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Your saved setup'})).toBeVisible();
    await page.screenshot({path:path.join(output,`${width}-setup.png`),fullPage:true});
    await page.getByRole('button',{name:/Help teams arrive/}).click();
    await expect(page.getByRole('form',{name:'Stadium page editor'}).getByLabel('Public phone',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:/Details & photos/}).click();
    await page.getByRole('button',{name:'Stadium page',exact:true}).click();
    const listing=page.getByRole('form',{name:'Stadium page editor'});
    await listing.getByLabel('Stadium name',{exact:true}).fill('Dighomi Sports Park · Live preview');
    await listing.getByLabel(/^About the stadium/).fill('Floodlit football pitches, welcoming teams throughout the week.');
    await expect(page.getByLabel('Stadium page preview').getByRole('heading')).toHaveText('Dighomi Sports Park · Live preview');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    await page.screenshot({path:path.join(output,`${width}-listing.png`),fullPage:true});
    await listing.getByRole('button',{name:/Location & contact/}).click();
    await listing.getByLabel('City',{exact:true}).fill('Tbilisi preview');
    await expect(page.getByLabel('Stadium page preview')).toContainText('Tbilisi preview');
    await listing.getByRole('button',{name:/Hours & booking rules/}).click();
    await listing.getByLabel(/^Confirmation/).selectOption('INSTANT');
    await expect(page.getByLabel('Stadium page preview')).toContainText('Instant confirmation');
    await listing.getByRole('button',{name:/Review & publish/}).click();
    await expect(listing.getByRole('heading',{name:'Review your stadium page',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Pitches',exact:true}).click();
    const pitch=page.getByRole('form',{name:'Pitch editor'});
    await pitch.getByLabel('Pitch name',{exact:true}).fill('Evening training pitch');
    await pitch.getByRole('button',{name:'Continue',exact:true}).click();
    await pitch.getByLabel('Hourly rate (GEL)',{exact:true}).fill('125');
    await expect(page.getByLabel('Pitch preview')).toContainText('125');
    await expect(page.getByLabel('Pitch preview')).toContainText('Evening training pitch');
    await page.screenshot({path:path.join(output,`${width}-pitch.png`),fullPage:true});
    await page.getByRole('button',{name:'Stadium page',exact:true}).click();
    await listing.getByRole('button',{name:/Details & photos/}).click();
    await expect(listing.getByLabel('Stadium name',{exact:true})).toHaveValue('Dighomi Sports Park · Live preview');
    await page.getByRole('button',{name:'Calendar & reservations',exact:true}).click();
    await page.getByRole('button',{name:'Week',exact:true}).click();
    await expect(page.getByLabel('Week at a glance')).toBeVisible();
    await page.getByLabel('Include cancelled, declined & expired',{exact:true}).check();
    await page.screenshot({path:path.join(output,`${width}-week.png`),fullPage:true});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    await page.getByRole('button',{name:'Day',exact:true}).click();
    await page.getByRole('button',{name:'Add booking or closure',exact:true}).click();
    const booking=page.getByRole('form',{name:'Booking or closure editor'});
    await booking.getByRole('button',{name:/Close a pitch/}).click();
    await booking.getByRole('button',{name:'Continue',exact:true}).click();
    const date=new Date(Date.now()+28*86400000).toISOString().slice(0,10);
    await booking.getByLabel('Start date',{exact:true}).fill(date);
    await booking.getByLabel('Start time',{exact:true}).fill('04:00');
    await booking.getByLabel('End time',{exact:true}).fill('05:00');
    await booking.getByLabel(/^Repeat weekly/).selectOption('4');
    await booking.getByLabel('Reason for closure',{exact:true}).fill('Demo preview: planned pitch maintenance');
    await expect(page.getByLabel('Booking preview')).toContainText('No rental charge');
    await expect(page.getByLabel('Booking preview')).toContainText('4 dates, weekly');
    await booking.getByRole('button',{name:'Review booking',exact:true}).click();
    await expect(booking.getByRole('button',{name:'Block these times',exact:true})).toBeEnabled();
    await expect(booking).toContainText('No overlapping bookings found');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    await page.screenshot({path:path.join(output,`${width}-closure-review.png`),fullPage:true});
    await booking.getByRole('button',{name:'Back',exact:true}).click();
    await expect(booking.getByLabel('Reason for closure',{exact:true})).toHaveValue('Demo preview: planned pitch maintenance');
    await booking.getByRole('button',{name:'Discard entry',exact:true}).click();
    await expect(page.getByRole('button',{name:'Add booking or closure',exact:true})).toBeVisible();
    await page.locator('.venue-breadcrumb').getByRole('link',{name:'My venues',exact:true}).click();
    await expect(page.getByRole('heading',{name:'My venues',exact:true})).toBeVisible();
    await expect(page.getByText('Loading venue details…')).toHaveCount(0);
    await expect(page.getByRole('link',{name:'Manage venue',exact:true})).toHaveCount(3);
    for(const card of await page.locator('.venue-owner-card-image').all()) {
      const image=card.locator('img');
      if(await image.count()) { const outer=await card.boundingBox(),inner=await image.boundingBox(); expect(inner.y+inner.height).toBeLessThanOrEqual(outer.y+outer.height+1); }
    }
    await page.screenshot({path:path.join(output,`${width}-portfolio.png`),fullPage:true});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    await page.getByRole('link',{name:'Requests',exact:true}).first().click();
    await expect(page.getByRole('heading',{name:'Booking requests',exact:true})).toBeVisible();
    expect(mutations).toBe(0);
    checks.push({width,height,theme,ownerOverview:true,fullRequestInbox:true,setupHandover:true,weekCalendar:true,venueCollection:true,livePreviews:true,draftRetainedAcrossTabs:true,recurringClosureReview:true,domainMutations:mutations,noOverflow:true});
    await page.close();
  }
  expect(errors).toEqual([]);
  const proof={status:'passed',phase,apiMocks:false,loginThroughUI:true,domainMutations:false,checks,errors};
  await writeFile(path.join(root,phase+'-browser-proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
} catch(error){if(activePage&&!activePage.isClosed()){await activePage.screenshot({path:path.join(output,'failure.png'),fullPage:true});await writeFile(path.join(output,'failure.html'),await activePage.content());}throw error;} finally {await browser.close();}

