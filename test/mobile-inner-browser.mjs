import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {testPath} from './support/paths.js';
const base=process.env.BOTSTATS_BASE_URL||'http://127.0.0.1:3085/botstats/';
const out=testPath('mobile-inner');await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:process.env.BOTSTATS_BROWSER_CHANNEL||'chrome'}),checks=[];
const ready=p=>p.locator('#content[aria-busy=false]').waitFor();
try{
 for(const [width,lang,theme] of [[320,'ru','light'],[390,'en','dark'],[440,'ru','judgment'],[768,'ru','light'],[1440,'ru','dark']]){
  const mobile=width<=800,p=await browser.newPage({viewport:{width,height:956},hasTouch:mobile}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  for(const view of ['players','bots']){
   await p.goto(base+`?view=${view}&lang=${lang}&theme=${theme}`);await ready(p);
   if(mobile){
    assert.equal(await p.locator('.mobile-filters').evaluate(e=>e.open),false);
    assert.equal(await p.locator('#filters button:visible').count(),0);
    const rows=p.locator('.compact-row');assert.ok(await rows.count()>3);
    const first=await rows.first().boundingBox();assert.ok(first.y<480,`${width} ${view}: first participant is visible without scrolling`);
    assert.ok(first.height<155,`${width} ${view}: dense rows`);
    assert.ok((await rows.nth(2).boundingBox()).y<800,'Three participants in the first screen');
    const id=view==='players'?'players':'rating_bots',select=p.locator(`[data-sort-select=${id}]`);
    await select.selectOption(view==='players'?'normalWins':'wins');await ready(p);
    assert.equal(new URL(p.url()).searchParams.get('sort_'+id),view==='players'?'normalWins':'wins');
    await p.locator(`[data-sort-table=${id}]`).click();await ready(p);
    assert.equal(new URL(p.url()).searchParams.get('dir_'+id),'asc');
    await p.reload();await ready(p);assert.equal(await select.inputValue(),view==='players'?'normalWins':'wins');
    await p.locator('.compact-row-details>summary').first().click();
    assert.ok(await p.locator('.compact-row-details[open] dl').isVisible());
    if(view==='players'){
     await p.locator('.mobile-filters>summary').click();await p.locator('.primary-filters>summary').click();
     await p.locator('#f-q').fill('pp');await p.waitForURL(/q=pp/);
     await p.waitForFunction(()=>document.querySelectorAll('.player-directory-name').length===1);
     assert.equal(await p.locator('.player-directory-name').textContent(),'pp');
     await p.locator('.compact-row-details>summary').click();
     assert.ok(await p.locator('.player-directory-last').isVisible());
     const match=new URL(await p.locator('.player-directory-last').getAttribute('href'),base).searchParams.get('match');
     await p.locator('.player-directory-last').click();await ready(p);assert.equal(new URL(p.url()).searchParams.get('match'),match);
    }
    await p.goto(base+`?view=${view}&lang=${lang}&theme=${theme}`);await ready(p);
   }else{
    assert.equal(await p.locator('.compact-row').count(),0);assert.ok(await p.locator('.data-table thead').isVisible());
   }
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await p.screenshot({path:`${out}/${view}-${width}.png`});checks.push({view,width,passed:true});
  }
  await p.goto(base+`?view=online&lang=${lang}&theme=${theme}`);await p.locator('.online-table').waitFor();
  if(mobile){
   assert.equal(await p.locator('#online-copy,.online-address').count(),0);
   assert.equal(await p.locator('#online-settings').evaluate(e=>e.open),false);
   const watch=await p.locator('#online-watch').boundingBox(),roster=await p.locator('.online-table').boundingBox();
   assert.ok(watch.y+watch.height<440);assert.ok(roster.y+roster.height<850,'Live roster and TV fit in the first screen');
   assert.equal(await p.locator('#online-refresh').isVisible(),false);
  }else assert.ok(await p.locator('#online-copy').isVisible());
  await p.screenshot({path:`${out}/online-${width}.png`});
  assert.deepEqual(errors,[]);checks.push({view:'online',width,passed:true});await p.close();
 }
 // Exercise live controls with changing snapshots; never connect a test browser to a game.
 const p=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile'}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 const snapshot=await(await fetch(base+'api/online')).json();assert.ok(snapshot.server);
 let requests=0,frames=0;
 await p.route('**/api/online',async route=>{
  const data=structuredClone(snapshot);requests++;
  data.state='online';data.checkedAt=new Date().toISOString();data.server.updatedAt=data.checkedAt;
  data.modes={state:'current',hardcore:requests===1?1:0,training:requests===1?0:1,checkedAt:data.checkedAt};
  await route.fulfill({json:data});
 });
 await p.route('**/*',async route=>{
  if(route.request().isNavigationRequest()&&route.request().frame()!==p.mainFrame()){
   frames++;await route.fulfill({contentType:'text/html',body:'<!doctype html><p>Q2TV test frame</p><script>parent.postMessage("q2tv-loaded",location.origin)</script>'});
  }else await route.fallback();
 });
 await p.goto(base+'?view=online&lang=ru');await p.locator('.online-table').waitFor();
 await p.locator('.online-options>summary').click();await p.locator('#online-refresh').selectOption('30');
 assert.equal(new URL(p.url()).searchParams.get('onlineRefresh'),'30');
 await p.locator('#online-settings>summary').click();await p.locator('#online-reload').click();
 await p.waitForFunction(()=>document.querySelector('[data-online-mode=training]').dataset.state==='on');
 assert.equal(await p.locator('#online-settings').evaluate(e=>e.open),true);
 assert.equal(await p.locator('[data-online-mode=hardcore]').getAttribute('data-state'),'off');
 await p.locator('#online-watch').click();await p.locator('#online-frame iframe').waitFor();
 assert.equal(new URL(p.url()).searchParams.get('tv'),'1');
 assert.equal(await p.locator('#online-frame iframe').getAttribute('src'),snapshot.players.mobile);
 await p.locator('#online-close').click();assert.equal(await p.locator('#online-frame iframe').count(),0);
 await p.locator('#online-variant').selectOption('desktop');await p.locator('#online-watch').click();
 assert.equal(await p.locator('#online-frame iframe').getAttribute('src'),snapshot.players.desktop);
 await p.locator('.tabs [data-view=players]').click();await ready(p);assert.equal(await p.locator('iframe').count(),0);
 assert.ok(frames>=2);assert.deepEqual(errors,[]);checks.push({onlineControls:true,iframeStub:true,passed:true});await p.close();
 await writeFile(out+'/results.json',JSON.stringify({passed:true,checks},null,2));console.log(JSON.stringify({passed:true,checks}));
}finally{await browser.close();}
