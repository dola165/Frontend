import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'vite';
import {chromium,expect} from '@playwright/test';
const root='C:/Users/daddo/IdeaProjects/GrassKickZ';
const control=path.join(root,'build/android-map-fixture');
const out=path.join(root,'outputs/android-map');
const fixture=JSON.parse(await readFile(path.join(control,'fixture.json'),'utf8'));
await mkdir(out,{recursive:true});
const server=await createServer({root:process.cwd(),configFile:path.resolve('vite.config.ts'),
 define:{'import.meta.env.VITE_API_BASE_URL':JSON.stringify(fixture.backend+'/api'),'import.meta.env.VITE_ENABLE_MOCKS':'"false"'},
 server:{host:'127.0.0.1',port:5187,strictPort:true,hmr:false}});
await server.listen();
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 const response=page.waitForResponse(r=>r.url().includes('/api/map/nearby?')&&r.status()===200);
 await page.goto('http://127.0.0.1:5187/world');
 const clubs=await (await response).json();
 expect(clubs.content).toHaveLength(4);
 const list=page.getByRole('complementary',{name:'Nearby results'});
 if(!await list.isVisible()) await page.getByRole('button',{name:'Toggle nearby results'}).click();
 await expect(list.getByRole('listitem')).toHaveCount(4);
 await expect(list).toContainText('Tbilisi Community Football Club');
 await page.screenshot({path:path.join(out,'web-clubs.png')});
 const pool=await page.evaluate(async()=>{
   const {fetchMapDiscovery}=await import('/src/api/map.ts');
   return fetchMapDiscovery({lat:41.7151,lng:44.8271,radius:25,type:['CLUB','MATCH','TOURNAMENT']});
 });
 expect(pool.content).toHaveLength(6);
 expect(pool.content.some(x=>x.title==='Unlisted practice cup')).toBe(false);
 expect(errors).toEqual([]);
 await writeFile(path.join(out,'web-verification.json'),JSON.stringify({passed:true,actualWebClubList:4,allPublicResults:pool.content,hiddenUnlisted:true,pageErrors:errors},null,2));
 console.log('Web map verified: four clubs, six total public results. Server remains available for testing.');
}catch(e){
 await writeFile(path.join(out,'web-verification.json'),JSON.stringify({passed:false,error:String(e),pageErrors:errors},null,2));
 await page.screenshot({path:path.join(out,'web-error.png')});
 console.error(String(e));
}
await writeFile(path.join(control,'web-ready'),'ready');
const deadline=Date.now()+12*60*60*1000;
while(Date.now()<deadline){try{await access(path.join(control,'stop-web'));break;}catch{} await new Promise(r=>setTimeout(r,1000));}
await browser.close();await server.close();
