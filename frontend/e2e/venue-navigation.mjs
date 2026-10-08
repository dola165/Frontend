// Candidate mode serves production assets in an isolated browser; all API data is live.
import { chromium, expect } from '@playwright/test';
import { readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
const root='C:/Users/daddo/IdeaProjects/GrassKickZ/outputs/venue-navigation-20260921';
const candidate=process.env.VENUE_BUILD_DIRECTORY;
const phase=candidate?'candidate':'live';
const output=path.join(root,phase);await mkdir(output,{recursive:true});
const credentials=JSON.parse(await readFile(path.join(homedir(),'Documents/GrassKickZ-demo/venue-owner-demo-login.json'),'utf8'));
const origin='https://app.grasskickz.com';
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[],checks=[];
async function newPage(){
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
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
try{
  const page=await newPage();
  await page.goto(origin+'/login?next=%2Fhome');
  await page.locator('#auth-login-email').fill(credentials.email);
  await page.locator('#auth-login-password').fill(credentials.password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.locator('.home-side-rail--left').getByRole('link',{name:'My venues',exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'My Club',exact:true})).toHaveCount(0);
  await expect(page.getByRole('link',{name:/My squads/})).toHaveCount(0);
  await page.screenshot({path:path.join(output,'home.png')});
  await page.getByRole('navigation').filter({has:page.getByRole('button',{name:'Shortcuts',exact:true})}).getByRole('link',{name:'My venues',exact:true}).click();
  await expect(page.getByRole('heading',{name:'My venues',exact:true})).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(3);
  await page.screenshot({path:path.join(output,'my-venues.png'),fullPage:true});
  for(const id of [133,134,135]){
    const manage=page.locator(`article a[href="/stadiums/${id}/manage"]`);
    await expect(manage).toBeVisible();await manage.click();
    await expect(page.getByRole('button',{name:'Calendar & reservations',exact:true})).toBeVisible();
    await page.locator('main').getByRole('link',{name:'My venues',exact:true}).click();
  }
  checks.push('owner: top navigation, Home entry, three workspaces, back-to-venues; no My Club or My squads');
  await page.setViewportSize({width:390,height:844});
  await page.reload();await expect(page.getByRole('article')).toHaveCount(3);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  await page.screenshot({path:path.join(output,'mobile.png'),fullPage:true});
  checks.push('mobile venue collection has no horizontal overflow');
  const guest=await newPage();
  for(const id of [133,134,135]){
    await guest.goto(origin+`/stadiums/${id}`);
    await expect(guest.locator('.venue-profile h1')).toContainText('Demo');
    await expect(guest.getByRole('link',{name:'Manage stadium',exact:true})).toHaveCount(0);
    await expect(guest).toHaveURL(new RegExp(`/stadiums/${id}$`));
    if(id===133)await guest.screenshot({path:path.join(output,'public-dighomi.png'),fullPage:true});
  }
  checks.push('all three published stadiums visible signed out, without owner controls');
  await guest.goto(origin+'/stadiums?q=Dighomi');
  await expect(guest.locator('a[href="/stadiums/133"]').first()).toBeVisible();
  checks.push('Dighomi discoverable in public stadium directory');
  expect(errors).toEqual([]);
  const proof={status:'passed',phase,apiMocks:false,loginThroughUI:true,domainMutations:false,checks,errors};
  await writeFile(path.join(root,phase+'-browser-proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}finally{await browser.close();}
