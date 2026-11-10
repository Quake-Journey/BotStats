import assert from 'node:assert/strict';
import {chromium,firefox,webkit} from 'playwright';
import express from 'express';
import {once} from 'node:events';
import {mkdir,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {MongoClient} from 'mongodb';
import {createService} from '../src/server.js';
import {testPath} from './support/paths.js';
import {game} from './support/achievement-fixtures.js';

const suffix=Date.now()+'_'+randomBytes(3).toString('hex'),database='q2pro_botstats_browser_'+suffix;
const evidence=process.env.BOTSTATS_BROWSER_EVIDENCE||testPath('servers-browser',suffix);await mkdir(evidence,{recursive:true});
const sources=[{id:'public',name:'Public arena · Q2PRO-X',address:'arena.example:27950',access:'public',transport:'report',q2tv:true,sourceToken:'browser-public-fixture-'.repeat(3)},
  {id:'minipc',name:'MINIPC · Локальный сервер / Local server',address:'10.10.1.51:27910',access:'lan',transport:'report',sourceToken:'browser-lan-fixture-'.repeat(3),staleSeconds:15}];
const upstream=express();upstream.get(['/q2tv/','/q2tv-mobile/'],(req,res)=>res.type('html').send('<html><head></head><body><p>Isolated Q2TV fixture</p><script>parent.postMessage("q2tv-loaded",location.origin)</script></body></html>'));
const remote=upstream.listen(0,'127.0.0.1');await once(remote,'listening');
const config={database,mongoUri:'mongodb://127.0.0.1:27017',ingestToken:'browser-legacy-fixture-'.repeat(3),storageDir:testPath('servers-browser-data',suffix),online:{servers:sources,tournamentOrigin:'http://127.0.0.1:'+remote.address().port}};
const {app,store,bindOnlineSockets}=await createService(config),server=app.listen(0,'127.0.0.1');await once(server,'listening');const close=bindOnlineSockets(server),base='http://127.0.0.1:'+server.address().port+'/botstats';
let lastStamp=Date.now()-20000;
async function report(id,{state='online',age=0,players}={}){
  const source=sources.find(s=>s.id===id),stamp=Date.now()-age;lastStamp=Math.max(lastStamp+1,stamp);
  const body={schemaVersion:1,serverId:id,observedAt:new Date(lastStamp).toISOString(),state,info:state==='online'?{mapname:id==='public'?'q2duel5':'omf',hostname:id+' actual server',gamename:'OpenTDM-X',otx_version:'Beta 14 Preview 2',maxclients:'16'}:{},players:state==='online'?[{name:id==='public'?'Public Human':'LAN Human',score:id==='public'?12:2,ping:9,spectator:false},{name:'David-X[200]',score:0,ping:0,spectator:false},{name:'Viewer',score:null,ping:11,spectator:true}]:[],modes:{hardcore:state==='online'?(id==='public'?1:0):null,training:state==='online'?(id==='public'?0:1):null}};
  if(players)body.players=players;
  const r=await fetch(base+'/api/ingest/status',{method:'POST',headers:{'x-botstats-server':id,'x-ingest-token':source.sourceToken,'content-type':'application/json'},body:JSON.stringify(body)});assert.ok(r.ok,await r.text());
}
async function reload(page){await page.locator('#online-reload').evaluate(el=>el.click());await page.waitForFunction(()=>!document.querySelector('#online-reload').disabled);}
async function geometry(page){return page.evaluate(()=>{
  const root=document.querySelector('.online-body'),elements=[...root.querySelectorAll('button,select,a')].filter(el=>el.getClientRects().length&&!el.closest('[hidden],details:not([open])'));
  const boxes=elements.map(el=>({id:el.id||el.textContent.trim(),...Object.fromEntries(['left','right','top','bottom','width','height'].map(k=>[k,el.getBoundingClientRect()[k]]))}));
  const outside=boxes.filter(r=>r.left<-.5||r.right>innerWidth+.5),overlaps=[];
  for(const cell of root.querySelectorAll('.online-table td,.online-table th')){
    const bounds=cell.getBoundingClientRect(),walker=document.createTreeWalker(cell,NodeFilter.SHOW_TEXT);let node;
    while(node=walker.nextNode())if(node.textContent.trim()){
      const range=document.createRange();range.selectNodeContents(node);
      for(const rect of range.getClientRects())if(rect.width>0&&(rect.left<bounds.left-1.5||rect.right>bounds.right+1.5))outside.push({cell:cell.className,text:node.textContent.trim(),overflow:true});
    }
  }
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)overlaps.push([a.id,b.id]);}
  return {overflow:document.documentElement.scrollWidth>innerWidth,outside,overlaps};
});}
const results=[];
try{
  await report('public');
  const m=game(1,{human:'Browser source fixture',hs:2,bs:0,events:[]});m.id='f'.repeat(64)+'-0-0';
  await store.save({schemaVersion:1,parserVersion:'0.3.1',demo:{sha256:'f'.repeat(64),size:6,originalName:'fixture.mvd2',recordedAt:null,dateSource:null},matches:[m],source:{id:'minipc',name:sources[1].name,address:sources[1].address,access:'lan'}});
  for(const [name,type,widths] of [['chromium',chromium,[320,800,801,1024,1101,1440]],['firefox',firefox,[320,1440]],['webkit',webkit,[320,1440]]]){
    const browser=await type.launch({headless:true});
    try{
      for(const width of widths)for(const lang of ['ru','en']){
        await report('public');
        const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
        await page.goto(base+'/?view=online&onlineRefresh=0&lang='+lang);await page.waitForSelector('.online-name');
        assert.equal(await page.locator('#online-server-select option').count(),2);
        assert.match(await page.locator('.online-name').first().innerText(),/Public Human/);
        assert.equal(await page.locator('[data-online-mode=hardcore]').getAttribute('data-state'),'on');
        assert.deepEqual(await geometry(page),{overflow:false,outside:[],overlaps:[]});
        if(await page.locator('.online-options').count()){await page.locator('.online-options summary').click();assert.deepEqual(await geometry(page),{overflow:false,outside:[],overlaps:[]});}
        await page.locator('#online-refresh').selectOption('30');assert.ok(page.url().includes('onlineRefresh=30'));await page.locator('#online-refresh').selectOption('0');
        await page.locator('[data-online-sort=name]').click();assert.ok(page.url().includes('sort_online=name'));
        await page.locator('[data-online-sort=score]').click();assert.ok(page.url().includes('sort_online=score'));
        if(await page.locator('.online-options').count())await page.locator('.online-options summary').click();
        await page.locator('#online-watch').click();await page.waitForSelector('#online-frame iframe');
        assert.match(await page.locator('#online-frame iframe').getAttribute('src'),/\/servers\/public\//);
        await page.locator('#online-server-select').selectOption('minipc');await page.waitForFunction(()=>!document.querySelector('#online-reload').disabled);
        assert.equal(await page.locator('#online-frame iframe').count(),0);assert.ok(await page.locator('#online-watch').isDisabled());
        assert.equal(await page.locator('#online-copy').count(),0);assert.equal(await page.locator('.online-address a').count(),0);
        assert.ok(page.url().includes('onlineServer=minipc'));assert.ok(!page.url().includes('tv=1'));
        await report('minipc');await reload(page);await page.waitForSelector('.online-name');
        assert.match(await page.locator('.online-name').first().innerText(),/LAN Human/);
        assert.equal(await page.locator('[data-online-mode=hardcore]').getAttribute('data-state'),'off');
        assert.equal(await page.locator('.online-delta').count(),0);
        assert.ok((await page.locator('#online-server').innerText()).includes('10.10.1.51:27910'));
        assert.deepEqual(await geometry(page),{overflow:false,outside:[],overlaps:[]});
        if(name==='chromium'&&[320,1440].includes(width)){await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:evidence+`/servers-${width}-${lang}.png`,fullPage:true});}
        await page.reload();await page.waitForSelector('.online-name');assert.equal(await page.locator('#online-server-select').inputValue(),'minipc');
        const roleCases=[
          {players:[{name:'Zero-score player',score:0,ping:0,spectator:false},{name:'Viewer with stored score',score:19,ping:9,spectator:true},{name:'Role not supplied',score:7,ping:0}],counts:{player:1,spectator:1,unknown:1}},
          {players:[{name:'Only viewer',score:0,ping:8,spectator:true}],counts:{player:0,spectator:1,unknown:0}},
          {players:[{name:'Only player, zero score',score:0,ping:8,spectator:false}],counts:{player:1,spectator:0,unknown:0}},
          {players:[{name:'Unknown zero',score:0,ping:0},{name:'Unknown no score',score:null,ping:8,spectator:null}],counts:{player:0,spectator:0,unknown:2}}
        ];
        for(const [index,sample] of roleCases.entries()){
          await report('minipc',{players:sample.players});await reload(page);
          for(const [role,count] of Object.entries(sample.counts))assert.equal(await page.locator('[data-online-role='+role+']').count(),count);
          for(const [key,count] of [['players',sample.counts.player],['spectators',sample.counts.spectator],['unknown',sample.counts.unknown]]){
            const label=page.locator('[data-roster-count='+key+'] b');if(key==='unknown'&&!count)assert.equal(await label.count(),0);else assert.equal(await label.innerText(),String(count));
          }
          assert.match(await page.locator('[data-online-connections]').innerText(),lang==='ru'?/Подключено/:/Connected/);
          assert.equal(await page.locator('.online-delta').count(),0);
          assert.deepEqual(await geometry(page),{overflow:false,outside:[],overlaps:[]});
          if(index===0&&name==='chromium'&&[320,1440].includes(width))await page.screenshot({path:evidence+`/roles-${width}-${lang}.png`,fullPage:true});
        }
        await page.route('**/api/online/servers',route=>route.abort());await reload(page);
        assert.equal(await page.locator('#online-state').getAttribute('data-state'),'unavailable');
        assert.equal(await page.locator('[data-online-mode=hardcore]').getAttribute('data-state'),'unknown');
        await page.unroute('**/api/online/servers');await reload(page);
        await page.locator('#online-server-select').selectOption('public');await page.waitForSelector('.online-name');assert.match(await page.locator('.online-name').first().innerText(),/Public Human/);
        assert.equal(await page.locator('[data-roster-count=players] b').innerText(),'2');assert.equal(await page.locator('[data-roster-count=spectators] b').innerText(),'1');
        assert.deepEqual(errors,[]);results.push({browser:name,width,lang,geometry:'pass',selection:'pass',roleCases:4,networkFailure:'pass',errors});await page.close();
      }
      if(name==='chromium'){
        const page=await browser.newPage();await page.goto(base+'/?view=online&onlineServer=minipc&onlineRefresh=0&lang=en');await page.waitForSelector('.online-name');
        await report('minipc',{state:'offline'});await reload(page);assert.equal(await page.locator('#online-state').getAttribute('data-state'),'offline');assert.equal(await page.locator('.online-name').count(),0);
        await report('minipc');await reload(page);assert.equal(await page.locator('#online-state').getAttribute('data-state'),'online');
        await new Promise(r=>setTimeout(r,15100));await reload(page);assert.equal(await page.locator('#online-state').getAttribute('data-state'),'stale');assert.equal(await page.locator('[data-online-mode=hardcore]').getAttribute('data-state'),'unknown');
        await report('minipc');await reload(page);assert.equal(await page.locator('#online-state').getAttribute('data-state'),'online');
        await report('public');await page.locator('#online-server-select').selectOption('public');await page.waitForSelector('.online-name');
        await page.locator('#online-watch').click();await page.waitForSelector('#online-frame iframe');
        await page.route('**/api/online/servers',async route=>{const response=await route.fetch();const json=await response.json();json.servers=json.servers.filter(s=>s.id==='minipc');json.defaultServerId='minipc';await route.fulfill({response,json});});
        await reload(page);assert.equal(await page.locator('#online-frame iframe').count(),0);assert.equal(await page.locator('#online-server-select').inputValue(),'minipc');assert.ok(!page.url().includes('tv=1'));
        await page.unroute('**/api/online/servers');
        await page.goto(base+'/?match='+m.id+'&lang=en');await page.waitForSelector('.detail-score');assert.match(await page.locator('#content').innerText(),/Server: MINIPC.*10\.10\.1\.51:27910/s);await page.close();
        results.push({browser:name,lifetime:'offline, recovery, stale and recovery passed',matchSource:'passed'});
      }
    }finally{await browser.close();}
  }
  await writeFile(evidence+'/browser-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify({checks:results.length,evidence,passed:true}));
}finally{
  close();await Promise.all([new Promise(r=>server.close(r)),new Promise(r=>remote.close(r))]);await store.close();
  const client=new MongoClient(config.mongoUri);await client.connect();await client.db(database).dropDatabase();await client.close();
}
