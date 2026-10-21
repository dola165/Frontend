// Real workspace components and HTTP payloads, isolated from all live data.
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const out = 'review/opportunities-release-20260913';
await mkdir(out, {recursive:true});
const server = await createServer({root:process.cwd(),define:{'import.meta.env.VITE_API_BASE_URL':'"http://127.0.0.1:5295/api"','import.meta.env.VITE_ENABLE_MOCKS':'"false"'},server:{host:'127.0.0.1',port:5294,strictPort:true,hmr:false}});
await server.listen();
const browser = await chromium.launch({channel:'chrome',headless:true});
const report = {checks:[],errors:[],unexpected:[],writes:[]};
let products = [{id:1,clubId:10,name:'Community scarf',description:'A warm matchday scarf in club colours.',price:35,currency:'GEL',category:'ACCESSORIES',variants:[{id:11,label:'One size',stock:12}],active:true,version:4,images:[]}];
let campaigns = [{id:2,clubId:10,title:'Community boot library',summary:'Help every young player get on the pitch.',description:'Build a shared collection of boots for the academy.',beneficiary:'Academy players',useOfFunds:'Buy boots and storage',category:'COMMUNITY',currency:'GEL',goalAmount:5000,reportedAmount:1800,reportedNote:'Club records',startsOn:null,endsOn:'2026-12-01',images:[],status:'PUBLISHED',phase:'ACTIVE',version:3,publishedAt:'2026-09-01T12:00:00Z',updates:[]}];
let jobs = [{id:3,clubId:10,title:'U14 goalkeeper coach',description:'Lead two weekly sessions at the academy.',category:'COACHING',engagementType:'PAID',requiredRole:'COACH',ageGroup:'U14',level:'EXPERIENCED',status:'OPEN',version:5,createdBy:55001,applicationCount:2}];
try {
 const page = await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.route('http://127.0.0.1:5295/api/**',async route=>{
  const req=route.request(), p=new URL(req.url()).pathname,m=req.method();
  const body=['POST','PUT','PATCH'].includes(m)&&!p.endsWith('/upload')?req.postDataJSON():null;
  if(m!=='GET')report.writes.push({path:p,method:m,body});
  if(p==='/api/auth/csrf')return route.fulfill({json:{headerName:'X-XSRF-TOKEN',token:'isolated-fixture'}});
  if(p==='/api/media/upload')return route.fulfill({json:{url:'/api/media/test-product.png'}});
  if(p==='/api/media/test-product.png')return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7n8AAAAASUVORK5CYII=','base64')});
  if(p==='/api/clubs/10/store/products/all')return route.fulfill({json:products});
  if(p==='/api/clubs/10/campaigns'&&m==='GET')return route.fulfill({json:campaigns});
  if(p==='/api/clubs/10/jobs/all')return route.fulfill({json:jobs});
  if(p==='/api/clubs/10/store/products'&&m==='POST'){const product={...body,id:10,clubId:10,version:0};products.push(product);return route.fulfill({json:product});}
  if(p==='/api/clubs/10/store/products/1'&&m==='PATCH'){expect(body.version).toBe(4);products[0]={...products[0],...body,version:5};return route.fulfill({json:products[0]});}
  if(p==='/api/clubs/10/campaigns'&&m==='POST'){const campaign={...body,id:20,clubId:10,status:'DRAFT',phase:'DRAFT',version:0};campaigns.push(campaign);return route.fulfill({json:campaign});}
  if(p==='/api/clubs/10/campaigns/2/state'){expect(body.version).toBe(3);campaigns[0]={...campaigns[0],status:body.status,phase:body.status,version:4};return route.fulfill({json:campaigns[0]});}
  if(p==='/api/clubs/10/jobs'&&m==='POST'){const job={...body,id:30,clubId:10,status:'OPEN',version:0};jobs.push(job);return route.fulfill({json:job});}
  if(p==='/api/clubs/10/jobs/3'&&m==='PATCH'){expect(body.version).toBe(5);jobs[0]={...jobs[0],...body,version:6};return route.fulfill({json:jobs[0]});}
  if(p==='/api/clubs/10/jobs/3/applications')return route.fulfill({json:[]});
  report.unexpected.push({path:p,method:m});return route.fulfill({status:404,json:{}});
 });
 const capture=async name=>{await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`${out}/${name}.png`,fullPage:true});report.checks.push(name);};
 const tab=async name=>page.getByRole('link',{name:name+' tab',exact:true}).click();
 const step=async name=>page.getByRole('navigation',{name:'Editor steps'}).getByRole('button',{name:new RegExp(name)}).click();
 await page.goto('http://127.0.0.1:5294/e2e/fixtures/opportunities-connected.html');
 await expect(page.getByRole('heading',{name:'Community scarf'})).toBeVisible();await capture('store-list-desktop');
 await page.getByRole('button',{name:'Add product',exact:true}).click();
 await page.getByLabel('Product name',{exact:true}).fill('Academy training top');
 await page.getByLabel('Description',{exact:true}).fill('Lightweight training top for everyday sessions.');
 await capture('store-editor-details-desktop');
 await page.getByRole('button',{name:'Save product',exact:true}).click();
 await expect(page.getByLabel('Price',{exact:true})).toBeFocused();expect(report.writes.filter(w=>w.path==='/api/clubs/10/store/products')).toHaveLength(0);report.checks.push('save-opens-hidden-invalid-field');
 await page.getByLabel('Price',{exact:true}).fill('85');
 await page.getByRole('button',{name:'M',exact:true}).click();await page.getByLabel('Stock 1',{exact:true}).fill('8');
 await page.getByRole('button',{name:'L',exact:true}).click();await page.getByLabel('Stock 2',{exact:true}).fill('10');
 await capture('store-editor-stock-desktop');
 await tab('Overview');await tab('Store');await expect(page.getByLabel('Price',{exact:true})).toBeVisible();await expect(page.getByLabel('Price',{exact:true})).toHaveValue('85');report.checks.push('step-and-fields-retained-after-navigation');
 await step('Details & photos');await page.getByLabel('Add product photo (up to 8)',{exact:true}).setInputFiles({name:'photo.png',mimeType:'image/png',buffer:Buffer.from('isolated upload fixture')});await expect(page.getByAltText('Product photo 1')).toBeVisible();
 await step('Review & visibility');await page.getByLabel('Published in the Store',{exact:true}).check();await capture('store-editor-review-desktop');
 await page.getByRole('button',{name:'Save product',exact:true}).click();await expect(page.getByRole('heading',{name:'Academy training top'})).toBeVisible();
 expect(products[1]).toMatchObject({price:85,active:true,variants:[{label:'M',stock:8},{label:'L',stock:10}],images:['/api/media/test-product.png']});report.checks.push('product-create-payload');
 await page.getByLabel('More actions for Community scarf',{exact:true}).click();await page.getByRole('button',{name:'Hide Community scarf',exact:true}).click();await expect(page.getByText('Product hidden.',{exact:true})).toBeVisible();report.checks.push('product-versioned-status-change');
 await tab('Campaigns');await capture('campaign-list-desktop');await page.getByLabel('More actions for Community boot library',{exact:true}).click();await page.getByRole('button',{name:'Pause Community boot library',exact:true}).click();await expect(page.getByText('Campaign paused.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Create campaign',exact:true}).click();await page.getByLabel('Campaign title',{exact:true}).fill('Academy summer fund');await capture('campaign-editor-story-desktop');
 await step('Goal & timing');await capture('campaign-editor-goal-desktop');await step('Photos & review');await capture('campaign-editor-review-desktop');await page.getByRole('button',{name:'Save campaign',exact:true}).click();await expect(page.getByRole('heading',{name:'Academy summer fund'})).toBeVisible();expect(campaigns[1].status).toBe('DRAFT');report.checks.push('campaign-title-only-draft-and-versioned-pause');
 await tab('Jobs');await capture('jobs-list-desktop');await page.getByRole('button',{name:/View applicants/}).click();await expect(page.getByText('No applications have been submitted for this posting.')).toBeVisible();await page.getByRole('button',{name:'Back to job postings',exact:true}).click();
 await page.getByLabel('More actions for U14 goalkeeper coach',{exact:true}).click();await page.getByRole('button',{name:'Close',exact:true}).click();await expect(page.getByText('Posting closed.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:/Post Job/i,exact:true}).click();await page.getByLabel('Job title',{exact:true}).fill('Academy assistant coach');await capture('jobs-editor-details-desktop');await step('Who & how');await page.getByLabel('Application route',{exact:true}).selectOption('COACH');await capture('jobs-editor-route-desktop');await step('Review & post');await capture('jobs-editor-review-desktop');await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.getByRole('heading',{name:'Academy assistant coach'})).toBeVisible();expect(jobs[1].requiredRole).toBe('COACH');report.checks.push('job-create-route-applicants-versioned-close');
 await page.setViewportSize({width:390,height:844});
 for(const [name,edit] of [['Store','Academy training top'],['Campaigns','Academy summer fund'],['Jobs','Academy assistant coach']]){await tab(name);await capture(name.toLowerCase()+'-list-mobile');await page.getByRole('button',{name:'Edit '+edit,exact:true}).click();await capture(name.toLowerCase()+'-editor-mobile');await page.getByRole('navigation',{name:'Editor steps'}).getByRole('button').last().click();await capture(name.toLowerCase()+'-review-mobile');await page.getByRole('button',{name:name==='Jobs'?'Close job editor':'Close editor',exact:true}).click();await page.getByRole('button',{name:'Discard edits',exact:true}).click();}
 await page.setViewportSize({width:1440,height:1000});await tab('Store');await page.evaluate(()=>{document.documentElement.classList.remove('dark');document.querySelector('main').classList.add('workspace-light');document.body.style.background='#f4f6f4';});await capture('store-list-light');
 expect(report.errors).toEqual([]);expect(report.unexpected).toEqual([]);
 await writeFile(`${out}/connected-results.json`,JSON.stringify(report,null,2));console.log('PASS '+report.checks.length+' connected workspace checks');
} finally {await browser.close();await server.close();}
