// Isolated browser checks: every API response is a fixture; no real club records or payments are changed.
import { chromium, expect } from '@playwright/test';
import { mkdir,writeFile } from 'node:fs/promises';
const origin='http://127.0.0.1:5197';
const output='C:/Users/daddo/IdeaProjects/GrassKickZ/outputs/club-foundation-20260924';
await mkdir(output,{recursive:true});
const modules=['STAFF','CREDENTIALS','FACILITIES','READINESS','GUARDIANS','ATTENDANCE','DEVELOPMENT','EDUCATION','REGISTRATION','EQUIPMENT','FINANCE','TRAVEL','SPECIALISTS','DEPARTURES','AVAILABILITY'];
const field=(key,label,type,required=true,options=[])=>({key,label,type,required,options});
const definitions=[
 {module:'FACILITIES',kind:'FACILITY',label:'Facility',states:['DRAFT','PUBLISHED','ARCHIVED'],fields:[field('address','Address','text'),field('relationship','Club use','choice',true,['OWNED','RENTED','SHARED','REGULAR_USE']),field('accessibility','Accessibility arrangements','textarea',false)]},
 {module:'EQUIPMENT',kind:'ASSET',label:'Club equipment',states:['AVAILABLE','MAINTENANCE','RETIRED'],fields:[field('category','Category','choice',true,['KIT','BALLS','TRAINING','MEDICAL','TECHNOLOGY','OTHER']),field('quantity','Total quantity','integer'),field('condition','Condition','choice',true,['NEW','GOOD','WORN','DAMAGED']),field('location','Storage location','text')]},
 {module:'FINANCE',kind:'PURCHASE',label:'Purchase request',states:['DRAFT','SUBMITTED','APPROVED','PAID'],fields:[field('amount','Amount','money'),field('currency','Currency','currency'),field('payee','Supplier','text'),field('purpose','Purpose','textarea'),field('settlementReference','Manual payment reference','text',false)]},
 {module:'REGISTRATION',kind:'REGISTRATION',label:'Registration and eligibility',states:['PENDING','IN_REVIEW','APPROVED'],fields:[field('competition','Competition','text'),field('requirements','Documents and approvals','textarea')]}
];
const boot={clubId:7,clubName:'Kalda Community Football',actorId:10,leadership:true,definitions,specialisations:['TEAM_MANAGER','WELFARE_OFFICER','GOALKEEPER_COACH','EQUIPMENT_MANAGER'],permissions:modules.map(m=>m+':WRITE'),settings:{setting:'COMMUNITY',playing_level:'AMATEUR',currency:'EUR',country_code:'EE',timezone:'Europe/Tallinn',enabled_modules:modules,revision:0},modules:modules.map(id=>({id,writable:true,globalWrite:true,writeSquads:[12,16]})),squads:[{id:12,name:'Under 12'},{id:16,name:'Under 16'}],people:[{id:20,name:'Jamie Example'}],staff:[{id:10,name:'Taylor Example'}],guardians:[{id:11,name:'Alex Example',child_id:20}],venues:[],events:[{id:31,title:'Saturday friendly',starts_at:'2026-10-03T10:00:00'}],sessions:[],links:[]};
let records=[{id:1,club_id:7,kind:'REGISTRATION',module:'REGISTRATION',title:'U12 autumn registration',status:'PENDING',squad_id:12,subject_user_id:20,assigned_user_id:10,event_id:null,session_id:null,related_record_id:null,due_on:'2026-10-01',data:{competition:'Regional youth league',requirements:'Registration form and parent confirmation'},revision:0,canEdit:true,transitions:['IN_REVIEW','REJECTED']},{id:2,club_id:7,kind:'FACILITY',module:'FACILITIES',title:'Kalda school sports ground',status:'PUBLISHED',squad_id:null,subject_user_id:null,assigned_user_id:10,event_id:null,session_id:null,related_record_id:null,due_on:null,data:{address:'School sports ground, Tallinn',relationship:'SHARED',accessibility:'Step-free entrance from the east gate.'},revision:0,canEdit:true,transitions:['DRAFT','ARCHIVED']}];
const errors=[],checks=[],requests=[];let activePage;const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 for(const [width,height,theme] of [[1440,1000,'light'],[390,844,'dark']]) {
  const page=await browser.newPage({viewport:{width,height}});activePage=page;page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(theme=>{localStorage.setItem('accessToken','isolated-qa-token');localStorage.setItem('i18nextLng','en');localStorage.setItem('theme-preference',theme);},theme);
  await page.route('**/api/**',async route=>{
   const request=route.request(),url=new URL(request.url());if(!url.pathname.startsWith('/api/'))return route.continue();const p=url.pathname.replace(/^\/api/,'');let result=[];requests.push(p);
   if(p==='/users/me')result={id:10,fullName:'Taylor Example',role:'ORGANIZER',emailVerified:true,profileComplete:true,dob:'1990-01-01',navigationCapabilities:{version:1,workspaces:[]}};
   else if(p==='/auth/csrf')result={token:'qa',headerName:'X-XSRF-TOKEN'};
   else if(p==='/clubs/7/operations')result=boot;
   else if(p==='/clubs/7/operations/actions')result=records.filter(r=>r.status==='PENDING');
   else if(p==='/clubs/7/operations/finance-summary')result=[{currency:'EUR',budget:2400,committed:120,spent:340,membership_due:250,membership_recorded:900}];
   else if(p==='/clubs/7/operations/records'&&request.method()==='POST'){
    const body=request.postDataJSON();if(body.kind==='ASSET'&&'currency' in body.data)throw Error('A non-financial record must not submit currency.');
    result={...body,id:records.length+1,club_id:7,module:definitions.find(d=>d.kind===body.kind).module,status:'AVAILABLE',squad_id:body.squadId,subject_user_id:body.subjectUserId,assigned_user_id:body.assignedUserId,data:body.data,revision:0,canEdit:true,transitions:['MAINTENANCE','RETIRED']};records.push(result);checks.push('Saved equipment through the form with domain fields only');
   }else if(p==='/clubs/7/operations/records')result=records.filter(r=>r.module===url.searchParams.get('module'));
   else if(/^\/clubs\/7\/operations\/records\/\d+$/.test(p))result=records.find(r=>r.id===Number(p.split('/').at(-1)));
   else if(p.endsWith('/history'))result=[{id:1,action:'CREATED',actor:'Taylor Example',created_at:'2026-09-24T09:00:00Z',to_status:'PENDING',note:null}];
   else if(p==='/club-operations/mine')result={clubs:[{id:7,name:boot.clubName}],appointments:[],permissions:[]};
   else if(p==='/club-operations/family')result={connections:[{club_id:7,club_name:boot.clubName,user_id:20,name:'Jamie Example'}],shared:[],schedule:[],reports:[]};
   else if(p==='/notifications/unread-count')result={count:0};
   else if(p==='/users/me/organizations')result=[];
   await route.fulfill({json:result??{},headers:{'Cache-Control':'no-store'}});
  });
  await page.goto(origin+'/clubs/7/operations');
  await expect(page.getByRole('heading',{name:boot.clubName,exact:true})).toBeVisible();
  await expect(page.getByText('U12 autumn registration',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Confidential welfare',exact:true})).toHaveCount(0);
  await page.screenshot({path:`${output}/${width}-${theme}-dashboard.png`,fullPage:true});
  if(width<900)await page.getByRole('combobox',{name:'Workspace section'}).selectOption('EQUIPMENT');else await page.getByRole('button',{name:'Equipment',exact:true}).click();
  await page.getByLabel('Create operation').selectOption('ASSET');
  await page.getByLabel('Title',{exact:true}).fill(`Training balls ${width}`);
  await page.getByRole('combobox',{name:/^Category/}).selectOption('BALLS');
  await page.getByLabel('Total quantity',{exact:true}).fill('12');
  await page.getByRole('combobox',{name:/^Condition/}).selectOption('GOOD');
  await page.getByLabel('Storage location',{exact:true}).fill('Ground equipment store');
  await page.screenshot({path:`${output}/${width}-${theme}-equipment.png`,fullPage:true});
  await page.getByRole('button',{name:'Save record',exact:true}).click();
  await expect(page.getByRole('button',{name:new RegExp(`Training balls ${width}`)})).toBeVisible();
  if(width<900)await page.getByRole('combobox',{name:'Workspace section'}).selectOption('FINANCE');else await page.getByRole('button',{name:'Finance',exact:true}).click();
  await expect(page.getByRole('heading',{name:'EUR · Recorded finances',exact:true})).toBeVisible();
  await page.screenshot({path:`${output}/${width}-${theme}-finance.png`,fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  await page.goto(origin+'/club-operations');
  await expect(page.getByRole('heading',{name:'Player & family records'})).toBeVisible();
  await page.getByRole('button',{name:'Report a confidential concern'}).click();
  await expect(page.getByLabel('What happened?')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  await page.screenshot({path:`${output}/${width}-${theme}-family.png`,fullPage:true});
  checks.push(`${width}px ${theme}: dashboard, permissions, equipment save, finance, family reporting; no horizontal overflow`);
  await page.close();
 }
 expect(errors).toEqual([]);
 await writeFile(`${output}/browser-checks.json`,JSON.stringify({fixtureOnly:true,checks,errors},null,2));
 console.log(JSON.stringify({checks,errors,output},null,2));
}catch(error){if(activePage){await activePage.screenshot({path:`${output}/failure.png`,fullPage:true});console.log(JSON.stringify({url:activePage.url(),body:(await activePage.locator("body").innerText()).slice(0,2500),errors,requests},null,2));}throw error;}finally{await browser.close();}


