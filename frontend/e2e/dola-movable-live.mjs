// Candidate mode serves production assets in an isolated browser; all API data is live.
import { chromium, expect } from '@playwright/test';
import { readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
const root=process.env.DOLA_UI_RELEASE_ROOT || 'C:/Users/daddo/IdeaProjects/GrassKickZ/outputs/dola-movable-navigation-20260921';
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
  for(const [width,height,theme] of [[1920,1000,'dark'],[1440,900,'light'],[390,844,'dark']]) {
    const page=await newPage();await page.setViewportSize({width,height});
    await page.addInitScript(theme=>localStorage.setItem('theme-preference',theme),theme);
    await page.goto(origin+'/login?next=%2Fhome');
    await page.locator('#auth-login-email').fill(credentials.email);await page.locator('#auth-login-password').fill(credentials.password);
    await page.locator('form button[type="submit"]').click();await expect(page.locator('.feed-home-grid')).toBeVisible();
    if(width>=1000) {
      const nav=page.getByRole('navigation',{name:'Home shortcuts'});
      await expect(nav.getByRole('link',{name:'My venues',exact:true})).toBeVisible();
      await expect(nav.getByRole('link',{name:/My squads/})).toHaveCount(0);
      await expect(nav.getByRole('link',{name:/Club workspace/})).toHaveCount(0);
      await page.screenshot({path:path.join(output,`${width}-navigation.png`)});
    }
    await page.getByRole('link',{name:'Agent Dola',exact:true}).filter({visible:true}).first().click();
    const dock=page.getByRole('dialog',{name:'Agent Dola sidebar'});await expect(dock).toBeVisible();
    const resumeIfNeeded=async()=>{await dock.locator('textarea:not(:disabled), .dola-resume-primary').first().waitFor();if(await dock.getByRole('button',{name:'Continue last chat'}).isVisible())await dock.getByRole('button',{name:'Continue last chat'}).click();};
    await resumeIfNeeded();
    await expect(dock.getByRole('combobox',{name:'Dola context'})).toHaveValue('venue');
    if(width>=1000) {
      const handle=dock.getByRole('separator',{name:'Resize Agent Dola'}), box=await handle.boundingBox();
      await page.mouse.move(box.x+6,300);await page.mouse.down();await page.mouse.move(width-650,300,{steps:15});await page.mouse.up();
      await expect.poll(async()=>(await dock.boundingBox()).width).toBe(650);
      await handle.focus();await page.keyboard.press('End');
      expect((await page.locator('.nav-actions').boundingBox()).x+(await page.locator('.nav-actions').boundingBox()).width).toBeLessThanOrEqual((await dock.boundingBox()).x);
      await page.screenshot({path:path.join(output,`${width}-maximum.png`)});
      await page.keyboard.press('Home');
      const narrow=await handle.boundingBox();await page.mouse.move(narrow.x+6,300);await page.mouse.down();await page.mouse.move(width-650,300,{steps:10});await page.mouse.up();
      await expect.poll(async()=>(await dock.boundingBox()).width).toBe(650);
      await dock.getByRole('textbox',{name:'Message Agent Dola'}).fill('An unsent draft');
      await page.screenshot({path:path.join(output,`${width}-resized.png`)});
      await dock.getByRole('button',{name:'Close chat'}).click();
      await page.getByRole('link',{name:'Agent Dola',exact:true}).filter({visible:true}).first().click();
      await resumeIfNeeded();await expect(dock.getByRole('textbox',{name:'Message Agent Dola'})).toHaveValue('An unsent draft');
      await page.reload();await page.getByRole('link',{name:'Agent Dola',exact:true}).filter({visible:true}).first().click();
      await expect.poll(async()=>(await dock.boundingBox()).width).toBe(650);
      await page.setViewportSize({width:1100,height});
      await expect.poll(async()=>(await dock.boundingBox()).width).toBe(620);
      await page.setViewportSize({width,height});await expect.poll(async()=>(await dock.boundingBox()).width).toBe(650);
    } else {await expect(dock.getByRole('separator')).toHaveCount(0);await page.screenshot({path:path.join(output,`${width}-mobile.png`)});}
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    checks.push({width,height,theme,roleNavigation:true,resizing:width>=1000,persistence:width>=1000,noOverflow:true});await page.close();
  }
  expect(errors).toEqual([]);
  await writeFile(path.join(root,`${phase}-browser-proof.json`),JSON.stringify({status:'passed',phase,apiMocks:false,errors,checks,domainMutations:false},null,2));
  console.log(JSON.stringify({status:'passed',phase,checks}));
} catch(error) {if(activePage&&!activePage.isClosed())await activePage.screenshot({path:path.join(output,'failure.png')});throw error;}
finally {await browser.close();}
