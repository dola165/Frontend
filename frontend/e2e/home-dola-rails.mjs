import { preview } from 'vite';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const output = 'review/home-dola-rails'; await mkdir(output, { recursive: true });
const vite = await preview({ build: { outDir: process.env.DOLA_BUILD_DIRECTORY || 'dist/agent-dola-phase2' }, preview: { host: '127.0.0.1', port: 5197, strictPort: true } });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  for (const [width, height, theme] of [[1920,1000,'dark'],[1440,900,'light'],[1280,800,'dark'],[1100,800,'light'],[1920,650,'light'],[390,844,'dark']]) {
    const page = await browser.newPage({ viewport: { width, height } }); const errors = []; let paid = 0;
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(theme => {
      localStorage.setItem('gk-session-id','rail-test');
      localStorage.setItem('gk-session-token:rail-test',`e30.${btoa(JSON.stringify({sub:'999999',exp:4102444800}))}.synthetic`);
      localStorage.setItem('theme-preference',theme); localStorage.setItem('i18nextLng','en');
    },theme);
    await page.routeWebSocket('**',s=>s.close());
    await page.route('**/api/**',async route=>{
      const p = new URL(route.request().url()).pathname; let json=[];
      if(p.includes('/messages/stream')) paid++;
      if(p.endsWith('/users/me')) json={id:999999,username:'synthetic',fullName:'Demo Coach',role:'COACH',dob:'1990-01-01',emailVerified:true,profileComplete:true,onboardingRequired:false,navigationCapabilities:{version:1,workspaces:[]}};
      else if(p.endsWith('/auth/csrf')) json={headerName:'X-XSRF-TOKEN',token:'synthetic'};
      else if(p.endsWith('/assistant/dola/status')) json={name:'Agent Dola',available:true,mode:'REVIEWED_ACTIONS_PILOT',maxMessageLength:2000,capabilities:[]};
      else if(p.endsWith('/assistant/dola/conversations/latest')) return route.fulfill({status:204});
      else if(p.includes('membership-context')) json={hasClubMembership:false,canCreateClub:false};
      else if(p.includes('unread')) json={count:0,unreadCount:0};
      else if(p.includes('notifications')) json={content:[],totalElements:0,last:true,unreadCount:0};
      else if(p.includes('/feed')) json={content:Array.from({length:18},(_,i)=>({id:i+1,content:'Our academy is preparing for its next training session. Keep up with squad news, club updates and opportunities to take part.',createdAt:'2026-09-20T12:00:00',authorId:999998,authorName:'Synthetic Academy',clubId:21,clubName:'Synthetic Academy',likeCount:0,commentCount:0,isLikedByMe:false})),nextCursor:null};
      await route.fulfill({json});
    });
    await page.goto('http://127.0.0.1:5197/home');
    await expect(page.locator('.feed-home-grid')).toBeVisible();
    await expect(page.getByText('Our academy is preparing', { exact: false }).first()).toBeVisible();
    const rails = page.locator('.home-side-rail');
    const before = await rails.evaluateAll(es=>es.filter(e=>getComputedStyle(e).display!=='none').map(e=>e.getBoundingClientRect().top));
    await page.evaluate(()=>window.scrollTo(0,1000));
    await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(900);
    const after = await rails.evaluateAll(es=>es.filter(e=>getComputedStyle(e).display!=='none').map(e=>e.getBoundingClientRect().top));
    expect(after.length).toBe(before.length);
    const expected = width < 1280 ? 176 : 116;
    after.forEach(top=>expect(Math.abs(top-expected)).toBeLessThan(3));
    if(width<1280) await expect(page.locator('.home-opportunities--feed')).toBeInViewport();
    await page.screenshot({path:`${output}/${width}-${height}-scrolled.png`});
    await page.getByRole('link',{name:'Agent Dola',exact:true}).filter({visible:true}).first().click();
    const dock = page.getByRole('dialog',{name:'Agent Dola sidebar'}); await expect(dock).toBeVisible();
    if(width<1000) expect((await page.locator('.home-opportunities--panel').boundingBox()).height).toBeLessThan(65);
    if(width>=1440) await expect(page.locator('.home-side-rail--left')).toBeInViewport();
    if(width>=1280) {
      const right = page.locator('.home-side-rail--right'); await expect(right).toBeInViewport();
      expect((await right.boundingBox()).x+(await right.boundingBox()).width).toBeLessThanOrEqual((await dock.boundingBox()).x);
    } else await expect(page.locator(width<1000?'.home-opportunities--panel':'.home-opportunities--feed')).toBeInViewport();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    await page.screenshot({path:`${output}/${width}-${height}-docked.png`});
    if(width<1000) {
      await dock.getByRole('link',{name:'Roles',exact:true}).click();
      await expect(page).toHaveURL(/\/jobs$/); await expect(dock).toBeVisible();
    }
    expect(errors).toEqual([]); expect(paid).toBe(0);
    results.push({width,height,theme,sticky:true,dockPreservesOpportunities:true,noOverflow:true,noPaidCalls:true});
    await page.close();
  }
  await writeFile(`${output}/evidence.json`,JSON.stringify(results,null,2)); console.log(JSON.stringify(results));
} finally {await browser.close();await new Promise(resolve=>vite.httpServer.close(resolve));}


