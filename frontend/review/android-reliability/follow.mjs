import {readFile,writeFile} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
const root='C:/Users/daddo/IdeaProjects/GrassKickZ',fixture=JSON.parse(await readFile(root+'/build/android-reliability-fixture/fixture.json','utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.goto('http://127.0.0.1:5187/login');await page.locator('#auth-login-email').fill(fixture.fanEmail);await page.locator('#auth-login-password').fill(fixture.password);await page.locator('button[type="submit"]').click();await expect(page.getByLabel('Create a post',{exact:true})).toBeVisible({timeout:60000});
 const response=page.waitForResponse(r=>r.url().endsWith('/api/clubs/'+fixture.clubId)&&r.request().method()==='GET');await page.goto('http://127.0.0.1:5187/clubs/'+fixture.clubId);const club=await(await response).json();
 expect(club.isFollowedByMe).toBe(true);expect(club.followerCount).toBe(1);await expect(page.locator('button').filter({hasText:/^Following$/})).toBeVisible();
 await page.screenshot({path:root+'/outputs/android-reliability/web-follow-confirmed.png',fullPage:true});await writeFile(root+'/outputs/android-reliability/web-follow.json',JSON.stringify({passed:true,clubId:club.id,following:club.isFollowedByMe,followers:club.followerCount}));console.log('Actual web confirms native fan Follow without membership.');
}finally{await browser.close();}
