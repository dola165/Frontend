import {readFile,writeFile} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
const root='C:/Users/daddo/IdeaProjects/GrassKickZ';
const f=JSON.parse(await readFile(root+'/build/android-messages-fixture/fixture.json','utf8'));
const room=JSON.parse(await readFile(root+'/outputs/android-messages/fixture.json','utf8')).conversationId;
const webText='Web says: meet at the club entrance. '+Date.now();
const nativeText='Android says: see you there. '+Date.now();
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:5187/login');
 await page.locator('#auth-login-email').fill(f.ownerEmail);
 await page.locator('#auth-login-password').fill(f.password);
 await page.locator('button[type="submit"]').click();
 await expect(page).not.toHaveURL(/\/login/);
 await page.goto(`http://127.0.0.1:5187/messages?conversationId=${room}`);
 await expect(page.getByPlaceholder('Type a message...')).toBeVisible();
 await page.getByPlaceholder('Type a message...').fill(webText);
 await page.getByRole('button',{name:'Send message',exact:true}).click();
 await expect(page.getByText(webText,{exact:true}).last()).toBeVisible();
 await page.screenshot({path:root+'/outputs/android-messages/web-sent.png'});
 await writeFile(root+'/outputs/android-messages/web-ready.json',JSON.stringify({passed:true,conversationId:room,webText,nativeText,actualWebSend:true,pageErrors:errors}));
 console.log('Real web conversation sent a message; waiting for native reply.');
 await expect(page.getByText(nativeText,{exact:true}).last()).toBeVisible({timeout:240000});
 await page.screenshot({path:root+'/outputs/android-messages/web-native-reply.png'});
 await writeFile(root+'/outputs/android-messages/web-verification.json',JSON.stringify({passed:true,webText,nativeText,actualWebSend:true,nativeReplyRendered:true,pageErrors:errors},null,2));
 console.log('Native reply rendered in actual web Messages.');
}catch(e){await page.screenshot({path:root+'/outputs/android-messages/web-error.png'});throw e;}finally{await browser.close();}
