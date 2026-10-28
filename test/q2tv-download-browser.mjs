// Manual integration fixture: a real loopback Q2PRO server offers a map which
// is absent from both preloads. Test each native engine with HTTP off/200/404.
import assert from 'node:assert/strict';import {chromium} from 'playwright';import {writeFile} from 'node:fs/promises';
const root='O:/Claude2/_agent_temp/botstats_online_20261028',results=[];
const browser=await chromium.launch({headless:true,args:['--mute-audio','--enable-unsafe-swiftshader']});
const metrics=async()=>await(await fetch('http://127.0.0.1:39031/metrics')).json();
try{
  for(const variant of (process.env.Q2TV_VARIANTS||'desktop,mobile').split(','))for(const mode of (process.env.Q2TV_CASES||'http,fail,udp').split(',')){
    const context=await browser.newContext({viewport:{width:1200,height:800}}),page=await context.newPage(),before=await metrics(),errors=[];let frames=0;
    page.on('pageerror',e=>{errors.push(e.message);console.log(variant,mode,'ERROR',e.message);});page.on('websocket',ws=>ws.on('framereceived',()=>frames++));
    const start=Date.now();await page.goto(`http://127.0.0.1:39031/${variant==='mobile'?'q2tv-mobile':'q2tv'}/?server=127.0.0.1:27916&case=${mode}`);
    let text='';
    for(let n=0;n<18;n++){
      await page.waitForTimeout(5000);text=await page.evaluate(()=>document.querySelector('#output')?.value||document.body.innerText);
      console.log(variant,mode,'seconds',Math.round((Date.now()-start)/1000),'packets',frames);
      if(errors.length||(/q2tv_download_test/.test(text)&&(/Begin rendering|Map:|Entering|Changed map|Sound registration|Registering sounds/.test(text))))break;
      if(frames>120)break;
    }
    await page.waitForTimeout(2000);const after=await metrics();
    await writeFile(root+`/download-${variant}-${mode}.log`,text);
    await page.screenshot({path:root+`/download-${variant}-${mode}.png`});
    assert.deepEqual(errors,[]);assert.ok(frames>20,'native game connection');
    assert.equal(after.connectRate.at(-1),'250000');
    if(mode==='http'){assert.ok(after.httpSuccess-before.httpSuccess>=3,'map and two missing textures transferred through HTTP');assert.equal(after.maxHTTP,2,'two simultaneous HTTP resource requests');assert.equal(after.udpMapRequests,before.udpMapRequests,'map did not fall back to UDP');}
    else {assert.ok(after.udpMapRequests>before.udpMapRequests,'same missing map requested through native UDP');if(mode==='udp')assert.equal(after.http,before.http);else assert.ok(after.http>before.http,'HTTP attempted before fallback');}
    assert.equal(after.blocked.length,before.blocked.length,'native loading commands not blocked');
    results.push({variant,mode,seconds:(Date.now()-start)/1000,frames,http:after.http-before.http,udpMapRequests:after.udpMapRequests-before.udpMapRequests,rate:after.connectRate.at(-1)});
    await context.close();
  }
}finally{await browser.close();await writeFile(root+'/download-results.json',JSON.stringify(results,null,2));}
console.log(JSON.stringify(results,null,2));
