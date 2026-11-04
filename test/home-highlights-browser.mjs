import {chromium,firefox,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {testPath} from './support/paths.js';
const base=process.env.BOTSTATS_BASE_URL||'http://127.0.0.1:3085/botstats/',out=testPath('home-highlights');
await mkdir(out,{recursive:true});const checks=[];
for(const [engineName,engine] of Object.entries({chromium,firefox,webkit})){
 const browser=await engine.launch();
 try{for(const [width,lang,theme] of [[2560,'ru','judgment'],[1440,'en','light'],[390,'ru','dark'],[320,'en','light']]){
  const page=await browser.newPage({viewport:{width,height:1100},hasTouch:width<500}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  const dataPromise=page.waitForResponse(r=>new URL(r.url()).pathname==='/botstats/api/home');
  const awardsPromise=page.waitForResponse(r=>new URL(r.url()).pathname==='/botstats/api/achievements');
  await page.goto(base+`?view=home&lang=${lang}&theme=${theme}`);
  await page.locator('#content[aria-busy=false]').waitFor();
  if(width>800)await page.waitForFunction(()=>document.querySelector('#home-mod-version')?.textContent.includes('Beta'));
  else assert.equal(await page.locator('.home-ai-heading').count(),0);
  const data=await(await dataPromise).json(),catalog=await(await awardsPromise).json();
  for(const [kind,bot] of [['bots',true],['humans',false]]){
   const participants=data.players.filter(p=>p.isBot===bot).sort((a,b)=>b.wins-a.wins||b.matches-a.matches||a.name.localeCompare(b.name,lang));
   const shown=participants.slice(0,width<=800?3:12),section=page.locator('#home-'+kind);
   assert.deepEqual(await section.locator('.home-person-name').allTextContents(),shown.map(p=>p.name));
   const counter=await section.locator('.home-shown').textContent();
   assert.ok(counter.includes(String(shown.length))&&counter.includes(String(participants.length)));
   const boxes=await section.locator('.home-participant').evaluateAll(nodes=>nodes.map(n=>({top:Math.round(n.getBoundingClientRect().top),left:Math.round(n.getBoundingClientRect().left)})));
   if(width>=1200){assert.equal(new Set(boxes.map(b=>b.left)).size,4);assert.equal(new Set(boxes.map(b=>b.top)).size,3);}
   else assert.equal(new Set(boxes.map(b=>b.left)).size,1);
   const target=new URL(await section.locator('.home-section-more>a').getAttribute('href'),base);
   assert.equal(target.searchParams.get('view'),bot?'bots':'players');
  }
  const grants=catalog.items.flatMap(a=>a.holders.map(h=>({id:a.id,...h}))),dated=grants.filter(h=>Number.isFinite(Date.parse(h.earnedAt)));
  dated.sort((a,b)=>Date.parse(b.earnedAt)-Date.parse(a.earnedAt)||a.id.localeCompare(b.id)||a.name.localeCompare(b.name));
  assert.deepEqual(await page.locator('.home-award-holder>a').allTextContents(),dated.slice(0,width<=800?1:4).map(g=>g.name));
  assert.ok((await page.locator('.home-awards-heading .home-shown').textContent()).includes(String(grants.length)));
  assert.equal(await page.locator('.home-award').count(),width<=800?1:4);
  assert.ok(await page.evaluate(()=>document.querySelector('.home-intro').getBoundingClientRect().top<document.querySelector('#home-bots').getBoundingClientRect().top));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.equal(requests.some(u=>/\/api\/(summary|matches|facets|charts)(\/|\?|$)/.test(u)),false);
  assert.equal(requests.filter(u=>u.endsWith('/api/online/version')).length,width<=800?0:1);
  assert.equal(requests.some(u=>u.endsWith('/api/online')),false,'Home does not request Q2TV/modes');
  await page.locator('.home-intro').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>[...document.querySelectorAll('.home-award img')].every(img=>img.complete&&img.naturalWidth));
  if(engineName==='chromium')await page.screenshot({path:`${out}/home-${width}.png`,caret:'initial'});
  if(engineName==='chromium'&&width===1440){
   const first=page.locator('.home-award-heading').first(),href=new URL(await first.getAttribute('href'),base);
   assert.equal(href.searchParams.get('achievement'),dated[0].id);assert.equal(href.searchParams.get('awardPlayer'),dated[0].name);
   await first.click();await page.locator('.achievement-detail').waitFor();assert.equal(new URL(page.url()).searchParams.get('view'),'achievements');
   await page.locator('.tabs [data-view=home]').click();await page.locator('.home-intro').waitFor();
   await page.locator('#home-bots .home-section-more>a').click();await page.locator('#content[aria-busy=false]').waitFor();
   assert.equal(new URL(page.url()).searchParams.get('view'),'bots');assert.equal(await page.locator('.home-intro').count(),0);
  }
  assert.deepEqual(errors,[]);checks.push({engine:engineName,width,lang,theme,passed:true});await page.close();
 }}finally{await browser.close();}
}
await writeFile(out+'/results.json',JSON.stringify(checks,null,2));console.log(JSON.stringify(checks));
