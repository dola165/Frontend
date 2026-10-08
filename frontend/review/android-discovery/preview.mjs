import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'vite';
import {chromium,expect} from '@playwright/test';

const backendRoot='C:/Users/daddo/IdeaProjects/GrassKickZ';
const control=path.join(backendRoot,'build/android-discovery-fixture');
const fixture=JSON.parse(await readFile(path.join(control,'fixture.json'),'utf8'));
const output=path.join(backendRoot,'outputs/android-discovery');
await mkdir(output,{recursive:true});
const root=process.cwd();
const server=await createServer({root,configFile:path.join(root,'vite.config.ts'),
  define:{'import.meta.env.VITE_API_BASE_URL':JSON.stringify(fixture.backend+'/api'),'import.meta.env.VITE_ENABLE_MOCKS':'"false"'},
  server:{host:'127.0.0.1',port:5187,strictPort:true,hmr:false}});
await server.listen();
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'dark'});
const page=await context.newPage(); page.setDefaultTimeout(30000);
const results={synthetic:true,consoleErrors:[]};
page.on('pageerror', e=>results.consoleErrors.push(e.message));
async function signal(name) {
  const deadline=Date.now()+2*60*60*1000;
  while(Date.now()<deadline) {
    try {await readFile(path.join(control,name));return;} catch {}
    await new Promise(r=>setTimeout(r,1000));
  }
  throw Error('Timed out waiting for '+name);
}
try {
  await page.goto('http://127.0.0.1:5187/login');
  await page.locator('#auth-login-email').fill(fixture.readerEmail);
  await page.locator('#auth-login-password').fill(fixture.password);
  await page.locator('button[type="submit"]').click();
  await expect(page.getByLabel('Create a post',{exact:true})).toBeVisible({timeout:60000});
  await page.goto('http://127.0.0.1:5187/clubs/'+fixture.clubId);
  if (!process.argv.includes('--read-back')) {
    await expect(page.getByRole('button',{name:'Follow',exact:true})).toBeVisible();
    await page.screenshot({path:path.join(output,'web-club-before-follow.png'),fullPage:true});
  }
  await writeFile(path.join(control,'web-ready'),'ready');
  console.log('Web ready for native Follow read-back.');
  await signal('web-check');
  const profileResponse=page.waitForResponse(r=>r.url().endsWith('/api/clubs/'+fixture.clubId)&&r.request().method()==='GET');
  await page.reload(); const profile=await (await profileResponse).json();
  await expect(page.locator('button').filter({hasText:/^Following$/})).toBeVisible();
  expect(profile.isFollowedByMe).toBe(true); expect(profile.followerCount).toBe(1);
  results.clubFollow={clubId:profile.id,following:profile.isFollowedByMe,followers:profile.followerCount};
  await page.screenshot({path:path.join(output,'web-club-follow-confirmed.png'),fullPage:true});
  const personResponse=page.waitForResponse(r=>r.url().endsWith('/api/users/'+fixture.authorId)&&r.request().method()==='GET');
  await page.goto('http://127.0.0.1:5187/profile/'+fixture.authorId);
  const person=await (await personResponse).json();
  expect(person.isFollowedByMe).toBe(true); expect(person.followerCount).toBe(1);
  await expect(page.locator('button').filter({hasText:/^Following$/})).toBeVisible();
  results.personFollow={userId:person.id,following:person.isFollowedByMe,followers:person.followerCount};
  await page.screenshot({path:path.join(output,'web-person-follow-confirmed.png'),fullPage:true});
  await page.goto('http://127.0.0.1:5187/profile/'+fixture.privateId);
  await expect(page.getByText('This profile is private.',{exact:true}).first()).toBeVisible();
  results.privateProfile=true;
  await page.screenshot({path:path.join(output,'web-private-profile.png'),fullPage:true});
  results.passed=true;
  await writeFile(path.join(output,'web-verification.json'),JSON.stringify(results,null,2));
  console.log('Web confirms native club/person Follow and private-profile visibility.');
  await signal('stop-web');
} catch(e) {
  results.error=String(e);await writeFile(path.join(output,'web-verification.json'),JSON.stringify(results,null,2));
  await page.screenshot({path:path.join(output,'web-error.png'),fullPage:true});throw e;
} finally {await context.close();await browser.close();await server.close();}
