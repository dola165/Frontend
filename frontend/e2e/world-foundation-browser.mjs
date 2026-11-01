import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.resolve(root,'../../world-fix-round1-browser');await mkdir(out,{recursive:true});
const server=await createServer({root,configFile:false,cacheDir:path.join(out,'vite-cache'),plugins:[react(),tailwindcss(),{name:'world-fixture-entry',configureServer(s){s.middlewares.use((req,_res,next)=>{if (/^\/(world|parent|fixture-inbox)(\/|\?|$)/.test(req.url)) req.url='/e2e/world-foundation.html';next();});}}],
    resolve:{preserveSymlinks:true,alias:[{find:/^.*\/context\/AuthContext$/,replacement:path.join(root,'e2e/world-foundation-auth.tsx')},{find:/^.*\/api\/axiosConfig$/,replacement:path.join(root,'e2e/world-foundation-api.ts')}]},
    optimizeDeps:{entries:['e2e/world-foundation.html']},define:{__BUILD_ID__:'""',__GIT_HISTORY__:'{"known":false}',__GIT_BUILD__:'{"known":false}'},server:{host:'127.0.0.1',port:5197,strictPort:true,hmr:false}});
await server.listen();const browser=await chromium.launch({headless:true,channel:'msedge'});
const requests=[],errors=[],blocked=[],unknown=[];
const club={id:71,name:'Synthetic Riverside Community Football Club',description:'Public football for the neighbourhood.',type:'GRASSROOTS',isOfficial:false,followerCount:0,memberCount:0,isFollowedByMe:false,isMember:false,isStaffMember:false,
    cityName:'Tbilisi',countryName:'Georgia',addressText:'Synthetic ground, Tbilisi',latitude:41.7151,longitude:44.8271,whatsappNumber:'+995555000071',websiteUrl:'https://club.example.test',email:'club@example.test',playerJoinPolicy:'INVITE_ONLY',
    presentation:{programmes:[{id:1,name:'Community training',published:true,ageMin:6,ageMax:12,priceType:'FIXED',amount:120,currency:'GEL',billingPeriod:'MONTH',validFrom:null,validUntil:null}],honours:[],sponsors:[],about:'',social:{phone:'+995555000071',website:'https://club.example.test'}}};
