// Full App, real AuthProvider/storage/Axios, controlled synthetic API responses.
import {createServer} from 'vite';
import {chromium, expect} from '@playwright/test';
import {mkdir, writeFile} from 'node:fs/promises';
const output='review/full-web-20260910/session-browser'; await mkdir(output,{recursive:true});
const server=await createServer({root:process.cwd(),define:{'import.meta.env.VITE_API_BASE_URL':'"/api"','import.meta.env.VITE_ENABLE_MOCKS':'"false"'},server:{host:'127.0.0.1',port:5222,strictPort:true,hmr:false}});
await server.listen(); const browser=await chromium.launch({channel:'chrome',headless:true});
const origin='http://127.0.0.1:5222', writes=[], errors=[];
try {
 const context=await browser.newContext({viewport:{width:1440,height:960}});
 await context.route('**/*', async route=>{
   const req=route.request(), url=new URL(req.url());
   if(url.origin!==origin || url.pathname.startsWith('/ws')) return route.abort();
   if(!url.pathname.startsWith('/api/')) return route.continue();
   const b=req.headers().authorization==='Bearer B-token';
   const person={id:b?2:1,fullName:b?'Account Bravo':'Account Alpha',username:b?'bravo':'alpha',role:'FAN',dob:'1990-01-01',profileComplete:true,onboardingRequired:false,emailVerified:true};
   let body=[],status=200;
   if(url.pathname==='/api/auth/csrf')body={headerName:'X-XSRF-TOKEN',token:'synthetic'};
   else if(url.pathname.startsWith('/api/auth/')) {status=401;body={};}
   else if(url.pathname==='/api/users/me')body=person;
   else if(url.pathname==='/api/clubs/my-membership-context')body={hasClubMembership:false,canCreateClub:false};
   else if(url.pathname.startsWith('/api/posts/feed/'))body={posts:[],nextCursor:null};
   else if(url.pathname==='/api/posts' && req.method()==='POST'){writes.push({authorization:req.headers().authorization,body:req.postDataJSON()});body={id:1};}
   else if(url.pathname.includes('notifications') || url.pathname.includes('conversations'))body={content:[],totalElements:0};
   return route.fulfill({status,json:body});
 });
 const first=await context.newPage(); first.on('pageerror',e=>errors.push(e.message));
 await first.goto(origin+'/login');
 await expect(first.getByRole('textbox',{name:/email/i}).first()).toBeVisible({timeout:15000});
 await first.evaluate(async()=>{const a=await import('/src/utils/authStorage.ts');a.setStoredUserId(1);a.setStoredAccessToken('A-token');});
 await first.goto(origin+'/home');
 await expect(first.getByRole('textbox',{name:'Create a post'})).toHaveAttribute('placeholder','What do you want to share, Account?');
 await expect(first.getByText('Account Alpha',{exact:true}).first()).toBeVisible();
 const second=await context.newPage(); await second.goto(origin+'/home');
 await second.evaluate(async()=>{const a=await import('/src/utils/authStorage.ts');a.clearStoredAuth();a.setStoredUserId(2);a.setStoredAccessToken('B-token');});
 await second.reload(); await expect(second.getByText('Account Bravo',{exact:true}).first()).toBeVisible();
 await expect.poll(()=>first.evaluate(()=>localStorage.getItem('accessToken'))).toBe('B-token');
 await expect(first.getByText('Account Alpha',{exact:true}).first()).toBeVisible();
 await first.getByRole('textbox',{name:'Create a post'}).fill('Typed from the tab still displaying Account Alpha');
 await first.screenshot({path:output+'/stale-alpha-shell.png',fullPage:true});
 await first.getByRole('button',{name:'Publish post'}).click();
 await expect.poll(()=>writes.length).toBe(1);
 expect(writes[0].authorization).toBe('Bearer B-token');
 expect(errors).toEqual([]);
 await writeFile(output+'/results.json',JSON.stringify({diagnosticAssertsBug:true,fullApp:true,twoTabsSameContext:true,displayedAccount:'Alpha',actualRequestAccount:'Bravo',writes,errors},null,2));
 console.log('REPRODUCED: full App still displays Alpha while the post is sent with Bravo credentials.');
} catch(error) {
 for(const context of browser.contexts()) for(const page of context.pages()) console.error('DIAGNOSTIC PAGE',page.url(),await page.locator('body').innerText());
 console.error('PAGE ERRORS',errors); throw error;
} finally {await browser.close();await server.close();}
