import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const server = await createServer({root,configFile:path.join(root,'vite.config.ts'),define:{'import.meta.env.VITE_API_BASE_URL':'"/api"'},server:{host:'127.0.0.1',port:0,hmr:false}});
await server.listen();
const browser = await chromium.launch({headless:true});
try {
    const page = await browser.newPage({viewport:{width:1280,height:720}});
    const requests = [];
    await page.route('**/uploads/*', async route => {
        requests.push(new URL(route.request().url()).pathname);
        await route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l8sAAAAASUVORK5CYII=','base64')});
    });
    await page.goto(server.resolvedUrls.local[0]+'review/gk18-gk21/lazy-media.html');
    await expect(page.getByAltText('Protected lazy image 1', {exact:true})).toBeAttached();
    await page.waitForTimeout(500);
    expect(requests).toEqual([]);
    const top = await page.getByAltText('Protected lazy image 1', {exact:true}).evaluate(img => img.getBoundingClientRect().top);
    expect(top).toBeGreaterThan(20000);
    expect(requests).not.toContain('/uploads/native.jpg');
    await page.getByAltText('Protected lazy image 1', {exact:true}).scrollIntoViewIfNeeded();
    await expect.poll(() => requests.filter(p=>p.includes('protected-')).length).toBe(4);
    await expect.poll(() => page.getByAltText('Protected lazy image 1', {exact:true}).evaluate(img=>img.naturalWidth)).toBeGreaterThan(0);
    console.log(JSON.stringify({imageTopBeforeScroll:top,requestsBeforeScrolling:[],requestsAfterScrolling:requests,decoded:true},null,2));
} finally {await browser.close();await server.close();}
