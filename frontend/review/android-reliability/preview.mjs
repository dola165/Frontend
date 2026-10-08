import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'vite';
import {chromium,expect} from '@playwright/test';
const root='C:/Users/daddo/IdeaProjects/GrassKickZ',control=root+'/build/android-reliability-fixture',output=root+'/outputs/android-reliability';
const fixture=JSON.parse(await readFile(control+'/fixture.json','utf8'));await mkdir(output,{recursive:true});
const server=await createServer({root:process.cwd(),configFile:path.join(process.cwd(),'vite.config.ts'),define:{'import.meta.env.VITE_API_BASE_URL':JSON.stringify(fixture.backend+'/api'),'import.meta.env.VITE_ENABLE_MOCKS':'"false"'},server:{host:'127.0.0.1',port:5187,strictPort:true,hmr:false}});await server.listen();
const browser=await chromium.launch({channel:'chrome',headless:true});const results={synthetic:true,pageErrors:[]};
async function signal(name){const end=Date.now()+2*60*60*1000;while(Date.now()<end){try{await readFile(control+'/'+name);return;}catch{}await new Promise(r=>setTimeout(r,500));}throw Error('Signal timeout: '+name);}
async function login(email){const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'dark'});const page=await context.newPage();page.on('pageerror',e=>results.pageErrors.push(e.message));await page.goto('http://127.0.0.1:5187/login');await page.locator('#auth-login-email').fill(email);await page.locator('#auth-login-password').fill(fixture.password);const loginResponse=page.waitForResponse(r=>r.url().endsWith('/api/auth/login')&&r.request().method()==='POST');await page.locator('button[type="submit"]').click();const token=(await(await loginResponse).json()).accessToken;await expect(page.getByLabel('Create a post',{exact:true})).toBeVisible({timeout:60000});return {context,page,token};}
try {
 const owner=await login(fixture.ownerEmail);
 await owner.page.goto('http://127.0.0.1:5187/posts/'+fixture.privatePostId);await expect(owner.page.getByText('Private training notes for this account.',{exact:true}).first()).toBeVisible();
 const media=await owner.context.request.get(fixture.backend+fixture.mediaUrl,{headers:{Authorization:'Bearer '+owner.token}});expect(media.status()).toBe(200);expect(media.headers()['cache-control']).toContain('no-store');results.ownerMedia=200;
 await owner.page.screenshot({path:output+'/web-private-post.png',fullPage:true});await writeFile(control+'/web-ready','ready');console.log('Actual web private post and protected image verified.');
 await signal('web-comment-check');
 await owner.page.reload();await owner.page.getByRole('button',{name:'Comment',exact:true}).click();await expect(owner.page.getByText('Reliability comment saved once',{exact:true})).toHaveCount(1);await owner.page.screenshot({path:output+'/web-comment-confirmed.png',fullPage:true});results.nativeCommentCount=1;await writeFile(control+'/web-comment-confirmed','done');console.log('Web confirms exactly one comment after dropped native acknowledgement.');
 await signal('profile-private');
 const fan=await login(fixture.fanEmail);
 results.denied={};
 for(const [name,url] of Object.entries({post:'/api/posts/'+fixture.privatePostId,image:fixture.mediaUrl,event:'/api/schedule/events/'+fixture.eventId,ownerNotification:'/api/notifications/'+fixture.ids[0]})){
   const response=await fan.context.request.get(fixture.backend+url,{headers:{Authorization:'Bearer '+fan.token}});expect([403,404]).toContain(response.status());results.denied[name]=response.status();
 }
 await fan.page.goto('http://127.0.0.1:5187/profile/'+fixture.ownerId);await expect(fan.page.getByText('Private training notes for this account.',{exact:true})).toHaveCount(0);await fan.page.screenshot({path:output+'/web-private-identity.png',fullPage:true});
 results.passed=true;await writeFile(output+'/web-verification.json',JSON.stringify(results,null,2));await writeFile(control+'/web-privacy-confirmed','done');console.log('Web confirms fan cannot read owner post, image, event or notification.');await signal('stop-web');
} catch(error){results.error=String(error);await writeFile(output+'/web-verification.json',JSON.stringify(results,null,2));throw error;}finally{await browser.close();await server.close();}
