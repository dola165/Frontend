import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createServer} from 'vite';
import {chromium,expect} from '@playwright/test';
const fixture=JSON.parse(await readFile(process.argv[2],'utf8'));
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const server=await createServer({root,configFile:path.join(root,'vite.config.ts'),define:{'import.meta.env.VITE_API_BASE_URL':JSON.stringify('/api'),'import.meta.env.VITE_ENABLE_MOCKS':'"false"'},server:{host:'127.0.0.1',port:5184,strictPort:true,hmr:false,proxy:{'/api':fixture.backend,'/uploads':fixture.backend}}});
await server.listen();const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext();
 const upload=async()=>{const r=await context.request.post(fixture.backend+'/api/media/upload',{headers:{Authorization:'Bearer '+fixture.token},multipart:{file:{name:'photo.png',mimeType:'image/png',buffer:Buffer.from(fixture.image,'base64')}}});expect(r.ok()).toBe(true);return (await r.json()).url;};
 const first=await upload(),second=await upload();
 await context.addCookies([{name:fixture.refreshName,value:fixture.refresh,url:fixture.backend,httpOnly:true,sameSite:'Lax'}]);
 await context.addInitScript(token=>localStorage.setItem('accessToken',token),fixture.expired);
 let refreshes=0;const page=await context.newPage();page.on('request',r=>{if(r.url().endsWith('/auth/refresh'))refreshes++;});
 await page.goto('http://127.0.0.1:5184/review/gk18/index.html?first='+encodeURIComponent(first)+'&second='+encodeURIComponent(second));
 await expect(page.locator('[data-testid=photo] img')).toHaveCount(0);expect(refreshes).toBe(0);
 const result=await page.evaluate(async()=>{const csrf=await (await fetch('/api/auth/csrf')).json();const response=await fetch('/api/auth/refresh',{method:'POST',headers:{[csrf.headerName]:csrf.token,'Content-Type':'application/json'},body:'{}'});if(!response.ok)return response.status;const data=await response.json();const {setStoredAccessToken}=await import('/src/utils/authStorage.ts');setStoredAccessToken(data.accessToken);return response.status;});
 expect(result).toBe(200);expect(refreshes).toBe(1);await expect(page.locator('[data-testid=photo] img')).toHaveCount(0);
 console.log('REPRODUCED R1: expired access token + valid refresh session causes private-image 404; media does not refresh; an explicit CSRF-protected refresh succeeds but the existing AvatarCell fallback stays mounted.');
 await page.evaluate(token=>localStorage.setItem('accessToken',token),fixture.token);
 // addInitScript from earlier overwrites on reload, so use a clean, valid-token context.
 const current=await browser.newContext();await current.addInitScript(token=>localStorage.setItem('accessToken',token),fixture.token);
 const rapid=await current.newPage();let firstRequests=0;
 await rapid.route('http://127.0.0.1:5184'+first,async route=>{firstRequests++;if(firstRequests>1)await new Promise(r=>setTimeout(r,1200));try{await route.continue();}catch{}});
 await rapid.route('http://127.0.0.1:5184'+second,async route=>{await new Promise(r=>setTimeout(r,1200));try{await route.continue();}catch{}});
 await rapid.goto('http://127.0.0.1:5184/review/gk18/index.html?first='+encodeURIComponent(first)+'&second='+encodeURIComponent(second));
 await expect.poll(()=>rapid.locator('[data-testid=photo] img').evaluate(img=>img.naturalWidth)).toBeGreaterThan(0);
 await rapid.getByRole('button',{name:'Second',exact:true}).click();await rapid.getByRole('button',{name:'First',exact:true}).click();
 await expect(rapid.locator('[data-testid=photo] img')).toHaveCount(0);
 expect((await current.request.get(fixture.backend+first,{headers:{Authorization:'Bearer '+fixture.token}})).status()).toBe(200);
 console.log('REPRODUCED R2: A -> slow B -> A renders revoked blob A, fires image error and cancels replacement load; server still returns 200 for A.');
}finally{await browser.close();await server.close();}
