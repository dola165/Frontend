import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'vite';
import {chromium,expect} from '@playwright/test';
const backendRoot='C:/Users/daddo/IdeaProjects/GrassKickZ';
const control=path.join(backendRoot,'build/android-activity-fixture');
const fixture=JSON.parse(await readFile(path.join(control,'fixture.json'),'utf8'));
const output=path.join(backendRoot,'outputs/android-activity');await mkdir(output,{recursive:true});
const root=process.cwd();
const server=await createServer({root,configFile:path.join(root,'vite.config.ts'),define:{'import.meta.env.VITE_API_BASE_URL':JSON.stringify(fixture.backend+'/api'),'import.meta.env.VITE_ENABLE_MOCKS':'"false"'},server:{host:'127.0.0.1',port:5187,strictPort:true,hmr:false}});await server.listen();
const browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'dark'});
const page=await context.newPage();page.setDefaultTimeout(30000);const results={synthetic:true,consoleErrors:[]};page.on('pageerror',e=>results.consoleErrors.push(e.message));
async function signal(name){const deadline=Date.now()+2*60*60*1000;while(Date.now()<deadline){try{await readFile(path.join(control,name));return;}catch{}await new Promise(r=>setTimeout(r,1000));}throw Error('Signal timeout');}
try {
 await page.goto('http://127.0.0.1:5187/login');await page.locator('#auth-login-email').fill(fixture.ownerEmail);await page.locator('#auth-login-password').fill(fixture.password);await page.locator('button[type="submit"]').click();await expect(page.getByLabel('Create a post',{exact:true})).toBeVisible({timeout:60000});
 await page.goto('http://127.0.0.1:5187/notifications');await expect(page.getByText('Club training update',{exact:true}).first()).toBeVisible();await page.screenshot({path:path.join(output,'web-activity-before.png'),fullPage:true});
 await writeFile(path.join(control,'web-ready'),'ready');console.log('Web Activity ready for native read-state verification.');await signal('web-check');
 const count=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/notifications/unread-count'&&!new URL(r.url()).search&&r.ok());
 const list=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/notifications'&&r.request().method()==='GET'&&r.ok());await page.reload();
 const c=await(await count).json();const p=await(await list).json();expect(c.unreadCount).toBe(0);expect(p.content.every(n=>n.isRead)).toBe(true);expect(p.content.find(n=>n.id===fixture.ids[0]).isRead).toBe(true);
 results.unreadCount=c.unreadCount;results.listReadState=p.content.map(n=>({id:n.id,isRead:n.isRead}));results.passed=true;
 await expect(page.getByText('Club training update',{exact:true}).first()).toBeVisible();await page.screenshot({path:path.join(output,'web-native-read-confirmed.png'),fullPage:true});await writeFile(path.join(output,'web-verification.json'),JSON.stringify(results,null,2));console.log('Web confirms native single and bulk read state.');await signal('stop-web');
}catch(e){results.error=String(e);await writeFile(path.join(output,'web-verification.json'),JSON.stringify(results,null,2));await page.screenshot({path:path.join(output,'web-error.png'),fullPage:true});throw e;}finally{await context.close();await browser.close();await server.close();}
