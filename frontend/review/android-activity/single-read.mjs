import {readFile,writeFile} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
const root='C:/Users/daddo/IdeaProjects/GrassKickZ';
const fixture=JSON.parse(await readFile(root+'/build/android-activity-fixture/fixture.json','utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'dark'});const page=await context.newPage();
 await page.goto('http://127.0.0.1:5187/login');await page.locator('#auth-login-email').fill(fixture.ownerEmail);await page.locator('#auth-login-password').fill(fixture.password);await page.locator('button[type="submit"]').click();await expect(page.getByLabel('Create a post',{exact:true})).toBeVisible({timeout:60000});
 const list=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/notifications'&&r.ok());const count=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/notifications/unread-count'&&!new URL(r.url()).search&&r.ok());
 await page.goto('http://127.0.0.1:5187/notifications');const p=await(await list).json();const c=await(await count).json();
 await writeFile(root+'/outputs/android-activity/read-contract-observed.json',JSON.stringify({unread:c.unreadCount,items:p.content.map(n=>({id:n.id,keys:Object.keys(n),isRead:n.isRead,read:n.read}))},null,2));
 expect(c.unreadCount).toBe(24);expect(p.content.find(n=>n.id===fixture.ids[0]).isRead).toBe(true);expect(p.content.filter(n=>n.id!==fixture.ids[0]).every(n=>!n.isRead)).toBe(true);
 await expect(page.getByText('Club training update',{exact:true}).first()).toBeVisible();await page.screenshot({path:root+'/outputs/android-activity/web-single-read.png',fullPage:true});
 await writeFile(root+'/outputs/android-activity/web-single-read.json',JSON.stringify({passed:true,unread:24,readId:fixture.ids[0],otherVisibleItemsRemainUnread:true},null,2));console.log('Web confirms exactly one native read, 24 unread.');
} finally {await browser.close();}
