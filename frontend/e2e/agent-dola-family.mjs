import { preview } from 'vite';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const output = 'review/agent-dola-family'; await mkdir(output, { recursive: true });
const vite = await preview({ build: { outDir: 'dist/agent-dola-family' }, preview: { host: '127.0.0.1', port: 5196, strictPort: true } });
const browser = await chromium.launch({ channel: 'chrome', headless: true }); const evidence = [];
try {
    for (const [name, width, height, dual] of [['parent',1440,1000,false], ['parent-coach',1440,1000,true], ['mobile-parent',390,844,false]]) {
        const page = await browser.newPage({ viewport: { width, height } }); const errors = []; let writes = 0, questions = 0;
        page.on('pageerror', e => errors.push(e.message));
        await page.addInitScript(() => {
            localStorage.setItem('gk-session-id','family-test');
            localStorage.setItem('gk-session-token:family-test',`e30.${btoa(JSON.stringify({ sub:'999999',exp:4102444800 }))}.synthetic`);
            localStorage.setItem('i18nextLng','en'); localStorage.setItem('theme-preference','dark');
        });
        await page.routeWebSocket('**', s => s.close());
        await page.route('**/api/**', async route => {
            const url = new URL(route.request().url()); let json = [];
            if (url.pathname.endsWith('/users/me')) json = { id:999999, username:'synthetic', fullName:'Family Tester', role:'PARENT', dob:'1990-01-01',emailVerified:true,profileComplete:true,onboardingRequired:false,navigationCapabilities:{version:1,workspaces:[{id:'parent.hub',context:{type:'user',id:999999,label:'Family'}},...(dual?[{id:'club.workspace',context:{type:'club',id:7,label:'Academy'}}]:[])]} };
            else if (url.pathname.endsWith('/auth/csrf')) json={headerName:'X-XSRF-TOKEN',token:'synthetic'};
            else if (url.pathname.endsWith('/assistant/dola/status')) json={available:true,mode:'REVIEWED_ACTIONS_PILOT',capabilities:[]};
            else if (url.pathname.endsWith('/assistant/dola/conversations/latest')) return route.fulfill({status:204});
            else if (url.pathname.endsWith('/assistant/dola/messages/stream')) {
                questions++;
                const request=route.request().postDataJSON();
                const action={id:'68173ac8-86a7-418a-a496-1e3c98b37e55',kind:'OPEN_CHALLENGE',state:'PENDING',title:'U12 Mixed friendly',body:'Organizer reports own referee: Tamar Beridze. This is not a GrassKickZ appointment or acceptance.',details:[{label:'Squad',value:'FC Dinamo Tbilisi Academy · U12 Mixed'},{label:'Starts',value:'2026-09-23T14:30:00'},{label:'Playing level',value:'DEVELOPMENT — Suggested starting point; squad level is not recorded'},{label:'Format',value:'11_A_SIDE'},{label:'Hosting / travelling',value:'We host — Suggested for your review'}],confirmLabel:'Publish open challenge',expiresAt:new Date(Date.now()+600000).toISOString(),receipt:''};
                const answer={conversationId:'f54a54bd-bd7c-48eb-a248-f3874ba0a2b1',requestId:request.requestId,answer:'Here is your challenge with suggested preferences. Review it before publishing.',actions:[action],destinations:[],sources:[],toolsUsed:['prepare_open_challenge'],modelCalls:2,totalTokens:100};
                return route.fulfill({contentType:'application/x-ndjson',body:[{type:'ready'},{type:'complete',answer}].map(x=>JSON.stringify(x)).join('\n')+'\n'});
            } else if (url.pathname.includes('/actions/')) {writes++;return route.fulfill({status:500});}
            else if(url.pathname.includes('membership-context')) json={hasClubMembership:false,canCreateClub:false};
            else if(url.pathname.includes('unread')) json={count:0,unreadCount:0};
            else if(url.pathname.includes('/feed')||url.pathname.includes('notifications')) json={content:[],totalElements:0,last:true};
            await route.fulfill({json});
        });
        await page.goto('http://127.0.0.1:5196/assistant');
        await expect(page.getByRole('button',{name:'What needs my attention for my children?'})).toBeVisible();
        await expect(page.getByRole('button',{name:'Help me write a coach update.'})).toHaveCount(dual?1:0);
        await page.getByRole('button',{name:'What needs my attention for my children?'}).click();
        expect(questions).toBe(0);await expect(page.getByLabel('Message Agent Dola')).toHaveValue('What needs my attention for my children?');
        if(dual) {
            await page.getByLabel('Message Agent Dola').fill('Create an open challenge for U12 Mixed.');
            await page.getByRole('button',{name:'Send message'}).click();
            await expect(page.getByText('Confirming also approves the suggested choices shown above. Use Edit details to change any of them.')).toBeVisible();
            await expect(page.locator('.dola-action-suggestion')).toHaveCount(2);
            await page.getByRole('button',{name:'Edit details'}).click();
            await expect(page.getByLabel('Message Agent Dola')).toHaveValue('Revise this draft: ');
            expect(questions).toBe(1);expect(writes).toBe(0);
        }
        expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
        await page.screenshot({path:`${output}/${name}.png`,fullPage:true});expect(errors).toEqual([]);
        evidence.push({name,parentStarter:true,dualRoleCorrect:true,suggestionsVisible:dual,editDoesNotExecute:dual,noOverflow:true,errors});await page.close();
    }
    await writeFile(`${output}/evidence.json`,JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
} finally {await browser.close();await new Promise(resolve=>vite.httpServer.close(resolve));}
