import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer as createSocketServer } from 'node:net';

// Isolated, deterministic client-side return checks. No live API or providers.
const out = path.resolve(process.env.COMMERCE_RETURN_OUTPUT || `review/commerce-return-${Date.now()}`);
await mkdir(out, {recursive:false});
const reservation = createSocketServer();
await new Promise(resolve => reservation.listen(0,'127.0.0.1',resolve));
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
const server = await createServer({
    root:process.cwd(), envDir:false,cacheDir:path.join(out,'.vite'),
    define:{'import.meta.env.VITE_API_BASE_URL':'"/api"','import.meta.env.VITE_ENABLE_MOCKS':'"false"'},
    server:{host:'127.0.0.1',port,strictPort:true,hmr:false},
});
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({headless:true,channel:'chrome'});
const results = [];
const photo = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2uoAAAAASUVORK5CYII=', 'base64');
const latch = () => {let release;const promise = new Promise(resolve => {release = resolve;});return {promise,release};};
const initialProduct = () => ({id:1,clubId:10,clubName:'FC Dinamo Tbilisi Academy',name:'Academy shirt',price:25,currency:'GEL',version:0,active:true,images:[],variants:[{id:1,label:'M',stock:3}]});
const initialCampaign = () => ({id:1,clubId:10,title:'Academy pitch',summary:'Youth pitch',description:'Improve the pitch',beneficiary:'Youth teams',category:'FACILITIES',currency:'GEL',status:'PUBLISHED',phase:'ACTIVE',publishedAt:'2026-09-01T12:00:00Z',version:0,images:[],updates:[]});
const initialJob = () => ({id:1,clubId:10,title:'Academy coach',description:'Coaching role',status:'OPEN',version:0,category:'COACHING',engagementType:'PAID'});
async function fixture() {
    const context = await browser.newContext({viewport:{width:1200,height:900},serviceWorkers:'block'});
    const page = await context.newPage();
    const errors = [], unexpected = [], writes = [];
    const state = {products:[initialProduct()],campaigns:[initialCampaign()],jobs:[initialJob()],listFails:false,hold:null};
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        // The app imports a font stylesheet; render with the local fallback offline.
        if (url.origin === 'https://fonts.googleapis.com') return route.fulfill({contentType:'text/css',body:''});
        if (url.origin !== origin) {unexpected.push(`${request.method()} ${url.origin}${url.pathname}`);return route.abort();}
        if (url.pathname.startsWith('/uploads/')) return route.fulfill({contentType:'image/png',body:photo});
        if (!url.pathname.startsWith('/api/')) return route.continue();
        if (url.pathname === '/api/auth/csrf') return route.fulfill({json:{headerName:'X-XSRF-TOKEN',token:'fixture'}});
        if (request.method() !== 'GET') writes.push({method:request.method(),path:url.pathname,version:url.searchParams.get('version'),body:request.headers()['content-type']?.includes('application/json') ? request.postDataJSON() : null});
        if (state.hold?.matches(request)) {
            const held = state.hold; state.hold = null;
            held.started.release(); await held.finish.promise;
            await route.fulfill(held.response()); held.done.release(); return;
        }
        if (request.method() === 'GET') {
            if (state.listFails) return route.fulfill({status:503,json:{error:'Review list unavailable.'}});
            if (/\/store\/products\/all$/.test(url.pathname)) return route.fulfill({json:state.products});
            if (/\/campaigns\/\d+$/.test(url.pathname)) return route.fulfill({json:state.campaigns[0]});
            if (url.pathname.includes('/campaigns')) return route.fulfill({json:state.campaigns});
            if (url.pathname.includes('/jobs')) return route.fulfill({json:state.jobs});
        }
        unexpected.push(`${request.method()} ${url.pathname}`);
        return route.fulfill({status:500,json:{error:'Unexpected fixture request'}});
    });
    function hold(matches, response) {
        const value = {matches,response,started:latch(),finish:latch(),done:latch()};
        state.hold = value; return value;
    }
    await page.goto(`${origin}/e2e/fixtures/commerce-return.html`);
    return {page,state,hold,writes,finish:async () => {try {expect(errors).toEqual([]);expect(unexpected).toEqual([]);} finally {await context.close();}}};
}
const tab = (page, name) => page.getByRole('link',{name:`${name} tab`,exact:true}).click();
const roundTrip = async (page, name) => {await tab(page,'Overview');await tab(page,name);};
const warned = page => page.evaluate(() => {const event = new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;});
const menu = (page, title) => page.getByLabel(`More actions for ${title}`,{exact:true});
async function action(page, title, name) {
    await menu(page,title).click();
    await page.getByRole('button',{name,exact:true}).click();
}
const featureInfo = feature => feature === 'Store'
    ? {create:'Add product',field:'Product name',title:'Academy shirt',photo:'Product photo 1'}
    : {create:'Create campaign',field:'Campaign title',title:'Academy pitch',photo:'Campaign photo 1'};
