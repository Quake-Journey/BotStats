import {chromium,firefox,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {testPath} from './support/paths.js';
const base=process.env.BOTSTATS_BASE_URL||'http://127.0.0.1:3085/botstats/';
const out=testPath('shared-shell-browser');await mkdir(out,{recursive:true});
const checks=[];
for(const [engineName,engine] of Object.entries({chromium,firefox,webkit})){
 const browser=await engine.launch();
 try{for(const width of [2560,1440,390,320]){
  console.log(engineName,width);
  const page=await browser.newPage({viewport:{width,height:1000}}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});page.on('request',r=>requests.push(r.url()));
  await page.goto(base+'?lang=ru&theme=judgment');
  await page.locator('#content[aria-busy=false]').waitFor();
  await page.locator('.home-page').waitFor();await page.waitForSelector('#judgment-scene[data-bot-share]');
  assert.equal(await page.locator('.home-heading,.home-kpis,.home-shortcuts').count(),0);
  assert.equal(await page.getByText('Люди против машин',{exact:true}).count(),0);
  assert.equal(await page.locator('.data-table').count(),0);
  assert.equal(requests.filter(u=>u.includes('/api/home?')).length,1);
  assert.equal(requests.some(u=>/\/api\/(summary|matches|charts)(\/|\?|$)/.test(u)),false,'Home does not request ranking calculations or chart aggregates');
  assert.equal(await page.locator('#home-bots .home-participant').count(),15);
  assert.equal(await page.locator('#home-humans .home-participant').count(),25);
  const colors=await page.evaluate(()=>Object.fromEntries(Object.entries({name:'.home-participant.human .home-person-name',wins:'.home-participant.human .home-person-wins b',bot:'.home-participant.bot .home-person-name'}).map(([k,s])=>[k,getComputedStyle(document.querySelector(s)).color])));
  assert.notEqual(colors.name,colors.wins);assert.notEqual(colors.name,colors.bot);
  const measures=()=>page.evaluate(()=>{
   const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return [r.x,r.y+scrollY,r.width,r.height].map(x=>Math.round(x*10)/10);};
   return {tabs:box('.shared-tabs'),overview:box('#shared-shell .overview'),content:box('#content'),scrollX:document.documentElement.scrollWidth,viewport:innerWidth};
  });
  const start=await measures();assert.ok(start.overview[1]>start.tabs[1]);
  assert.ok(start.content[1]>=start.overview[1]+start.overview[3]-1);assert.ok(start.scrollX<=start.viewport);
  // The same DOM nodes stay mounted throughout tab changes, preserving layout.
  await page.evaluate(()=>{window.shellProof=document.querySelector('#shared-shell .overview');});
  for(const view of ['rating','matches','online','players','bots','defeats','victims','botdefeats','dynamics','charts','achievements','home']){
   await page.locator(`[data-view=${view}]`).click();
   await page.waitForFunction(v=>new URL(location).searchParams.get('view')===v&&document.querySelector('#content').getAttribute('aria-busy')==='false',view);
   assert.equal(await page.locator('.tabs').count(),1,view+' one navigation');
   assert.equal(await page.locator('#kpis').count(),1,view+' one common overview');
   assert.equal(await page.locator('#latest .score-link').count(),1,view+' latest match present');
   assert.equal(await page.evaluate(()=>window.shellProof===document.querySelector('#shared-shell .overview')),true);
   const now=await measures();assert.deepEqual(now.tabs,start.tabs,view+' navigation fixed');
   assert.equal(await page.locator('#shared-shell .overview').isVisible(),view==='home',view+' overview only on home');
   if(view==='home')assert.deepEqual(now.overview,start.overview,view+' overview returns to its original position');
   else assert.ok(now.content[1]-now.tabs[1]-now.tabs[3]<=20,view+' no empty space left by overview');
   assert.ok(now.scrollX<=now.viewport,view+' no overflow');
   assert.equal(await page.locator('#judgment-caption').count(),0,view+' no duplicate theme caption');
  }
  if(width<800){
   await page.locator('[data-overview=overviewStats]>summary').click();
   await page.waitForFunction(()=>document.querySelector('[data-overview=overviewStats]').open);
   const opened=await measures();await page.locator('[data-view=matches]').click();await page.locator('#content[aria-busy=false]').waitFor();
   assert.equal(await page.locator('[data-overview=overviewStats]').evaluate(e=>e.open),true,'Mobile disclosure preserved');
   assert.equal(await page.locator('#shared-shell .overview').isVisible(),false,'Expanded overview is also hidden on inner pages');
   assert.ok((await measures()).scrollX<=width);
  }
  assert.deepEqual(errors,[]);
  if(engineName!=='webkit')await page.screenshot({path:`${out}/${engineName}-${width}.png`,fullPage:false,caret:'initial'});
  checks.push({engineName,width,passed:true,coordinates:start,colors});await page.close();
 }}finally{await browser.close();}
}
await writeFile(out+'/checks.json',JSON.stringify({passed:true,checks},null,2));console.log(JSON.stringify({passed:true,cases:checks.length}));
