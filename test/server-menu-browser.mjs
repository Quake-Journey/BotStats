import assert from 'node:assert/strict';
import {chromium,firefox,webkit} from 'playwright';
import {once} from 'node:events';
import {mkdir,writeFile} from 'node:fs/promises';
import {MongoClient} from 'mongodb';
import {createService} from '../src/server.js';
import {testPath} from './support/paths.js';

const database='q2pro_botstats_header_'+Date.now(),evidence=process.env.BOTSTATS_BROWSER_EVIDENCE||testPath('server-menu',database);
await mkdir(evidence,{recursive:true});
const sources=[{id:'default',name:'Q2PRO-X · OpenTDM-X',address:'arena.example:27950',access:'public',transport:'report',sourceToken:'header-public-fixture-'.repeat(3)},
  {id:'minipc',name:'MINIPC · OpenTDM-X',address:'10.10.1.51:27910',access:'lan',transport:'report',sourceToken:'header-lan-fixture-'.repeat(3)}];
const config={database,mongoUri:'mongodb://127.0.0.1:27017',ingestToken:'header-legacy-fixture-'.repeat(3),storageDir:testPath('server-menu-data',database),online:{servers:sources}};
const {app,store,bindOnlineSockets}=await createService(config),server=app.listen(0,'127.0.0.1');await once(server,'listening');
const close=bindOnlineSockets(server),base='http://127.0.0.1:'+server.address().port+'/botstats';
const results=[];
async function openMenu(page){
  if(await page.locator('#toggle-links').isVisible()&&await page.locator('#toggle-links').getAttribute('aria-expanded')!=='true')await page.locator('#toggle-links').click();
  if(!await page.locator('#server-menu').evaluate(el=>el.open))await page.locator('#server-menu>summary').click();
  await page.locator('[data-server-entry]').first().waitFor();
}
async function geometry(page){return page.evaluate(()=>{
  const items=[...document.querySelectorAll('.header a,.header button,.header select,.header summary')].filter(el=>el.checkVisibility());
  const boxes=items.map(el=>({el,rect:el.getBoundingClientRect()})),outside=[],overlaps=[];
  for(const {el,rect:r} of boxes)if(r.left<-.5||r.right>innerWidth+.5)outside.push(el.textContent.trim());
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
    const a=boxes[i],b=boxes[j];if(a.el.contains(b.el)||b.el.contains(a.el))continue;
    if(Math.min(a.rect.right,b.rect.right)-Math.max(a.rect.left,b.rect.left)>1&&Math.min(a.rect.bottom,b.rect.bottom)-Math.max(a.rect.top,b.rect.top)>1)overlaps.push([a.el.textContent.trim(),b.el.textContent.trim()]);
  }
  return {overflow:document.documentElement.scrollWidth>innerWidth,outside,overlaps};
});}
try{
  for(const [engine,type,widths] of [['chromium',chromium,[320,390,800,801,1100,1101,1440,1920]],['firefox',firefox,[320,1440]],['webkit',webkit,[320,1440]]]){
    const browser=await type.launch({headless:true});
    try{
      for(const width of widths)for(const lang of ['ru','en']){
        const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
        const theme=width===1440?'judgment':width===320?'light':'dark';
        await page.goto(base+'/?lang='+lang+'&theme='+theme+'&view=matches');await page.waitForSelector('[data-server-entry]',{state:'attached'});
        assert.equal(await page.locator('[data-server-menu-count]').innerText(),'2');await openMenu(page);
        assert.equal(await page.locator('[data-server-entry]').count(),2);
        assert.equal(await page.locator('[data-server-entry=minipc] .server-menu-connect a').count(),0);
        assert.equal(await page.locator('[data-server-entry=default] [data-copy-address]').getAttribute('data-copy-address'),'arena.example:27950');
        assert.equal(await page.locator('[data-server-entry=minipc] [data-copy-address]').getAttribute('data-copy-address'),'10.10.1.51:27910');
        for(const control of await page.locator('.server-menu-connect').all())assert.equal(await control.isVisible(),width>800);
        assert.ok((await page.locator('[data-server-entry=minipc]').innerText()).includes('VPN'));
        assert.deepEqual(await geometry(page),{overflow:false,outside:[],overlaps:[]},`${engine} ${width} ${lang}`);
        if(engine==='chromium'&&[320,1440].includes(width)&&lang==='ru')await page.screenshot({path:evidence+`/menu-${width}.png`});
        await page.keyboard.press('Escape');assert.equal(await page.locator('#server-menu').evaluate(el=>el.open),false);
        await openMenu(page);
        const other=lang==='ru'?'en':'ru';await page.locator('#language').selectOption(other);await page.waitForFunction(t=>document.documentElement.lang===t,other);
        await page.locator('#theme').selectOption('light');await openMenu(page);
        assert.equal(await page.locator('[data-server-menu-title]').innerText(),other==='ru'?'Серверы':'Servers');
        const target=new URL(await page.locator('[data-server-entry=minipc] .server-menu-name').getAttribute('href'),base);
        assert.equal(target.searchParams.get('theme'),'light');assert.equal(target.searchParams.get('lang'),other);
        await page.locator('[data-server-entry=minipc] .server-menu-name').click();await page.waitForSelector('#online-server-select');
        assert.equal(await page.locator('#online-server-select').inputValue(),'minipc');assert.equal(new URL(page.url()).searchParams.get('onlineServer'),'minipc');
        assert.deepEqual(errors,[]);results.push({engine,width,lang,theme,geometry:'pass',selection:'pass',preferences:'pass'});await page.close();
      }
      if(engine==='chromium'){
        const page=await browser.newPage({viewport:{width:1440,height:900}});let calls=0,fail=false,single=false;
        await page.addInitScript(()=>{window.testNow=Date.now();Date.now=()=>window.testNow;Object.defineProperty(navigator,'clipboard',{value:{writeText:async value=>{window.copied=value;}}});});
        await page.route('**/api/online/servers',async route=>{calls++;if(fail)return route.abort();const response=await route.fetch(),json=await response.json();if(single)json.servers=json.servers.filter(s=>s.id==='minipc');await route.fulfill({response,json});});
        await page.goto(base+'/about?lang=ru&theme=judgment&profile=someone&kind=bot&match=old&profilePage=3&map=q2duel5');
        await page.waitForSelector('[data-server-entry]',{state:'attached'});await openMenu(page);assert.equal(calls,1);
        await page.locator('[data-server-entry=default] [data-copy-address]').click();assert.equal(await page.evaluate(()=>window.copied),'connect arena.example:27950');
        await page.locator('[data-server-entry=minipc] [data-copy-address]').click();assert.equal(await page.evaluate(()=>window.copied),'connect 10.10.1.51:27910');
        const target=new URL(await page.locator('[data-server-entry=minipc] a').getAttribute('href'),base);
        for(const key of ['profile','kind','match','profilePage'])assert.equal(target.searchParams.has(key),false,key);
        assert.equal(target.searchParams.get('map'),'q2duel5');assert.equal(target.searchParams.get('view'),'online');
        await page.keyboard.press('Escape');await openMenu(page);assert.equal(calls,1,'fresh list reused');
        await page.keyboard.press('Escape');await page.evaluate(()=>window.testNow+=31000);fail=true;await openMenu(page);await page.locator('[data-server-menu-retry]').waitFor();
        assert.equal(await page.locator('[data-server-entry]').count(),2,'last known registry preserved with explicit error');
        fail=false;single=true;await page.locator('[data-server-menu-retry]').click();await page.waitForFunction(()=>document.querySelector('[data-server-menu-count]').textContent==='1');
        assert.equal(await page.locator('[data-server-entry]').count(),1);assert.equal(await page.locator('[data-server-entry]').getAttribute('data-server-entry'),'minipc');
        await page.locator('.brand').focus();await page.locator('.header').click({position:{x:10,y:10}});assert.equal(await page.locator('#server-menu').evaluate(el=>el.open),false);
        await page.close();results.push({engine,lifecycle:'single list, refresh, failure, retry, removal, copy, route isolation passed'});
      }
    }finally{await browser.close();}
  }
  await writeFile(evidence+'/results.json',JSON.stringify({passed:true,results},null,2));console.log(JSON.stringify({passed:true,cases:results.length,evidence}));
}finally{
  close();await new Promise(r=>server.close(r));await store.close();const client=new MongoClient(config.mongoUri);await client.connect();
  assert.ok(database.startsWith('q2pro_botstats_header_'));await client.db(database).dropDatabase();await client.close();
}
