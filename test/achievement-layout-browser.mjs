// Render the actual app/assets with isolated in-memory match fixtures. No DB writes.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import express from 'express';
import path from 'node:path';
import {chromium,firefox,webkit} from 'playwright';
import {loadAssets} from '../src/assets.js';
import {aggregateMatches} from '../src/store.js';
import {buildBotVictims} from '../src/bot-victims.js';
import {ratingDetails} from '../public/rating.js';
import {computeAchievements,publicAchievements,achievementDetail} from '../src/achievements.js';
import {BOT_DEFINITIONS} from '../src/bot-achievements.js';
import {collection,game} from './support/achievement-fixtures.js';
import {botCollection} from './support/bot-achievement-fixtures.js';
import {testPath} from './support/paths.js';
const dir=testPath('achievement-layout-'+Date.now());await mkdir(dir,{recursive:true});
const humanRows=collection(),botRows=botCollection();
for(const m of botRows){m.id='bot-'+m.id;m.participants[1].name='Machine-X[200]';m.participants[1].profile='Machine-X';}
const tiny=game(800,{bot:'GOD-X',skill:1,seconds:1,status:'forfeit',winnerIndex:1,hs:5,bs:0});tiny.id='tiny';
const rows=[tiny,...humanRows,game(900,{bot:'Machine-X',hs:40,bs:10}),...botRows];
for(const m of rows){m.demo={sha256:'a'.repeat(64)};m.events=[];for(const p of m.participants){Object.assign(p,{style:'default',settingsHistory:[]});Object.assign(p.stats,{control:p.stats.control||[],pickups:p.stats.pickups||[],weapons:p.stats.weapons||[],damageDealt:p.stats.damageDealt||0});}}
const index=computeAchievements(rows),catalog=publicAchievements(index);assert.equal(catalog.items.length,44);
const assets=await loadAssets(new URL('../public',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'));
const app=express();
app.use((req,res,next)=>{res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; object-src 'none'");next();});
const pick=q=>rows.filter(m=>(!q.map||m.map===q.map)&&(!q.identity||m.participants.some(p=>p.isBot===(q.kind==='bot')&&(p.isBot?p.profile:p.name)===q.identity)));
app.get('/botstats/api/achievements',(req,res)=>res.json(catalog));
app.get('/botstats/api/achievements/:id',(req,res)=>{const v=achievementDetail(index,req.params.id,req.query);res.status(v?200:404).json(v||{error:'Not found'});});
app.get('/botstats/api/summary',(req,res)=>res.json(aggregateMatches(pick(req.query))));
app.get('/botstats/api/victims',(req,res)=>res.json(buildBotVictims(pick(req.query))));
app.get('/botstats/api/matches',(req,res)=>{const r=pick(req.query).filter(m=>!req.query.humanDefeats&&!req.query.botDefeats||m.status==='completed'&&m.winnerIndex===(req.query.botDefeats?0:1)).slice().reverse();res.json({items:r.slice(0,20),total:r.length,page:1,pages:Math.ceil(r.length/20)});});
app.get('/botstats/api/matches/:id',(req,res)=>{const m=rows.find(m=>m.id===req.params.id);res.status(m?200:404).json(m?{...m,rating:ratingDetails(m)}:{error:'Not found'});});
app.get('/botstats/api/facets',(req,res)=>res.json({maps:['q2duel5','ztn2dm3','q3t2','q2duel1'],bots:['Machine-X','GOD-X'],styles:['default'],versions:[],skills:[1,200,250]}));
app.use('/botstats/assets/'+assets.revision,(req,res)=>{const name=req.path.slice(1),bytes=assets.files.get(name);if(!bytes)return res.sendStatus(404);res.type(path.extname(name)).send(bytes);});
const preview=process.argv.includes('--serve');
const notice='<div class="wrap"><p class="warning">Пример оформления на тестовых данных: у Machine-X 20 достижений, у Tester — 23. Эти игры не входят в реальную статистику. <a href="http://127.0.0.1:3085/botstats/?view=victims&amp;lang=ru">Настоящие матчи →</a></p></div>';
app.get(['/botstats/','/botstats/about'],(req,res)=>res.type('html').send(preview?assets.html.replace('<main',notice+'<main'):assets.html));
const server=app.listen(preview?3086:0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}/botstats/`;
if(preview){console.log('Layout preview: '+base);await new Promise(()=>{});}
const results=[];
const ready=async page=>{await page.locator('#content[aria-busy=false]').waitFor();assert.equal(await page.locator('.error').count(),0);};
async function layout(page,label){
 const result=await page.evaluate(()=>{
  const faults=[];
  for(const strip of document.querySelectorAll('.achievement-badges.compact')){
   const box=strip.getBoundingClientRect(),children=[...strip.children].filter(e=>!e.hidden),rects=children.map(e=>e.getBoundingClientRect());
   if(rects.some(r=>r.left<box.left-1||r.right>box.right+1||Math.abs(r.top-rects[0].top)>1))faults.push({kind:'badge row overflow',width:box.width});
   const icons=strip.querySelectorAll('.achievement-mini'),shown=strip.querySelectorAll('.achievement-mini:not([hidden])'),more=strip.querySelector('.achievement-more');
   if(shown.length>5||shown.length+(more.hidden?0:Number(more.textContent.slice(1)))!==icons.length)faults.push({kind:'missing badges'});
  }
  return {faults,overflow:document.documentElement.scrollWidth>innerWidth,nestedLinks:document.querySelectorAll('a a').length};
 });
 assert.deepEqual(result,{faults:[],overflow:false,nestedLinks:0},label);
}
try{for(const [engineName,engine] of Object.entries({chromium,firefox,webkit})){
 const browser=await engine.launch({headless:true});
 try{for(const width of [1920,1440,390,320]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const lang=width===320?'en':'ru',theme=width===390?'light':'dark',suffix=`lang=${lang}&theme=${theme}`;
  for(const view of ['rating','bots','matches','defeats','victims','botdefeats']){
   await page.goto(base+'?view='+view+'&'+suffix);await ready(page);await layout(page,`${engineName}/${width}/${view}`);
   assert.ok(await page.locator('.hero-score .achievement-badges').count()>0);
   if(view==='victims'){
    const tabs=await page.locator('.tabs [data-view]').evaluateAll(links=>links.map(a=>a.dataset.view));assert.equal(tabs[tabs.indexOf('defeats')+1],'victims');
    assert.ok(await page.locator('table[data-table=victims] .machine-badges .achievement-mini:visible').count()>0);
    assert.ok(await page.locator('table[data-table=victims] tbody tr').count()>0);
    for(const key of ['bot','human','botWins','matches','botWinPercent','averageBotFrags','averageHumanFrags','lastBotWinAt']){
     await page.locator(`[data-sort-table=victims][data-sort-key=${key}]`).click();await ready(page);await layout(page,'victims sort '+key);
     assert.equal(new URL(page.url()).searchParams.get('sort_victims'),key);
    }
    await page.reload();await ready(page);assert.equal(await page.locator('[data-sort-table=victims][data-sort-key=lastBotWinAt]').getAttribute('class'),'sort-button sorted');
   }
   if(['defeats','botdefeats'].includes(view)){
    assert.ok(await page.locator(`table[data-table=${view}] td:nth-child(2) .machine-badges .achievement-mini:not([hidden])`).count()>0,'bot achievements must be visible in '+view);
    await page.locator(`[data-sort-table=${view}][data-sort-key=bot]`).click();await ready(page);await layout(page,'sort '+view);
    assert.ok(await page.locator(`table[data-table=${view}] .machine-badges .achievement-mini:not([hidden])`).count()>0);
   }
   if(engineName==='chromium'&&['bots','botdefeats','victims'].includes(view))await page.screenshot({path:`${dir}/${view}-${width}.png`});
  }
  await page.goto(base+'?view=bots&'+suffix);await ready(page);
  const more=page.locator('.hero-score .machine-badges .achievement-more');
  assert.ok(await more.isVisible());await more.click();await ready(page);
  const profileURL=new URL(page.url());assert.equal(profileURL.searchParams.get('profile'),'Machine-X');assert.equal(profileURL.searchParams.get('kind'),'bot');assert.equal(profileURL.hash,'#profile-achievements');
  assert.equal(profileURL.searchParams.get('theme'),theme);assert.equal(profileURL.searchParams.get('lang'),lang);
  assert.equal(await page.locator('.profile-achievements .achievement-mini:visible').count(),20);
  assert.equal(await page.locator('.profile-achievements .achievement-mini-label:visible').count(),20);await layout(page,'full collection');
  if(engineName==='chromium')await page.screenshot({path:`${dir}/profile-${width}.png`});
  await page.locator('.profile-achievements .achievement-mini').first().click();await ready(page);assert.ok(new URL(page.url()).searchParams.get('achievement').startsWith('bot-'));await layout(page,'award link');
  await page.goBack();await ready(page);assert.equal(await page.locator('.profile-achievements .achievement-mini:visible').count(),20);
  // Many awards stay in one row when the window changes in either direction.
  await page.goto(base+'?view=matches&match=bot-award-99&'+suffix);await ready(page);await layout(page,'match participants');
  for(const w of [320,2560,width]){await page.setViewportSize({width:w,height:1000});await page.waitForTimeout(100);await layout(page,'resize '+w);}
  assert.deepEqual(errors,[]);results.push({engineName,width,passed:true});console.log(JSON.stringify(results.at(-1)));await context.close();
 }
 // The original desktop case: four/five awards must use the available space,
 // rather than wrapping at the old 160px participant cap.
 const page=await browser.newPage({viewport:{width:1920,height:1000}});
 let limit=4;
 await page.route('**/api/achievements',route=>{
  const reduced={...catalog,items:catalog.items.filter(a=>a.audience==='bot').slice(0,limit)};
  return route.fulfill({json:reduced});
 });
 for(const n of [4,5]){
  limit=n;await page.goto(base+'?view=bots&lang=ru&theme=dark');await ready(page);
  assert.equal(await page.locator('.hero-score .machine-badges .achievement-mini:visible').count(),n,'desktop should fit '+n);
  assert.ok(await page.locator('.hero-score .machine-badges .achievement-more').isHidden());await layout(page,'desktop '+n);
  if(engineName==='chromium')await page.screenshot({path:`${dir}/desktop-${n}-awards.png`});
 }
 await page.close();
 }finally{await browser.close();}
}
await writeFile(dir+'/results.json',JSON.stringify({passed:true,results},null,2));console.log(JSON.stringify({passed:true,dir}));
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
