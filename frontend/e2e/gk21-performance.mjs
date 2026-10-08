// Production-asset comparison with deterministic local API fixtures, never a live backend.
import {preview} from 'vite';
import {chromium} from '@playwright/test';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {gzipSync} from 'node:zlib';

const [outDir, reportPath, mode = 'measure'] = process.argv.slice(2);
if (!outDir || !reportPath) throw new Error('Usage: node e2e/gk21-performance.mjs <dist> <report.json> [measure|verify]');
const server = await preview({build: {outDir: path.resolve(outDir)}, preview: {host:'127.0.0.1', port:0, strictPort:false}});
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({headless:true});
const longName = 'GrassKickZ community football club '.repeat(5);
const club = {id:701,name:longName,description:'A synthetic club for layout checks.',type:'ACADEMY',status:'VERIFIED',joinPolicy:'OPEN',isOfficial:true,followerCount:12,memberCount:18,city:'Tbilisi',country:'Georgia'};
const product = {id:801,clubId:701,clubName:longName,name:'TrainingKit'.repeat(30),description:'Synthetic kit',price:1234.5,currency:'GEL',images:[],variants:[{id:1,size:'M',stock:3}],active:true};
const report = {mode,conditions:{api:'local deterministic fixtures; external services blocked',cpuSlowdown:4,cache:'new context per sample',network:'local server, no transport throttling; gzip is calculated from requested assets, not measured CDN transfer'},samples:[],checks:[]};

async function setup(viewport={width:1365,height:900}) {
  const context = await browser.newContext({viewport,locale:'de-DE',reducedMotion:'reduce'});
  await context.addInitScript(() => {
    localStorage.setItem('i18nextLng','en');
    window.__lcp = 0;
    new PerformanceObserver(list => {window.__lcp=list.getEntries().at(-1).startTime;}).observe({type:'largest-contentful-paint',buffered:true});
  });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (!url.pathname.startsWith('/api/')) return route.continue();
    let body=[]; let status=200;
    if(url.pathname==='/api/auth/csrf') body={token:'fixture',headerName:'X-XSRF-TOKEN'};
    else if(url.pathname.startsWith('/api/auth/')) {status=401;body={error:'Guest fixture'};}
    else if(url.pathname==='/api/clubs') body={content:[club],totalElements:1,totalPages:1,number:0,size:12};
    else if(url.pathname==='/api/store/products') body={content:[product],totalElements:1};
    else if(url.pathname==='/api/store/products/801') body=product;
    else if(url.pathname==='/api/campaigns') body={content:[],totalElements:0};
    else if(url.pathname==='/api/clubs/701') body=club;
    return route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  });
  return context;
}

try {
  for (const route of ['/','/clubs','/login']) {
    for(let sample=0;sample<3;sample++) {
      const context=await setup(); const page=await context.newPage();
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      const cdp=await context.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
      await cdp.send('Performance.enable');
      await page.goto(origin+route,{waitUntil:'networkidle'});
      await page.locator('h1').first().waitFor();
      const metrics=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
      const resources=await page.evaluate(()=>({lcp:window.__lcp,js:performance.getEntriesByType('resource').filter(r=>new URL(r.name).pathname.endsWith('.js')).map(r=>new URL(r.name).pathname)}));
      let jsBytes=0,gzipBytes=0;
      for(const resource of new Set(resources.js)) {
        const bytes=await readFile(path.join(outDir,resource.replace(/^\//,'')));
        jsBytes+=bytes.length;gzipBytes+=gzipSync(bytes).length;
      }
      report.samples.push({route,sample,jsBytes,gzipBytes,scriptMs:Math.round(metrics.ScriptDuration*1000),taskMs:Math.round(metrics.TaskDuration*1000),lcpMs:Math.round(resources.lcp),js:resources.js,errors});
      if(errors.length) throw new Error(JSON.stringify(errors));
      await context.close();
    }
  }
  for (const width of [390,1280]) {
    const context=await setup({width,height:844});const page=await context.newPage();
    for(const route of ['/clubs','/store','/campaigns','/jobs']) {
      await page.goto(origin+route,{waitUntil:'networkidle'});
      const result=await page.evaluate(()=>({title:document.title,lang:document.documentElement.lang,overflow:document.documentElement.scrollWidth>innerWidth+1}));
      const toggle=page.locator('.store-filter-toggle');
      let escapeCloses=null;
      if(width===390 && await toggle.count() && await toggle.first().isVisible()) {
        await toggle.first().click();await page.keyboard.press('Tab');await page.keyboard.press('Escape');
        escapeCloses=await toggle.first().getAttribute('aria-expanded')==='false';
      }
      report.checks.push({route,width,...result,escapeCloses});
      if(mode==='verify' && (result.overflow || escapeCloses===false)) throw new Error(`Layout/keyboard failure ${route} at ${width}px`);
      if(mode==='verify' && result.title==='GrassKickZ — Connecting the Game') throw new Error(`Missing page identity: ${route}`);
    }
    await context.close();
  }
  if(mode==='verify') {
    const manifest=JSON.parse(await readFile(path.join(outDir,'.vite/manifest.json'),'utf8'));
    const context=await setup();const page=await context.newPage();const loaded=[];
    page.on('request',request=>loaded.push(request.url()));
    await page.goto(origin+'/admin',{waitUntil:'networkidle'});
    if(!page.url().includes('/login?next=')) throw new Error('Guest admin redirect lost');
    if(loaded.some(url=>url.endsWith(manifest['src/pages/AdminPage.tsx'].file))) throw new Error('Denied admin chunk downloaded');
    report.checks.push({check:'Guest route guard preserves destination and does not download admin code',passed:true});

    await page.goto(origin+'/store',{waitUntil:'networkidle'});
    const englishPrice=await page.locator('.store-card-info p').first().textContent();
    if(!englishPrice.includes('1,234.50')) throw new Error('English app inherited German browser currency format');
    const englishTitle=await page.title();
    await page.getByRole('button',{name:'Use Georgian'}).click();
    await page.waitForFunction(()=>document.documentElement.lang==='ka');
    if(await page.title()===englishTitle) throw new Error('Document title did not follow language');
    const georgianPrice=await page.locator('.store-card-info p').first().textContent();
    if(englishPrice===georgianPrice) throw new Error('Money did not follow language');
    report.checks.push({check:'English formatting overrides German browser locale; Georgian selection updates language/title/currency without reload',passed:true});
    await page.getByRole('button',{name:'ინგლისურის გამოყენება'}).click();
    await page.waitForFunction(()=>document.documentElement.lang==='en');

    const broken=origin+'/'+manifest['src/pages/StoreProductPage.tsx'].file;
    await page.route(broken,route=>route.abort());
    await page.goto(origin+'/store/products/801',{waitUntil:'networkidle'});
    await page.getByRole('heading',{name:'Something went wrong'}).waitFor();
    if(!await page.getByRole('navigation').count()) throw new Error('Chunk failure removed navigation');
    await page.unroute(broken);
    await page.getByRole('button',{name:'Refresh Page'}).click();
    await page.getByRole('heading',{name:product.name,exact:true}).waitFor();
    report.checks.push({check:'Failed page chunk has a recovery action; refresh loads the same destination',passed:true});
    await context.close();
  }
} finally {
  await mkdir(path.dirname(reportPath),{recursive:true});
  await writeFile(reportPath,JSON.stringify(report,null,2));
  await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));
}
console.log(JSON.stringify({samples:report.samples.length,checks:report.checks},null,2));
