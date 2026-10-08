import { chromium, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const root='C:/Users/daddo/IdeaProjects/GrassKickZ/outputs/android-club-features-pass';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:900}});
try {
  await page.goto('http://127.0.0.1:5187/login');
  await page.locator('#auth-login-email').fill('preview.applicant@example.test');
  await page.locator('#auth-login-password').fill('FootballPreview2026!');
  await page.locator('button[type="submit"]').click();
  await expect(page).not.toHaveURL(/\/login/);
  await page.goto('http://127.0.0.1:5187/jobs/11');
  await expect(page.getByRole('heading',{name:'Application pending',exact:true})).toBeVisible();
  await page.screenshot({path:root+'/web-application-pending.png'});
  await writeFile(root+'/web-readback.json',JSON.stringify({passed:true,jobId:11,nativeApplicationRenderedOnWeb:true}));
  console.log('PASS: Android application appears Pending in the actual web job page.');
} finally {await browser.close();}
