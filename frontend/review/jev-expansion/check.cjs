const { chromium } = require('@playwright/test');
const fs = require('node:fs/promises');
(async () => {
    const browser = await chromium.launch({headless:true});
    const proof = [];
    try {
        for (const width of [1280,375]) {
            const page = await browser.newPage({viewport:{width,height:1000}});
            let paid = 0; const errors=[];
            page.on('pageerror',error=>errors.push(error.message));
            await page.route('**/api/**', async route => {
                const path=new URL(route.request().url()).pathname;
                if (!path.startsWith('/api/')) return route.continue();
                let data={};
                if(path.endsWith('/admin/content-reports'))data=[{id:4,postId:10,content:'Reported public post for human review.',reason:'SPAM',status:'OPEN',createdAt:'2026-09-22'}];
                else if(path.endsWith('/auth/csrf'))data={headerName:'X-XSRF-TOKEN',token:'offline'};
                else if(path.includes('/jev/')||path.endsWith('/triage')) {
                    paid++;
                    data={outcome:'classified',suggestions:path.endsWith('/career')?{kind:'QUALIFICATION'}:path.endsWith('/triage')?{category:'SPAM',priority:'NORMAL'}:{category:'COACHING',engagement:'CONTRADICTION',requirements:'CLEAR'}};
                }
                await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
            });
            await page.goto('http://127.0.0.1:5204/review/jev-expansion/index.html');
            await page.getByText('Reported public post for human review.').waitFor();
            if(paid!==0)throw new Error('AI called during loading');
            await page.getByRole('button',{name:'Check this listing',exact:true}).click();
            await page.getByText('The description may conflict with the selected paid or volunteer terms.').waitFor();
            await page.getByRole('button',{name:'Suggest entry type',exact:true}).click();
            await page.getByText('Suggested category: Qualification', {exact:true}).waitFor();
            await page.getByRole('button',{name:'Suggest review priority',exact:true}).click();
            await page.getByText('Standard human review',{exact:true}).waitFor();
            await page.getByRole('button',{name:'Report post',exact:true}).click();
            if(paid!==3)throw new Error('Unexpected AI request count '+paid);
            const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
            if(overflow||errors.length)throw new Error(JSON.stringify({overflow,errors}));
            await page.screenshot({path:`review/jev-expansion/${width}.png`,fullPage:true});
            proof.push({width,requestsOnLoad:0,explicitMockRequests:paid,overflow,errors});
            await page.close();
        }
        await fs.writeFile('review/jev-expansion/proof.json',JSON.stringify(proof,null,2));
        console.log(JSON.stringify(proof));
    } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