async function draft(page, feature, text) {
    const info = featureInfo(feature);
    await tab(page,feature);await page.getByRole('button',{name:info.create,exact:true}).click();
    await page.getByLabel(info.field,{exact:true}).fill(text);
    if(feature === 'Campaigns') await page.getByRole('button',{name:/Photos & review/}).click();
}
async function upload(page, hold) {
    const pending = hold(request => request.url().includes('/media/upload'), () => ({json:{url:'/uploads/original.png'}}));
    await page.locator('input[type=file]').setInputFiles({name:'original.png',mimeType:'image/png',buffer:photo});
    await pending.started.promise;return pending;
}
async function discard(page) {
    await page.getByRole('button',{name:'Close editor',exact:true}).click();
    await page.getByRole('button',{name:'Discard edits',exact:true}).focus();await page.keyboard.press('Enter');
}
async function record(name, run) {
    await run();results.push({name,passed:true});console.log(`PASS ${name}`);
    await writeFile(path.join(out,'results.json'),JSON.stringify({api:'isolated delayed fixtures; real components/router/client',origin,results},null,2));
}
try {
    for(const feature of ['Store','Campaigns']) {
        await record(`${feature}: pending discard, navigation, replacement and keyboard`, async () => {
            const f = await fixture(), {page} = f, info = featureInfo(feature);
            try {
                await draft(page,feature,'Original draft');
                await page.getByRole('button',{name:'Close editor',exact:true}).click();
                const pending = await upload(page,f.hold);
                await expect(page.getByRole('button',{name:'Discard edits',exact:true})).toBeDisabled();
                await page.getByRole('button',{name:'Discard edits',exact:true}).evaluate(button => button.click());
                let nativeWarning = false;
                page.once('dialog',async dialog => {nativeWarning = dialog.type() === 'beforeunload';await dialog.dismiss();});
                await page.reload({timeout:3000}).catch(() => {});
                expect(nativeWarning).toBe(true);
                expect(await warned(page)).toBe(true);await roundTrip(page,feature);
                await expect(page.getByRole('button',{name:'Close editor',exact:true})).toBeDisabled();
                pending.finish.release();await pending.done.promise;
                await expect(page.getByAltText(info.photo,{exact:true})).toBeVisible();
                await expect.poll(() => page.getByAltText(info.photo,{exact:true}).evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
                await page.setViewportSize({width:390,height:844});await discard(page);
                await draft(page,feature,'Replacement draft');await expect(page.getByAltText(info.photo,{exact:true})).toHaveCount(0);
                await page.screenshot({path:path.join(out,`${feature}-replacement.png`),fullPage:true});
            } finally {await f.finish();}
        });
        for(const boundary of ['club','account']) await record(`${feature}: upload completion across ${boundary} boundary`, async () => {
            const f = await fixture(), {page} = f, info = featureInfo(feature);
            try {
                await draft(page,feature,'Origin draft');const pending = await upload(page,f.hold);
                await page.getByRole(boundary === 'club' ? 'link':'button',{name:`Switch ${boundary}`,exact:true}).click();
                await draft(page,feature,'Other scope draft');
                pending.finish.release();await pending.done.promise;
                await expect(page.getByAltText(info.photo,{exact:true})).toHaveCount(0);
                await expect(page.getByRole('button',{name:'Close editor',exact:true})).toBeEnabled();
                await page.getByRole(boundary === 'club' ? 'link':'button',{name:`Switch ${boundary}`,exact:true}).click();
                if(boundary === 'club') {
                    await expect(page.getByAltText(info.photo,{exact:true})).toBeVisible();
                    if(feature === 'Campaigns') await page.getByRole('button',{name:/Tell the story/}).click();
                    await expect(page.getByLabel(info.field,{exact:true})).toHaveValue('Origin draft');
                } else {
                    await expect(page.getByRole('button',{name:info.create,exact:true})).toBeEnabled();
                    expect(await warned(page)).toBe(false);
                    await draft(page,feature,'New session draft');await expect(page.getByAltText(info.photo,{exact:true})).toHaveCount(0);
                }
            } finally {await f.finish();}
        });
    }
    for(const [feature,operation] of [['Store','archive'],['Store','hide'],['Campaigns','pause'],['Campaigns','archive'],['Jobs','close'],['Jobs','delete'],['Jobs','reopen']]) {
        for(const outcome of ['success','conflict']) await record(`${feature} ${operation}: ${outcome} through return`, async () => {
            const f = await fixture(), {page,state} = f;
            try {
                if(operation === 'reopen') state.jobs[0].status = 'CLOSED';
                await tab(page,feature);
                const title = feature === 'Jobs' ? 'Academy coach' : featureInfo(feature).title;
                const pending = f.hold(request => request.method() !== 'GET', () => {
                    if(outcome === 'conflict') return {status:409,json:{error:'Review conflict: a colleague changed this record.'}};
                    if(feature === 'Jobs') {
                        state.jobs = operation === 'delete' ? [] : [{...state.jobs[0],status:operation === 'close' ? 'CLOSED':'OPEN',version:1}];
                        return {json:state.jobs[0] ?? {}};
                    }
                    if(feature === 'Store') {state.products = operation === 'archive' ? [] : [{...state.products[0],active:false,version:1}];return {json:state.products[0] ?? {}};}
                    state.campaigns = [{...state.campaigns[0],status:operation === 'pause'?'PAUSED':'ARCHIVED',phase:operation === 'pause'?'PAUSED':'ARCHIVED',version:1}];return {json:state.campaigns[0]};
                });
                const label = feature === 'Jobs' ? operation === 'delete' ? `Delete ${title}` : operation === 'close'?'Close':'Reopen' : `${operation[0].toUpperCase()+operation.slice(1)} ${title}`;
                await action(page,title,label);
                if(['archive','delete'].includes(operation)) await page.getByRole('button',{name:`Confirm ${operation}`,exact:true}).click();
                await pending.started.promise;await roundTrip(page,feature);
                await expect(menu(page,title)).toHaveAttribute('aria-disabled','true');expect(await warned(page)).toBe(true);
                expect(f.writes).toHaveLength(1);
                expect(f.writes[0].method === 'DELETE' ? Number(f.writes[0].version) : f.writes[0].body.version).toBe(0);
                pending.finish.release();await pending.done.promise;
                if(outcome === 'conflict') await expect(page.getByRole('alert')).toContainText('Review conflict');
                else {
                    const text = feature === 'Jobs' ? `Posting ${operation === 'delete'?'deleted':operation === 'close'?'closed':'reopened'}.` : feature === 'Store' ? `Product ${operation === 'archive'?'archived':'hidden'}.` : `Campaign ${operation === 'pause'?'paused':'archived'}.`;
                    await expect(page.getByRole('status').filter({hasText:text})).toBeVisible();
                    if(['archive','delete'].includes(operation)) await expect(page.getByRole('heading',{name:title,exact:true})).toHaveCount(0);
                    else {await menu(page,title).click();await expect(page.getByRole('button',{name:feature === 'Jobs' ? operation === 'close'?'Reopen':'Close' : feature === 'Store'?`Publish ${title}`:`Resume ${title}`,exact:true})).toBeEnabled();}
                }
                await roundTrip(page,feature);
                if(outcome === 'conflict') {
                    await expect(page.getByRole('alert')).toContainText('Review conflict');
                    await expect(page.getByRole('button',{name:`Confirm ${operation}`,exact:true})).toHaveCount(0);
                }
                expect(await warned(page)).toBe(false);
                await page.setViewportSize({width:390,height:844});
                if(operation === 'close' || operation === 'pause' || feature === 'Store') await page.screenshot({path:path.join(out,`${feature}-${operation}-${outcome}.png`),fullPage:true});
            } finally {await f.finish();}
        });
    }
    for(const feature of ['Store','Campaigns','Jobs']) for(const boundary of ['club','account']) await record(`${feature}: pending action stays in its ${boundary} scope`, async () => {
        const f = await fixture(), {page} = f;
        try {
            await tab(page,feature);const title = feature === 'Jobs'?'Academy coach':featureInfo(feature).title;
            const pending = f.hold(request => request.method() !== 'GET', () => ({status:409,json:{error:'Original scope conflict.'}}));
            await action(page,title,feature === 'Jobs'?'Close':feature === 'Store'?`Hide ${title}`:`Pause ${title}`);
            await pending.started.promise;
            await page.getByRole(boundary === 'club' ? 'link':'button',{name:`Switch ${boundary}`,exact:true}).click();
            await expect(menu(page,title)).toHaveAttribute('aria-disabled','false');
            pending.finish.release();await pending.done.promise;
            await expect(page.getByRole('alert')).toHaveCount(0);
            await page.getByRole(boundary === 'club' ? 'link':'button',{name:`Switch ${boundary}`,exact:true}).click();
            if(boundary === 'club') await expect(page.getByRole('alert')).toContainText('Original scope conflict.');
            else await expect(page.getByRole('alert')).toHaveCount(0);
            expect(await warned(page)).toBe(false);
        } finally {await f.finish();}
    });
    for(const feature of ['Store','Campaigns','Jobs']) await record(`${feature}: action conflict remains visible beside list failure`, async () => {
        const f = await fixture(), {page,state} = f;
        try {
            await tab(page,feature);const title = feature === 'Jobs'?'Academy coach':featureInfo(feature).title;
            const pending = f.hold(request => request.method() !== 'GET', () => ({status:409,json:{error:'Review action conflict.'}}));
            await action(page,title,feature === 'Jobs'?'Close':feature === 'Store'?`Hide ${title}`:`Pause ${title}`);
            await pending.started.promise;await tab(page,'Overview');state.listFails = true;
            pending.finish.release();await pending.done.promise;await tab(page,feature);
            await expect(page.getByRole('alert').filter({hasText:feature === 'Jobs'?/Could not load|Failed to load|load/i:'Review list unavailable.'})).toBeVisible();
            await expect(page.getByRole('alert').filter({hasText:'Review action conflict.'})).toBeVisible();
            await page.screenshot({path:path.join(out,`${feature}-list-failure.png`),fullPage:true});
        } finally {await f.finish();}
    });
    for(const outcome of ['success','failure']) await record(`Campaign updates: ${outcome} across navigation`, async () => {
        const f = await fixture(), {page} = f;
        try {
            await tab(page,'Campaigns');
            const pending = f.hold(request => /\/campaigns\/1$/.test(new URL(request.url()).pathname), () => outcome === 'success'?{json:initialCampaign()}:{status:409,json:{error:'Review updates unavailable.'}});
            await action(page,'Academy pitch','Updates for Academy pitch');await pending.started.promise;
            await roundTrip(page,'Campaigns');await expect(menu(page,'Academy pitch')).toHaveAttribute('aria-disabled','true');
            pending.finish.release();await pending.done.promise;
            if(outcome === 'success') await expect(page.getByLabel('Update title',{exact:true})).toBeVisible();
            else await expect(page.getByRole('alert')).toContainText('Review updates unavailable.');
        } finally {await f.finish();}
    });
} catch(error) {
    await writeFile(path.join(out,'failure.txt'),String(error.stack));throw error;
} finally {await browser.close();await server.close();}
