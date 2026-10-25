// Render the actual app/assets with isolated in-memory match fixtures. No DB writes.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import express from 'express';
import path from 'node:path';
import {chromium,firefox,webkit} from 'playwright';
import {loadAssets} from '../src/assets.js';
import {aggregateMatches} from '../src/store.js';
import {ratingDetails} from '../public/rating.js';
import {computeAchievements,publicAchievements,achievementDetail} from '../src/achievements.js';
import {BOT_DEFINITIONS} from '../src/bot-achievements.js';
import {collection,game} from './support/achievement-fixtures.js';
import {botCollection} from './support/bot-achievement-fixtures.js';
import {testPath} from './support/paths.js';
const dir=testPath('bot-awards-browser-'+Date.now());await mkdir(dir,{recursive:true});
const humanRows=collection(),botRows=botCollection();
for(const m of botRows){m.id='bot-'+m.id;m.participants[1].name='Machine-X[200]';m.participants[1].profile='Machine-X';}
const tiny=game(800,{bot:'GOD-X',skill:1,seconds:1,status:'forfeit',winnerIndex:1,hs:5,bs:0});tiny.id='tiny';
const rows=[...humanRows,...botRows,tiny];
for(const m of rows){m.demo={sha256:'a'.repeat(64)};m.events=[];for(const p of m.participants){Object.assign(p,{style:'default',settingsHistory:[]});Object.assign(p.stats,{control:p.stats.control||[],pickups:p.stats.pickups||[],weapons:p.stats.weapons||[],damageDealt:p.stats.damageDealt||0});}}
const index=computeAchievements(rows),catalog=publicAchievements(index);assert.equal(catalog.items.length,44);
const assets=await loadAssets(new URL('../public',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'));
const app=express();
app.use((req,res,next)=>{res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; object-src 'none'");next();});
const pick=q=>rows.filter(m=>(!q.map||m.map===q.map)&&(!q.identity||m.participants.some(p=>p.isBot===(q.kind==='bot')&&(p.isBot?p.profile:p.name)===q.identity)));
app.get('/botstats/api/achievements',(req,res)=>res.json(catalog));
app.get('/botstats/api/achievements/:id',(req,res)=>{const v=achievementDetail(index,req.params.id,req.query);res.status(v?200:404).json(v||{error:'Not found'});});
app.get('/botstats/api/summary',(req,res)=>res.json(aggregateMatches(pick(req.query))));
app.get('/botstats/api/matches',(req,res)=>{const r=pick(req.query).slice().reverse();res.json({items:r.slice(0,20),total:r.length,page:1,pages:Math.ceil(r.length/20)});});
app.get('/botstats/api/matches/:id',(req,res)=>{const m=rows.find(m=>m.id===req.params.id);res.status(m?200:404).json(m?{...m,rating:ratingDetails(m)}:{error:'Not found'});});
app.get('/botstats/api/facets',(req,res)=>res.json({maps:['q2duel5','ztn2dm3','q3t2','q2duel1'],bots:['Machine-X','GOD-X'],styles:['default'],versions:[],skills:[1,200,250]}));
app.use('/botstats/assets/'+assets.revision,(req,res)=>{const name=req.path.slice(1),bytes=assets.files.get(name);if(!bytes)return res.sendStatus(404);res.type(path.extname(name)).send(bytes);});
app.get(['/botstats/','/botstats/about'],(req,res)=>res.type('html').send(assets.html));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}/botstats/`;
const results=[];
const ready=async p=>{await p.locator('#content[aria-busy=false]').waitFor();assert.equal(await p.locator('.error').count(),0);};
const overflow=async(p,label)=>assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+' overflow');
try{for(const [engineName,engine]of Object.entries({chromium,firefox,webkit})){
 const browser=await engine.launch({headless:true});
 try{for(const width of [1440,390])for(const lang of ['ru','en'])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:1000},colorScheme:'dark'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));const suffix=`lang=${lang}&theme=${theme}`;
  await page.goto(base+'?view=achievements&'+suffix);await ready(page);assert.equal(await page.locator('.achievement-art').count(),44);
  await page.locator('.award-kinds a').nth(2).click();await ready(page);
  assert.equal(new URL(page.url()).searchParams.get('awardKind'),'bot');assert.equal(await page.locator('.achievement-art').count(),20);
  const decoded=await page.locator('.achievement-art img').evaluateAll(imgs=>Promise.all(imgs.map(async i=>{i.loading='eager';try{await i.decode();return null;}catch(e){return {src:i.src,error:e.message};}})));assert.deepEqual(decoded.filter(Boolean),[]);
  assert.ok(await page.locator('.achievement-art img').evaluateAll(imgs=>imgs.every(i=>i.naturalWidth>0&&i.naturalHeight>0&&i.naturalWidth===i.naturalHeight)));
  assert.equal(await page.locator('.machine-series').count(),20);await overflow(page,'machine catalog');
  const textColor=await page.locator('.achievement-caption.machine-award p').first().evaluate(e=>getComputedStyle(e).color);assert.equal(textColor,'rgb(195, 205, 214)');
  if(engineName==='chromium'&&lang==='ru')await page.screenshot({path:`${dir}/catalog-${width}-${theme}.png`});
  await page.reload();await ready(page);assert.equal(await page.locator('.achievement-art').count(),20);
  await page.locator('[data-sort-table=achievements][data-sort-key=name]').click();await ready(page);assert.equal(new URL(page.url()).searchParams.get('sort_achievements'),'name');
  await page.locator('#achievement-search').fill('Machine-X');await page.waitForFunction(()=>new URLSearchParams(location.search).get('achievementSearch')==='Machine-X');await ready(page);
  await page.goto(base+'?view=achievements&achievement=bot-legion&awardPlayer=Machine-X&awardKind=bot&'+suffix);await ready(page);
  assert.equal(await page.locator('.award-evidence tbody tr').count(),20);assert.ok((await page.locator('.award-evidence').innerText()).includes('Tester'));
  await page.locator('.award-evidence .pagination a').last().click();await ready(page);assert.equal(new URL(page.url()).searchParams.get('awardPage'),'2');await overflow(page,'proof page');
  await page.locator('.award-evidence tbody a').first().click();await ready(page);assert.equal(await page.locator('.detail-score').count(),1);assert.ok((await page.locator('.bot-win-context').innerText()).includes('+10'));await overflow(page,'proof match');
  await page.goBack();await ready(page);assert.equal(new URL(page.url()).searchParams.get('awardPage'),'2');
  await page.locator('.achievement-holder a').first().click();await ready(page);assert.equal(new URL(page.url()).searchParams.get('kind'),'bot');
  assert.equal(await page.locator('.profile-achievements .achievement-mini').count(),20);await overflow(page,'bot profile');
  if(engineName==='chromium'&&lang==='ru')await page.screenshot({path:`${dir}/profile-${width}-${theme}.png`});
  await page.locator('.profile-achievements .achievement-mini').first().click();await ready(page);assert.ok(new URL(page.url()).searchParams.get('achievement').startsWith('bot-'));
  await page.goto(base+'?view=players&kind=human&profile=Tester&'+suffix);await ready(page);assert.equal(await page.locator('.profile-achievements .achievement-mini').count(),computeAchievements(humanRows).players.get('Tester').awards.size);await overflow(page,'human profile');
  await page.goto(base+'?view=matches&match=tiny&'+suffix);await ready(page);assert.ok((await page.locator('.bot-win-context').innerText()).includes(lang==='ru'?'+0,0002':'+0.0002'));await overflow(page,'tiny points');
  for(const query of ['view=bots','view=players&kind=bot&profile=GOD-X&map=q2duel5']){
   await page.goto(base+'?'+query+'&'+suffix);await ready(page);await overflow(page,query);assert.equal(await page.locator('a a').count(),0);
  }
  await page.goto(base+'about?'+suffix+'#bot-wins');await ready(page);assert.ok((await page.locator('#bot-wins').innerText()).includes('250'));await overflow(page,'about');
  await page.selectOption('#theme','auto');assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  await page.goto(base+'?view=achievements&awardKind=bot&achievementSearch=no-such-holder&'+suffix);await ready(page);assert.equal(await page.locator('.achievement-art').count(),0);assert.equal(await page.locator('.empty').count(),1);
  assert.deepEqual(errors,[]);results.push({engineName,width,lang,theme,passed:true});console.log(JSON.stringify(results.at(-1)));await context.close();
 }
 if(engineName==='chromium'){
  const p=await browser.newPage({viewport:{width:1400,height:1100}});
  await p.setContent(`<body style="background:#0b1119;color:#e5ecf8;font:18px Segoe UI;display:grid;grid-template-columns:repeat(5,1fr);gap:16px;padding:22px">${BOT_DEFINITIONS.map(a=>`<div style="text-align:center"><img src="${base}assets/${assets.revision}/${a.icon}" width="220" height="220"><div>${a.name.ru}</div></div>`).join('')}</body>`);
  await p.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));await p.screenshot({path:dir+'/machine-icons.png',fullPage:true});await p.close();
 }
 }finally{await browser.close();}
}
await writeFile(dir+'/results.json',JSON.stringify({passed:true,contexts:results.length,results},null,2));console.log(JSON.stringify({passed:true,contexts:results.length,dir}));
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
