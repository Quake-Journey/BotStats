// Explicitly authorized OpenFFA/OpenTDM-X viewer checks. No join commands are
// sent here: detect any server-assigned player state and verify auto-spectate.
import assert from 'node:assert/strict';import {chromium} from 'playwright';import {writeFile} from 'node:fs/promises';
const root='O:/Claude2/_agent_temp/botstats_online_20261028',results=[];
const browser=await chromium.launch({headless:true,args:['--mute-audio','--enable-unsafe-swiftshader']});
try{
  for(const target of (process.env.Q2TV_TARGETS||'q2.playground.ru:27910,91.227.18.67:27950').split(','))for(const variant of (process.env.Q2TV_VARIANTS||'desktop,mobile').split(',')){
    const context=await browser.newContext({viewport:{width:1100,height:780}}),page=await context.newPage(),errors=[],states=[];
    page.on('pageerror',e=>{errors.push(e.message);console.log('ERROR',e.message);});
    await page.goto(`http://127.0.0.1:39031/${variant==='mobile'?'q2tv-mobile':'q2tv'}/?server=${encodeURIComponent(target)}`);
    let consecutive=0;
    for(let n=0;n<90;n++){
      await page.waitForTimeout(1000);const state=await page.evaluate(()=>window.q2tvViewerState);states.push(state);
      if(state?.status===2)consecutive++;else consecutive=0;
      if(n%5===0)console.log(target,variant,n,state);
      if(errors.length||consecutive>=12)break;
    }
    const safe=target.replace(/[^a-z0-9]/g,'_');
    await page.screenshot({path:root+`/spectator-${safe}-${variant}.png`});
    await writeFile(root+`/spectator-${safe}-${variant}.log`,await page.evaluate(()=>document.querySelector('#output')?.value||document.body.innerText));
    assert.deepEqual(errors,[]);assert.ok(consecutive>=12,'spectator stays spectator, no return to playing');
    results.push({target,variant,autoExits:states.at(-1)?.autoExits,stableSpectatorSeconds:consecutive,states});await context.close();
  }
}finally{await browser.close();await writeFile(root+'/spectator-results.json',JSON.stringify(results,null,2));}
console.log(JSON.stringify(results.map(({states,...result})=>result),null,2));
