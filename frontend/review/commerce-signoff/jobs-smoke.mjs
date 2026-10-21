import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url'; import path from 'node:path';
import {createServer} from 'vite'; import {chromium,expect} from '@playwright/test';
const fixture=JSON.parse(await readFile(process.argv[2],'utf8'));
const root=path.resolve(process.env.GK_STORE_FRONTEND), output=path.resolve(path.dirname(process.argv[2]),'jobs-browser');
await mkdir(output,{recursive:true});
const server=await createServer({root,configFile:path.join(root,'vite.config.ts'),define:{'import.meta.env.VITE_API_BASE_URL':JSON.stringify(fixture.backend+'/api'),'import.meta.env.VITE_ENABLE_MOCKS':'"false"'},server:{host:'127.0.0.1',port:5179,strictPort:true,hmr:false}});
await server.listen(); const browser=await chromium.launch({channel:'chrome',headless:true}); const results={};
try {
 const owner=await browser.newContext({viewport:{width:1440,height:960}}), viewer=await browser.newContext({viewport:{width:1440,height:960}}),guest=await browser.newContext();
 for(const [context,user] of [[owner,fixture.owner],[viewer,fixture.viewer]]) {
  context.setDefaultTimeout(12000);await context.addInitScript(user=>{localStorage.setItem('accessToken',user.token);localStorage.setItem('userId',String(user.id));localStorage.setItem('i18nextLng','en');},user);
 }
 const headers={Authorization:'Bearer '+fixture.owner.token}, playerHeaders={Authorization:'Bearer '+fixture.viewer.token};
 const url='http://127.0.0.1:5179/e2e/fixtures/jobs.html?club='+fixture.club+'&owner='+fixture.owner.id;
 // Full JSON create/update routes, real authorization and actual database records.
 const jobs=[];
 for(const [title,role,category] of [['Academy player opportunity','PLAYER','OTHER'],['Volunteer matchday host',null,'MATCHDAY'],['Youth coach opportunity','COACH','COACHING']]) {
  const response=await owner.request.post(`${fixture.backend}/api/clubs/${fixture.club}/jobs`,{headers,data:{title,description:'Help our community club grow. Contact the team to learn about the next intake.',requiredRole:role,category,engagementType:role?'PAID':'VOLUNTEER'}});
  expect(response.status(),await response.text()).toBe(201);jobs.push(await response.json());
 }
 const job=jobs[0];let response=await guest.request.get(`${fixture.backend}/api/jobs/${job.id}`);expect(response.status()).toBe(200);expect(response.headers()['cache-control']).toContain('no-store');
 const publicJob=await response.json();expect(publicJob.createdBy??null).toBeNull();expect(publicJob.applicationCount??null).toBeNull();
 response=await guest.request.get(`${fixture.backend}/api/jobs/${job.id}/application`);expect([401,403]).toContain(response.status());
 response=await viewer.request.get(`${fixture.backend}/api/clubs/${fixture.club}/jobs/all`,{headers:playerHeaders});expect(response.status()).toBe(403);
 results.access={guestDetails:true,privateApplicationGuard:true,staffDirectoryGuard:true,publicProjection:true,noStore:true};
 const page=await viewer.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.evaluate(()=>document.documentElement.classList.add('dark'));
 await expect(page.getByRole('button',{name:'Preview Academy player opportunity'})).toBeVisible();
 await page.getByRole('button',{name:'Preview Academy player opportunity'}).click();
 await expect(page.getByRole('complementary',{name:'Selected opportunity'})).toContainText('Academy player opportunity');
 await page.screenshot({animations:'disabled',path:path.join(output,'jobs-desktop-dark.png'),fullPage:true});
 expect(await page.locator('.store-eyebrow').first().evaluate(el=>getComputedStyle(el).color)).toBe('rgb(232, 121, 249)');
 await page.evaluate(async()=>{document.documentElement.classList.remove('dark');await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});await page.screenshot({animations:'disabled',path:path.join(output,'jobs-desktop-light.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});await expect(page.locator('#job-filters')).toBeHidden();
 await page.getByRole('button',{name:'Filters',exact:true}).focus();await page.keyboard.press('Enter');await expect(page.locator('#job-filters')).toBeVisible();
 await page.getByRole('button',{name:'Show opportunities'}).click();await expect(page.getByRole('button',{name:'Filters',exact:true})).toBeFocused();
 await page.screenshot({animations:'disabled',path:path.join(output,'jobs-narrow.png'),fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('.job-row').filter({has:page.getByRole('heading',{name:'Academy player opportunity',exact:true})}).getByRole('link',{name:'View opportunity'}).click();
 await expect(page.getByRole('heading',{name:'Academy player opportunity',exact:true})).toBeVisible();
 const message=page.getByLabel('Message to the club');await message.fill('I play goalkeeper and would like to join this intake.');
 let submitted;
 await page.route(`**/api/clubs/${fixture.club}/applications`,async route=>{submitted=route.request().postDataJSON();await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Please retry shortly.'})});},{times:1});
 await page.getByRole('button',{name:'Send application'}).click();await expect(page.getByRole('status')).toContainText('Please retry shortly.');await expect(message).toHaveValue('I play goalkeeper and would like to join this intake.');expect(submitted.role).toBe('PLAYER');expect(submitted.jobId).toBe(job.id);
 await page.getByRole('button',{name:'Send application'}).click();await expect(page.getByRole('heading',{name:'Application pending'})).toBeVisible();
 await page.screenshot({animations:'disabled',path:path.join(output,'application-narrow.png'),fullPage:true});
 await page.goto(url+'&path='+encodeURIComponent('/jobs/'+job.id));await expect(page.getByRole('heading',{name:'Application pending'})).toBeVisible();
 response=await owner.request.get(`${fixture.backend}/api/jobs/${job.id}/application`,{headers});expect((await response.text()).trim()).toMatch(/^(null)?$/);
 await page.getByRole('button',{name:'Withdraw application'}).click();await page.getByRole('button',{name:'Confirm withdrawal'}).click();await expect(page.getByRole('status')).toContainText('Application withdrawn.');
 response=await viewer.request.get(`${fixture.backend}/api/jobs/${job.id}/application`,{headers:playerHeaders});expect((await response.json()).status).toBe('CANCELLED');
 await page.goto(url+'&path='+encodeURIComponent('/jobs/'+jobs[1].id));await expect(page.getByRole('link',{name:'Open club contact details'})).toHaveAttribute('href',`/clubs/${fixture.club}?tab=contact`);
 results.applications={actualPlayerRole:true,failureDraftRetained:true,pendingAfterReload:true,ownStatusIsolated:true,withdrawConfirmed:true,otherRolesContact:true};
 const guestPage=await guest.newPage();await guestPage.goto(url+'&path='+encodeURIComponent('/jobs/'+job.id));await expect(guestPage.getByRole('link',{name:'Sign in to apply'})).toHaveAttribute('href','/login?next='+encodeURIComponent('/jobs/'+job.id));
 // Workspace failures remain visible; editing fields can be cleared and close updates public details.
 const manager=await owner.newPage();await manager.goto(url+'&path=/workspace');
 await expect(manager.getByRole('button',{name:'Edit Academy player opportunity'})).toBeVisible();
 await manager.getByRole('button',{name:'Edit Academy player opportunity'}).click();
 await manager.getByLabel('Job description').fill('');await manager.getByLabel('Application route').selectOption('');
 await manager.locator('form button[type=submit]').click();await expect(manager.getByLabel('Job description')).toHaveCount(0);
 response=await guest.request.get(`${fixture.backend}/api/jobs/${job.id}`);const edited=await response.json();expect(edited.requiredRole??null).toBeNull();expect(edited.description??'').toBe('');
 await manager.getByRole('button',{name:'Delete Academy player opportunity'}).click();await manager.getByRole('button',{name:'Confirm delete'}).click();await expect(manager.getByRole('alert')).toContainText('close it instead');
 await manager.getByRole('button',{name:'Keep posting'}).click();
 response=await owner.request.patch(`${fixture.backend}/api/clubs/${fixture.club}/jobs/${job.id}`,{headers,data:{status:'CLOSED',version:edited.version}});expect(response.status()).toBe(200);
 response=await guest.request.get(`${fixture.backend}/api/jobs/${job.id}`);expect(response.status()).toBe(404);
 results.workspace={editingClearsFields:true,deleteConflictVisible:true,closedDetailsUnavailable:true};
 results.layout={purpleDarkAndLight:true,exactLinkAtNarrowWidth:true,filtersKeyboardAndFocus:true,noHorizontalOverflow:true};
 expect(errors).toEqual([]);console.log('PASS',JSON.stringify(results));
} finally {await writeFile(path.join(output,'results.json'),JSON.stringify(results,null,2));await browser.close();await server.close();}