const child={id:9,name:'Synthetic Child',dateOfBirth:'2018-12-30',minor:true,guardian:true,gender:'FEMALE',provenance:null};
const pageResult=content=>({content,totalElements:content.length,totalPages:content.length?1:0,pageNumber:0,pageSize:12});
try{
 for(const width of [1920,390])for(const theme of ['light','dark']){
    let saved=[],missingCohort=false;
    const context=await browser.newContext({viewport:{width,height:1000},colorScheme:theme});
    await context.addInitScript(({theme})=>{localStorage.setItem('world-fixture-theme',theme);localStorage.setItem('world-fixture-login','guest');localStorage.setItem('i18nextLng','en');},{theme});
    await context.route('**/*',async route=>{
        const req=route.request(),url=new URL(req.url());
        if(url.origin!=='http://127.0.0.1:5197'){blocked.push(url.origin);return route.abort();}
        if(!url.pathname.startsWith('/api/'))return route.continue();
        const p=url.pathname.slice(4);requests.push({width,theme,method:req.method(),path:p,query:url.search,body:req.postData()});
        let data;
        if(p==='/clubs'&&url.searchParams.get('search')==='fixture-failure')return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Synthetic search unavailable'})});
        if(p==='/clubs')data=pageResult(url.searchParams.get('city')==='Nowhere'?[]:[club]);
        else if(p==='/clubs/locations')data=pageResult([{id:71,cityName:'Tbilisi',countryName:'Georgia',countryCode:'GE'},{id:72,cityName:'Batumi',countryName:'Georgia',countryCode:'GE'}]);
        else if(p==='/clubs/my-membership-context')data=null;
        else if(p==='/clubs/71')data=club;
        else if(p.includes('/admissions/home'))data={participants:[{...child,dateOfBirth:missingCohort?null:child.dateOfBirth},{...child,id:10,name:'Synthetic Other Child',dateOfBirth:'2012-01-01'}],cases:[],enrollments:[],offers:[]};
        else if(p==='/notifications')data=pageResult(saved.filter(w=>w.active).map(w=>({id:101,type:'WORLD_SEARCH_RESULTS',entityType:'world_search_window',entityId:21,title:'New World results',body:'New public results match a search you follow.',scope:'PERSONAL',createdAt:'2026-10-30T10:00:00Z',isRead:false,linkPath:`/world/clubs?watch=${w.id}`})));
        else if(p==='/match-history')data={items:[],total:0,page:0,pageSize:100};
        else if(p==='/users/me/place')data={source:'SAVED',name:'Tbilisi',latitude:41.7151,longitude:44.8271,countryCode:'GE'};
        else if(p==='/map/geocode')data=[{latitude:41.6,longitude:41.6,name:'Batumi'}];
        else if(p.startsWith('/world/search-watches')){
            const id=Number(p.split('/').at(-1));
            if(req.method()==='POST'){const input=req.postDataJSON();data={...input,id:saved.length+1,active:true,childId:input.childId??null};saved.push(data);}
            else if(req.method()==='DELETE'){saved=saved.map(w=>w.id===id?{...w,active:false}:w);data=null;}
            else if(id)data=saved.find(w=>w.id===id);else data=saved;
        }
        else if(p==='/competitions'||p.includes('/tournaments'))data=pageResult([]);
        else if(p.includes('/opportunities')||p.includes('/tryouts')||p.includes('/events/search')||p==='/match-exchange'||p==='/referees'||p==='/people')data={items:[],total:0,hasMore:false,page:0,size:20,pageSize:24};
        else if(p.includes('/map/'))data=pageResult([]);
        else if(p.includes('capabilities'))data={actions:[]};
        else {data=[];unknown.push(p);}
        return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data??null)});
    });
    const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push({width,theme,message:e.message}));
    await page.goto('http://127.0.0.1:5197/world/clubs?near=Tbilisi');
    await expect(page.getByText(club.name).first()).toBeVisible();
    await expect(page.getByRole('button',{name:'Follow this search'})).toHaveCount(0);
    await page.screenshot({animations:'disabled',path:path.join(out,`${width}-${theme}-guest.png`),fullPage:true});
    await page.getByLabel('Birth year',{exact:true}).selectOption('2018');
    await expect.poll(()=>requests.some(r=>r.width===width&&r.theme===theme&&r.path==='/clubs'&&new URLSearchParams(r.query).get('birthYear')==='2018')).toBe(true);
    await page.getByRole('combobox',{name:/^Near/}).selectOption('Batumi');
    await expect.poll(()=>requests.some(r=>r.width===width&&r.theme===theme&&r.path==='/clubs'&&new URLSearchParams(r.query).get('city')==='Batumi')).toBe(true);
    await page.getByRole('combobox',{name:/^Near/}).selectOption('Tbilisi');
    await page.getByRole('link',{name:'Opportunities',exact:true}).click();
    await expect(page).toHaveURL(/birthYear=2018/);
    await page.goBack();await expect(page).toHaveURL(/world\/clubs.*birthYear=2018/);
    await page.evaluate(()=>localStorage.setItem('world-fixture-login','adult'));
    // AddInitScript is for a new document too: change it for the authenticated fixture journey.
    await context.addInitScript(()=>localStorage.setItem('world-fixture-login','adult'));
    await page.evaluate(()=>sessionStorage.setItem('family-player:4:world-synthetic','9'));
    await page.goto('http://127.0.0.1:5197/world/clubs?near=Tbilisi');
    await page.getByRole('button',{name:'Follow this search',exact:true}).click();
    await expect(page.getByRole('button',{name:'Stop following this search',exact:true})).toBeVisible();
    await page.reload();await expect(page.getByRole('button',{name:'Stop following this search',exact:true})).toBeVisible();
    await page.screenshot({animations:'disabled',path:path.join(out,`${width}-${theme}-followed.png`),fullPage:true});
    await page.evaluate(()=>sessionStorage.setItem('family-player:4:world-synthetic','10'));
    await page.goto('http://127.0.0.1:5197/fixture-inbox');
    await page.getByRole('link',{name:'Open World search notice',exact:true}).click();
    await expect(page).toHaveURL(/near=Tbilisi.*birthYear=2018/);
    await expect(page).toHaveURL(/player=9/);
    await page.screenshot({animations:'disabled',path:path.join(out,`${width}-${theme}-notice-return.png`),fullPage:true});
    await page.getByRole('button',{name:'Stop following this search',exact:true}).click();
    await expect(page.getByRole('button',{name:'Follow this search',exact:true})).toBeVisible();
    const fixtureStart=requests.length;
    await page.goto('http://127.0.0.1:5197/world/matches?tab=fixtures&city=Rustavi&ageGroup=U16&near=Batumi');
    await expect.poll(()=>requests.slice(fixtureStart).filter(r=>r.path==='/match-history').length).toBeGreaterThan(0);
    expect(requests.slice(fixtureStart).filter(r=>r.path==='/match-history').every(r=>{const p=new URLSearchParams(r.query);return p.get('city')==='Rustavi'&&p.get('ageGroup')==='U16'&&!p.has('birthYear');})).toBe(true);
    await expect(page.getByText('0 matches near Rustavi',{exact:true}).first()).toBeVisible();
    await page.screenshot({animations:'disabled',path:path.join(out,`${width}-${theme}-fixtures.png`),fullPage:true});
    missingCohort=true;const unknownStart=requests.length;
    await page.goto('http://127.0.0.1:5197/world/clubs?player=9&near=Tbilisi');
    await expect(page.getByText('This search context is unavailable. Choose Anyone or an explicit public birth year.',{exact:true}).first()).toBeVisible();
    expect(requests.slice(unknownStart).filter(r=>r.path==='/clubs')).toHaveLength(0);
    await expect(page.getByRole('button',{name:'Follow this search',exact:true})).toHaveCount(0);
    await page.screenshot({animations:'disabled',path:path.join(out,`${width}-${theme}-unknown-cohort.png`),fullPage:true});
    await page.getByLabel('Birth year',{exact:true}).selectOption('2018');
    await expect.poll(()=>requests.slice(unknownStart).some(r=>r.path==='/clubs'&&new URLSearchParams(r.query).get('birthYear')==='2018')).toBe(true);
    missingCohort=false;
    await page.goto('http://127.0.0.1:5197/parent?find=club&player=9&near=Tbilisi&selected=71');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('link',{name:'Call',exact:true})).toHaveAttribute('href','tel:+995555000071');
    await expect(page.getByRole('link',{name:'WhatsApp',exact:true})).toHaveAttribute('href',/^https:\/\/wa.me\//);
    await page.getByRole('button',{name:'Follow this search',exact:true}).click();
    await expect(page.getByRole('button',{name:'Stop following this search',exact:true})).toBeVisible();
    await page.screenshot({animations:'disabled',path:path.join(out,`${width}-${theme}-parent.png`),fullPage:true});
    await page.keyboard.press('Tab');expect(await page.evaluate(()=>document.activeElement!==document.body)).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.classList.contains('dark'))).toBe(theme==='dark');
    await page.goto('http://127.0.0.1:5197/world/clubs?player=anyone&near=Nowhere');
    await expect(page.getByText('No clubs near Nowhere yet',{exact:true})).toBeVisible();
    await page.screenshot({animations:'disabled',path:path.join(out,`${width}-${theme}-empty.png`),fullPage:true});
    await page.goto('http://127.0.0.1:5197/world/clubs?near=Tbilisi&q=fixture-failure');
    await expect(page.getByText('Synthetic search unavailable',{exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Follow this search',exact:true})).toHaveCount(0);
    await page.screenshot({animations:'disabled',path:path.join(out,`${width}-${theme}-error.png`),fullPage:true});
    await context.close();
 }
 expect(errors).toEqual([]);
 const publicRequests=requests.filter(r=>r.method==='GET'&&['/clubs','/admissions/opportunities','/tryouts/discovery','/competitions'].includes(r.path));
 expect(publicRequests.every(r=>!/(player|child|guardian|Synthetic.Child|2018-12)/i.test(r.query))).toBe(true);
 console.log('PASS: actual World/Parent and notification-reader -> typed mapper -> watch resolver -> saved criteria, changed remembered child, explicit fixture city/age, unknown cohort/explicit recovery; 1920/390 light/dark, keep/stop/back/refresh, contacts, keyboard and no horizontal overflow. All API data synthetic; external requests aborted.');
}finally{
 await writeFile(path.join(out,'evidence.json'),JSON.stringify({requests,errors,externalRequestsAborted:[...new Set(blocked)],unhandledFixturePaths:[...new Set(unknown)]},null,2));
 await browser.close();await server.close();
}
