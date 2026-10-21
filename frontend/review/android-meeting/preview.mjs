import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'vite';
import {chromium,expect} from '@playwright/test';
const backendRoot=process.env.GRASSKICKZ_BACKEND || 'C:/Users/daddo/IdeaProjects/GrassKickZ';
const control=path.join(backendRoot,'build/android-meeting-fixture');
const output=process.env.ANDROID_EVIDENCE_DIR || path.join(backendRoot,'outputs/android-meeting');
const fixture=JSON.parse(await readFile(path.join(control,'fixture.json'),'utf8'));
await mkdir(output,{recursive:true});
const server=await createServer({root:process.cwd(),configFile:path.resolve('vite.config.ts'),
  define:{'import.meta.env.VITE_API_BASE_URL':JSON.stringify(fixture.backend+'/api'),'import.meta.env.VITE_ENABLE_MOCKS':'"false"'},
  server:{host:'127.0.0.1',port:5187,strictPort:true,hmr:false}});
await server.listen();
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'dark',timezoneId:'Asia/Tbilisi'});
const page=await context.newPage(); page.setDefaultTimeout(30000);
const results={synthetic:true,pageErrors:[],runs:[]};
page.on('pageerror',e=>results.pageErrors.push(e.message));
async function waitFile(name) {
  const deadline=Date.now()+2*60*60*1000;
  while(Date.now()<deadline) {try{return await readFile(path.join(control,name),'utf8');}catch{} await new Promise(r=>setTimeout(r,500));}
  throw Error('Timed out waiting for '+name);
}
try {
  await page.goto('http://127.0.0.1:5187/login');
  await page.locator('#auth-login-email').fill(fixture.ownerEmail);
  await page.locator('#auth-login-password').fill(fixture.password);
  await page.locator('button[type="submit"]').click();
  await expect(page.getByLabel('Create a post',{exact:true})).toBeVisible({timeout:60000});
  for(let run=1;run<=2;run++) {
    await page.goto(`http://127.0.0.1:5187/clubs/${fixture.clubId}`);
    const text=`Training together tomorrow. Bring your boots. Rehearsal ${run}.`;
    await page.getByLabel('Create a club post',{exact:true}).fill(text);
    const creation=page.waitForResponse(r=>r.url().endsWith('/api/posts')&&r.request().method()==='POST');
    await page.getByRole('button',{name:'Publish post',exact:true}).click();
    const response=await creation; expect(response.status()).toBe(201);
    const {postId}=await response.json();
    const payload=response.request().postDataJSON(); expect(payload.clubId).toBe(fixture.clubId);
    await page.goto(`http://127.0.0.1:5187/posts/${postId}`);
    await expect(page.getByText(text,{exact:true})).toBeVisible();
    await writeFile(path.join(control,`ready-${run}.json`),JSON.stringify({run,postId,text}));
    console.log(`Rehearsal ${run}: real web club post ready.`);
    const comment=(await waitFile(`check-${run}`)).trim();
    await page.reload(); await page.getByRole('button',{name:'Comment',exact:true}).click();
    await expect(page.getByText(comment,{exact:true})).toHaveCount(1);
    await page.screenshot({path:path.join(output,`web-comment-run-${run}.png`),fullPage:true});
    results.runs.push({run,postId,clubId:payload.clubId,comment,webReadBack:true});
    await writeFile(path.join(output,'web-verification.json'),JSON.stringify(results,null,2));
    await writeFile(path.join(control,`confirmed-${run}`),'confirmed');
    if(run===1) await waitFile('next-run');
  }
  results.passed=results.pageErrors.length===0;
  await writeFile(path.join(output,'web-verification.json'),JSON.stringify(results,null,2));
  await waitFile('stop-web');
} catch(e) {
  results.error=String(e);await writeFile(path.join(output,'web-verification.json'),JSON.stringify(results,null,2));
  await page.screenshot({path:path.join(output,'web-error.png'),fullPage:true});throw e;
} finally {await context.close();await browser.close();await server.close();}
