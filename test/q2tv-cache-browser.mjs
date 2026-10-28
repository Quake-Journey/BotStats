// Browser disk-cache contract, using the actual Tournament routes/loaders and
// small deterministic engine fixtures. Real engines are checked separately.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mkdir,writeFile,readFile,utimes} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import express from 'express';
import {chromium,firefox,webkit} from 'playwright';
const tournament=process.env.TOURNAMENT_ROOT||'O:/Claude2/Tournament';
const root=process.env.BOTSTATS_BROWSER_EVIDENCE||'O:/Claude2/_agent_temp/botstats_q2tv_cache_20261028';
await mkdir(root,{recursive:true});
const require=createRequire(tournament+'/package.json');
const {playerPage}=require('./q2tv/player-page.js'),{assetHeaders,assetInfo}=require('./q2tv/asset-manifest.js'),{createHTTPDownloads}=require('./q2tv/http-download.js');
const desktop=path.resolve(root+'/fixture-desktop'),mobile=path.resolve(root+'/fixture-mobile'),profileRoot=root+'/profiles/'+Date.now();
for(const [folder,stem] of [[desktop,'quake2'],[mobile,'index']]){
  await mkdir(folder,{recursive:true});
  await writeFile(folder+'/'+stem+'.data',Buffer.alloc(4*1024*1024,71));await writeFile(folder+'/'+stem+'.wasm',Buffer.alloc(16384,19));
  await writeFile(folder+'/'+stem+'.js',`window.fixtureReady=false;Promise.all(['${stem}.data','${stem}.wasm'].map(async n=>{const r=await fetch(Module.locateFile(n));if(!r.ok)throw Error('HTTP '+r.status);return (await r.arrayBuffer()).byteLength;})).then(s=>{Module.onRuntimeInitialized();window.fixtureReady=s;}).catch(e=>window.fixtureError=e.message);`);
  const loader=stem==='index'?'<script async src=index.js></script>':`<script>function loadQuake2JS(){var s=document.createElement('script');s.src='quake2.js';document.body.append(s);}loadQuake2JS();</script>`;
  await writeFile(folder+'/'+(stem==='index'?'index.html':'quake2.html'),'<html><head><title>Q2TV alpha 0.1</title></head><body><canvas id="canvas"></canvas><script>var Module={onRuntimeInitialized:()=>{}};</script>'+loader+'</body></html>');
}
const app=express(),counts={},results=[];let truncated=false;
app.use((req,res,next)=>{
  if(req.path.endsWith('.data')||req.path.endsWith('.wasm')||/\/(?:quake2|index)\.js$/.test(req.path))counts[req.path]=(counts[req.path]||0)+1;
  if(truncated&&req.path.endsWith('.data')){
    const file=(req.path.startsWith('/q2tv-mobile')?mobile:desktop)+'/'+path.basename(req.path);
    assetInfo(file).then(info=>{res.set({'X-Q2TV-Content-Hash':info.sha256,'Content-Length':info.size,'Content-Type':'application/octet-stream'});res.write(Buffer.alloc(2048));setTimeout(()=>res.destroy(),50);});return;
  }
  next();
});
const source=await readFile(tournament+'/site.js','utf8'),start=source.indexOf("  app.get(['/q2tv/http-file'"),end=source.indexOf('  // Главная',start);assert.ok(start>0&&end>start);
vm.runInNewContext(source.slice(start,end),{app,fs,path,playerPage,assetHeaders,q2tvDownloads:createHTTPDownloads(),__dirname:tournament,Q2TV_WEBROOT:desktop,Q2TV_MOBILE_WEBROOT:mobile,console});
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const origin='http://127.0.0.1:'+server.address().port;
const total=()=>Object.values(counts).reduce((a,b)=>a+b,0);
const init=({failure})=>{
  // Disable the ordinary HTTP cache as evidence that Cache Storage supplies
  // assets, including after a complete browser process restart.
  const native=window.fetch.bind(window);window.fetch=(url,options)=>native(url,{...options,cache:'no-store'});
  if(failure==='open')Object.defineProperty(window,'caches',{value:undefined});
  if(failure==='quota')Cache.prototype.put=()=>Promise.reject(new DOMException('Test quota','QuotaExceededError'));
};
let context,webkitBrowser;
try{
  for(const [name,type] of [['chromium',chromium],['firefox',firefox],['webkit',webkit]]){
    if(process.env.Q2TV_CACHE_BROWSER&&process.env.Q2TV_CACHE_BROWSER!==name)continue;
    console.log('Checking',name);
    const profile=profileRoot+'/'+name,options={headless:true,viewport:{width:1280,height:800},...(name==='chromium'?{args:['--mute-audio']}: {})};
    // Playwright's Windows WebKit persistent-profile port rejects even a
    // five-byte Cache.put. Exercise its functional Cache API in a regular
    // context; disk/process persistence is checked in Chromium and Firefox.
    async function launch(dir=profile,failure){if(name==='webkit'){webkitBrowser=await type.launch({headless:true});context=await webkitBrowser.newContext({viewport:options.viewport});}else context=await type.launchPersistentContext(dir,options);await context.addInitScript(init,{failure});}
    async function close(){await context.close();context=null;if(webkitBrowser){await webkitBrowser.close();webkitBrowser=null;}}
    async function run(route,expectFailure=false){
      const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.stack));await page.goto(origin+'/'+route+'/');
      await page.waitForFunction(()=>window.fixtureReady||window.fixtureError||window.q2tvCacheState?.error,{},{timeout:20000});
      const state=await page.evaluate(()=>({ready:window.fixtureReady,error:window.fixtureError||window.q2tvCacheState.error,cache:window.q2tvCacheState}));
      if(errors.length)console.log('Browser errors',route,JSON.stringify({state,errors}));
      if(expectFailure)assert.ok(state.error);else{assert.ok(state.ready,state.error);assert.deepEqual(errors,[]);}
      await page.close();return state;
    }
    if(name==='webkit'){
      await launch();
      for(const [route,stem] of [['q2tv','quake2'],['q2tv-mobile','index']]){
        const page=await context.newPage();await page.goto(origin+'/'+route+'/');await page.waitForFunction(()=>window.fixtureReady);
        const before=total();await page.evaluate(async stem=>{for(const ext of ['.js','.wasm','.data'])await(await fetch(Module.locateFile(stem+ext))).arrayBuffer();},stem);
        assert.equal(total(),before);assert.equal(await page.evaluate(()=>window.q2tvCacheState.hits),3);await page.close();
      }
      await close();
      for(const failure of ['open','quota']){await launch(profileRoot+'/'+name+'-'+failure,failure);const before=total();assert.equal((await run('q2tv')).cache.unavailable,true);assert.equal(total()-before,3);await close();}
      results.push({browser:name,sameDocumentCache:true,storageFailureNoRetry:true,afterBrowserRestart:null,limitation:'Playwright Windows WebKit clears Cache Storage on reload even for a five-byte standalone probe; disk persistence needs an Apple-device check.'});
      continue;
    }
    await launch();let before=total();
    const first=[];for(const route of ['q2tv','q2tv-mobile']){const v=await run(route);assert.equal(v.cache.downloads,3);assert.equal(v.cache.pendingWrites,0);first.push(v.cache);}
    assert.equal(total()-before,6);
    before=total();for(const route of ['q2tv','q2tv-mobile'])assert.equal((await run(route)).cache.hits,3);assert.equal(total(),before);
    if(name!=='webkit'){await close();await launch();before=total();for(const route of ['q2tv','q2tv-mobile'])assert.equal((await run(route)).cache.hits,3);assert.equal(total(),before);}
    // File timestamps and interface changes cannot invalidate a data content hash.
    await utimes(desktop+'/quake2.data',new Date(),new Date(Date.now()+3000));before=total();assert.equal((await run('q2tv')).cache.hits,3);assert.equal(total(),before);
    await writeFile(desktop+'/quake2.data',Buffer.alloc(4*1024*1024,name.length));before=total();const update=await run('q2tv');assert.equal(update.cache.downloads,1);assert.equal(update.cache.hits,2);assert.equal(total()-before,1);
    const check=await context.newPage();await check.goto(origin+'/q2tv/');await check.waitForFunction(()=>window.fixtureReady);
    const keys=await check.evaluate(async()=>[...(await(await caches.open('q2tv-assets-v1')).keys())].map(r=>r.url));assert.equal(keys.filter(k=>k.includes('/quake2.data?')).length,1);await check.close();
    await close();
    for(const failure of ['open','quota']){
      await launch(profileRoot+'/'+name+'-'+failure,failure);before=total();const value=await run('q2tv');assert.equal(value.cache.unavailable,true);assert.equal(total()-before,3,'storage failure must not download twice');await close();
    }
    await launch(profileRoot+'/'+name+'-truncated');truncated=true;await run('q2tv',true);truncated=false;before=total();const repaired=await run('q2tv');assert.equal(repaired.cache.files['quake2.data'],'network');assert.equal(total()-before,1);await close();
    results.push({browser:name,firstDownloadFiles:6,repeatDownloadFiles:0,afterBrowserRestart:name==='webkit'?null:0,changedDataOnly:1,storageFailureNoRetry:true,truncatedNotCached:true,first});
  }
  await writeFile(root+'/cache-browser-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{if(context)await context.close();if(webkitBrowser)await webkitBrowser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
