import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'vite';
import {chromium,expect} from '@playwright/test';
const backendRoot='C:/Users/daddo/IdeaProjects/GrassKickZ';
const control=path.join(backendRoot,'build/android-football-fixture');
const fixture=JSON.parse(await readFile(path.join(control,'fixture.json'),'utf8'));
const output=path.join(backendRoot,'outputs/android-football'); await mkdir(output,{recursive:true});
const root=process.cwd();
const server=await createServer({root,configFile:path.join(root,'vite.config.ts'),
  define:{'import.meta.env.VITE_API_BASE_URL':JSON.stringify(fixture.backend+'/api'),'import.meta.env.VITE_ENABLE_MOCKS':'"false"'},
  server:{host:'127.0.0.1',port:5187,strictPort:true,hmr:false}});
await server.listen();
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'dark',timezoneId:'Asia/Tbilisi'});
await context.addInitScript(()=>localStorage.setItem('tutorial.calendar.completed','true'));
const page=await context.newPage(); page.setDefaultTimeout(30000);
const results={synthetic:true,consoleErrors:[],scheduleResponses:[]};
page.on('pageerror',e=>results.consoleErrors.push(e.message));
page.on('response',async r=>{if(r.url().includes('/api/schedule/')&&r.request().method()==='GET'&&r.ok()) {
  const data=await r.json();results.scheduleResponses.push({path:new URL(r.url()).pathname,data});
}});
try {
  await page.goto('http://127.0.0.1:5187/login');
  await page.locator('#auth-login-email').fill(fixture.ownerEmail); await page.locator('#auth-login-password').fill(fixture.password);
  await page.locator('button[type="submit"]').click(); await expect(page.getByLabel('Create a post',{exact:true})).toBeVisible({timeout:60000});
  await page.goto('http://127.0.0.1:5187/calendar?scope=personal');
  await expect(page.getByText('Recovery appointment',{exact:true}).first()).toBeVisible();
  await expect(page.getByRole('button',{name:'My',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.screenshot({path:path.join(output,'web-personal-agenda.png'),fullPage:true});
  results.ownerPersonal=true;
  await page.getByRole('button',{name:'Club',exact:true}).click();
  await expect(page.getByText('Evening team training',{exact:true}).first()).toBeVisible();
  await page.screenshot({path:path.join(output,'web-club-schedule.png'),fullPage:true});
  results.clubSchedule=true;
  const personal=results.scheduleResponses.filter(r=>r.path==='/api/schedule/me/events').flatMap(r=>r.data.events);
  expect(personal.some(e=>e.eventId===fixture.personalId&&e.startsAt.startsWith(fixture.date+'T09:00'))).toBe(true);
  expect(personal.every(e=>e.clubId==null)).toBe(true);
  const club=results.scheduleResponses.filter(r=>r.path===`/api/schedule/clubs/${fixture.clubId}/events`).flatMap(r=>r.data.events);
  expect(club.some(e=>e.eventId===fixture.recurringId&&e.startsAt.startsWith(fixture.date+'T18:00'))).toBe(true);
  expect(club.some(e=>e.eventId===fixture.cancelledId&&e.status==='CANCELLED')).toBe(true);
  results.passed=true; await writeFile(path.join(output,'web-verification.json'),JSON.stringify(results,null,2));
  await writeFile(path.join(control,'web-ready'),'ready'); console.log('Actual web personal and club schedules verified.');
  const deadline=Date.now()+2*60*60*1000;
  while(Date.now()<deadline) { try {await readFile(path.join(control,'stop-web'));break;}catch{} await new Promise(r=>setTimeout(r,1000)); }
} catch(e) {
  results.error=String(e);await writeFile(path.join(output,'web-verification.json'),JSON.stringify(results,null,2));
  await page.screenshot({path:path.join(output,'web-error.png'),fullPage:true});throw e;
} finally {await context.close();await browser.close();await server.close();}
