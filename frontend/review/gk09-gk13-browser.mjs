import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';

const fixture=JSON.parse(await readFile(process.argv[2],'utf8'));
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.resolve(path.dirname(process.argv[2]),'gk09-gk13-browser');
await mkdir(output,{recursive:true});
const server=await createServer({root,configFile:path.join(root,'vite.config.ts'),
    define:{'import.meta.env.VITE_API_BASE_URL':JSON.stringify(fixture.backend+'/api'),'import.meta.env.VITE_ENABLE_MOCKS':'"false"'},
    server:{host:'127.0.0.1',port:5177,strictPort:true,hmr:false}});
await server.listen();
const browser=await chromium.launch({headless:true});
try {
    const contexts=await Promise.all([browser.newContext(),browser.newContext()]);
    contexts.forEach(context=>context.setDefaultTimeout(12000));
    for(let i=0;i<2;i++) {
        const account=i===0?fixture.first:fixture.second;
        await contexts[i].addInitScript(account=>{
            localStorage.setItem('accessToken',account.token);localStorage.setItem('userId',String(account.id));
            localStorage.setItem('user',JSON.stringify({id:account.id,fullName:'Review User '+account.id,userType:'PLAYER'}));
            window.__reviewSockets=[];
            const Native=window.WebSocket;
            window.WebSocket=class extends Native {constructor(...args){super(...args);if(this.url.includes('/ws-chat'))window.__reviewSockets.push(this);}};
        },account);
    }
    const pages=await Promise.all(contexts.map(context=>context.newPage()));
    for(const page of pages) page.on('pageerror',error=>console.log('PAGE ERROR:',error.message));
    const url='http://127.0.0.1:5177/review/gk09-gk13.html?conversationId='+fixture.conversation;
    await Promise.all(pages.map(page=>page.goto(url)));
    for(const page of pages) await expect(page.getByText('Live updates connected',{exact:true})).toBeVisible({timeout:25000});
    const send=async text=>{await pages[0].getByPlaceholder('Type a message...').fill(text);await pages[0].getByRole('button',{name:'Send message',exact:true}).click();await expect(pages[0].getByPlaceholder('Type a message...')).toHaveValue('');};
    await send('GK review live delivery');
    await expect(pages[1].getByRole('log').getByText('GK review live delivery',{exact:true})).toBeVisible({timeout:10000});
    console.log('PASS: two separate authenticated Chromium sessions receive a live message from real PostgreSQL + broker');
    await contexts[1].setOffline(true);
    await pages[1].evaluate(()=>window.__reviewSockets.forEach(socket=>socket.close()));
    await expect(pages[1].getByText('Reconnecting live updates',{exact:true})).toBeVisible();
    await send('GK review offline recovery');
    await expect(pages[1].getByRole('log').getByText('GK review offline recovery',{exact:true})).toHaveCount(0);
    await contexts[1].setOffline(false);
    await expect(pages[1].getByText('Live updates connected',{exact:true})).toBeVisible({timeout:20000});
    await expect(pages[1].getByRole('log').getByText('GK review offline recovery',{exact:true})).toHaveCount(1,{timeout:20000});
    console.log('PASS: offline recipient reconnects, resubscribes, and recovers missed accepted message exactly once in the UI');
    await send('GK review post-reconnect live');
    await expect(pages[1].getByRole('log').getByText('GK review post-reconnect live',{exact:true})).toBeVisible({timeout:10000});
    console.log('PASS: live delivery continues after reconnect');
    await pages[1].screenshot({path:path.join(output,'recipient-after-reconnect.png'),fullPage:true});
    // Open the real quick-chat component, minimize it, and check its read behavior.
    await pages[1].goto(url+'&quick=1');
    await pages[1].getByRole('button',{name:new RegExp('Review User '+fixture.first.id)}).click();
    await expect(pages[1].getByPlaceholder('Write a message...')).toBeVisible();
    await pages[1].getByRole('button',{name:'Minimize chat',exact:true}).click();
    await expect(pages[1].getByPlaceholder('Write a message...')).toHaveCount(0);
    await send('GK review minimized unread');
    const unread=async()=>{
        const res=await contexts[1].request.get(fixture.backend+'/api/chat/conversations',{headers:{Authorization:'Bearer '+fixture.second.token}});
        const body=await res.json();return body.content.find(item=>item.id===fixture.conversation).unreadCount;
    };
    await expect.poll(unread).toBeGreaterThan(0);
    await pages[1].evaluate(()=>window.dispatchEvent(new Event('focus')));
    await expect.poll(unread).toBe(0);
    await expect(pages[1].getByText('GK review minimized unread',{exact:true})).toHaveCount(0);
    console.log('REPRO R3: minimized quick chat marks a new message read on focus without displaying its message area');
    await pages[1].screenshot({path:path.join(output,'minimized-chat-after-read.png'),fullPage:true});
} finally {await browser.close();await server.close();}
