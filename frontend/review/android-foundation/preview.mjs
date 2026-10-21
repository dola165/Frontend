import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'vite';
import {chromium,expect} from '@playwright/test';

const backendRoot='C:/Users/daddo/IdeaProjects/GrassKickZ';
const fixturePath=path.join(backendRoot,'build/android-foundation-fixture/fixture.json');
const fixture=JSON.parse(await readFile(fixturePath,'utf8'));
const output=path.join(backendRoot,'outputs/android-foundation');
await mkdir(output,{recursive:true});
const root=process.cwd();
const server=await createServer({root,configFile:path.join(root,'vite.config.ts'),
  define:{'import.meta.env.VITE_API_BASE_URL':JSON.stringify(fixture.backend+'/api'),'import.meta.env.VITE_ENABLE_MOCKS':'"false"'},
  server:{host:'127.0.0.1',port:5187,strictPort:true,hmr:false}});
await server.listen();
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'dark'});
const page=await context.newPage();
page.setDefaultTimeout(30000);
const results={backend:fixture.backend,synthetic:true,consoleErrors:[]};
page.on('pageerror', e=>results.consoleErrors.push(e.message));
try {
  await page.goto('http://127.0.0.1:5187/login');
  await page.locator('#auth-login-email').fill(fixture.authorEmail);
  await page.locator('#auth-login-password').fill(fixture.password);
  await page.locator('button[type="submit"]').click();
  await expect(page.getByLabel('Create a post',{exact:true})).toBeVisible({timeout:60000});
  let text='Android preview: training together this Saturday. Bring your boots and meet us at the pitch.';
  let postId;
  if (process.argv.includes('--read-back')) {
    ({postId,text}=JSON.parse(await readFile(path.join(backendRoot,'build/android-foundation-fixture/web-ready.json'),'utf8')));
    results.previouslyWebCreatedPost=postId;
  } else {
    await page.getByLabel('Create a post',{exact:true}).fill(text);
    const created=page.waitForResponse(r=>r.url().endsWith('/api/posts')&&r.request().method()==='POST');
    await page.getByRole('button',{name:'Publish post',exact:true}).click();
    const response=await created; expect(response.status()).toBe(201);
    postId=(await response.json()).postId;
    results.webPostCreated=postId;
  }
  await page.goto('http://127.0.0.1:5187/posts/'+postId);
  await expect(page.getByText(text,{exact:true})).toBeVisible();
  await page.screenshot({path:path.join(output,'web-post-before-comment.png'),fullPage:true});
  await writeFile(path.join(backendRoot,'build/android-foundation-fixture/web-ready.json'),JSON.stringify({postId,text}));
  console.log('Web created post '+postId+'. Waiting for Android comment.');
  const deadline=Date.now()+2*60*60*1000;
  let command;
  while(Date.now()<deadline) {
    try {command=JSON.parse(await readFile(path.join(backendRoot,'build/android-foundation-fixture/web-check.json'),'utf8'));break;} catch {}
    await new Promise(r=>setTimeout(r,1000));
  }
  if(!command) throw Error('Android verification timed out');
  await page.reload();
  if (!await page.getByText(command.comment,{exact:true}).isVisible()) {
    await page.getByRole('button',{name:'Comment',exact:true}).click();
  }
  await expect(page.getByText(command.comment,{exact:true})).toBeVisible();
  await page.screenshot({path:path.join(output,'web-comment-confirmed.png'),fullPage:true});
  results.androidCommentVisible=command.comment;
  results.passed=true;
  await writeFile(path.join(output,'web-verification.json'),JSON.stringify(results,null,2));
  console.log('Web refresh displays the comment saved by Android.');
  while(Date.now()<deadline) {
    try { await readFile(path.join(backendRoot,'build/android-foundation-fixture/stop-web'));break;} catch {}
    await new Promise(r=>setTimeout(r,1000));
  }
} catch(e) {
  results.error=String(e);await writeFile(path.join(output,'web-verification.json'),JSON.stringify(results,null,2));
  await page.screenshot({path:path.join(output,'web-error.png'),fullPage:true});throw e;
} finally {await context.close();await browser.close();await server.close();}
