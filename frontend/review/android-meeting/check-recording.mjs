import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from '@playwright/test';
const file=path.resolve(process.argv[2]); const info=await stat(file);
const server=createServer((req,res)=>{
  if(req.url==='/clip.mp4') {
    const match=/bytes=(\d+)-(\d*)/.exec(req.headers.range||'');
    const start=match?Number(match[1]):0,end=match&&match[2]?Number(match[2]):info.size-1;
    res.writeHead(match?206:200,{'Content-Type':'video/mp4','Accept-Ranges':'bytes','Content-Length':end-start+1,...(match?{'Content-Range':`bytes ${start}-${end}/${info.size}`}:{})});
    createReadStream(file,{start,end}).pipe(res);
  }else {res.writeHead(200,{'Content-Type':'text/html'});res.end('<body style="margin:0;background:#101216"><video src="/clip.mp4" muted controls style="height:900px"></video>');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  const page=await browser.newPage({viewport:{width:600,height:920}});
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(()=>{const v=document.querySelector('video');return v.readyState>=2&&Number.isFinite(v.duration);});
  const metadata=await page.locator('video').evaluate(v=>({duration:v.duration,width:v.videoWidth,height:v.videoHeight}));
  await page.locator('video').evaluate(v=>{v.controls=false;});
  for(const [label,fraction] of [['early',0.15],['middle',0.5],['late',0.85],['end',0.995]]) {
    await page.locator('video').evaluate((v,f)=>new Promise((resolve,reject)=>{v.onseeked=()=>resolve();v.onerror=()=>reject(Error('Video decode failed'));v.currentTime=v.duration*f;}),fraction);
    await page.waitForTimeout(300);
    await page.locator('video').screenshot({path:file+`.${label}.png`});
  }
  await writeFile(file+'.playback.json',JSON.stringify({...metadata,decodedSampleFrames:4,passed:true},null,2));
  console.log(metadata);
}finally{await browser.close();server.close();}
