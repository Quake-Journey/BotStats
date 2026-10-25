// End-to-end replay of the reported MVD: old persisted JSON -> watcher upgrade
// -> existing record replacement -> API aggregates and RU/EN desktop/mobile UI.
// Arguments: original match JSON, original MVD; no production DB is touched.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,copyFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {chromium,firefox,webkit} from 'playwright';
import {createService} from '../src/server.js';
import {runOnce,sendManifest} from '../src/importer.js';
import {PARSER_VERSION} from '../src/parser.js';
import {ratingDetails} from '../public/rating.js';
import {testPath} from './support/paths.js';
const original=JSON.parse(await readFile(process.argv[2],'utf8')),source=process.argv[3];
const dir=testPath('forfeit-reimport-'+Date.now());await mkdir(dir+'/incoming',{recursive:true});
const file=path.join(dir,'incoming',original.demo.originalName);await copyFile(source,file);
const config={database:'q2pro_botstats_forfeit_test',mongoUri:'mongodb://127.0.0.1:27017/?directConnection=true',ingestToken:'local-fixture-'.repeat(4),storageDir:dir+'/storage',basePath:'/botstats'};
const {app,store}=await createService(config),server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const apiUrl=`http://127.0.0.1:${server.address().port}/botstats`,results=[];
const api=async endpoint=>{const r=await fetch(apiUrl+'/api/'+endpoint);assert.equal(r.status,200);return r.json();};
try{
 const {demo,parserVersion,rating,...oldMatch}=original;
 const legacy={schemaVersion:1,parserVersion,demo,matches:[oldMatch]};
 await sendManifest({...config,apiUrl},file,legacy);
 assert.equal((await api('matches/'+oldMatch.id)).status,'forfeit','Legacy results work before importer upgrade');
 const importer={...config,apiUrl,sourceDir:dir+'/incoming',queueDir:dir+'/queue',decoder:path.resolve('bin/mvd-decoder.exe'),settleSeconds:0};
 await mkdir(importer.queueDir,{recursive:true});const info=await stat(file),key=createHash('sha256').update(apiUrl+'\n'+path.resolve(file)).digest('hex');
 await writeFile(importer.queueDir+'/state.json',JSON.stringify({[key]:{file,size:info.size,mtimeMs:info.mtimeMs,version:parserVersion,sha256:demo.sha256,done:true}}));
 const upgraded=await runOnce(importer);assert.equal(upgraded.imported,1);assert.deepEqual(upgraded.errors,[]);
 const m=await api('matches/'+oldMatch.id);assert.equal(m.parserVersion,PARSER_VERSION);assert.equal(m.status,'forfeit');assert.equal(m.endReason,'restart');assert.equal(m.forfeitBy,'pp');assert.deepEqual(m.participants.map(p=>p.score),[39,5]);assert.equal(m.durationSeconds,512.7);const botAward=0.05+4.95*(512.7-120)/480;assert.ok(Math.abs(m.rating.points[0]-botAward)<1e-12);assert.equal(m.rating.points[1],0);assert.deepEqual(m.rating.victoryPoints,[0,0]);
 assert.equal((await api('matches')).total,1);assert.equal((await api('matches?status=forfeit')).total,1);assert.equal((await api('matches?status=interrupted')).total,0);assert.equal((await api('matches?humanDefeats=1')).total,1);assert.equal((await api('matches?botDefeats=1')).total,0);
 const s=await api('summary'),human=s.players.find(p=>!p.isBot),bot=s.players.find(p=>p.isBot);assert.equal(human.points,0);assert.equal(human.forfeits,1);assert.equal(human.losses,1);assert.equal(human.wins,0);assert.ok(Math.abs(bot.points-botAward)<1e-12);assert.equal(bot.forfeitWins,1);assert.equal(s.botWins,1);assert.equal(s.humanWins,0);assert.equal(s.completedMatches,0);assert.equal(s.byMap[0].botWins,1);
 const d=await api('dynamics');assert.equal(d.totals.botWins,1);assert.equal(d.totals.humanWins,0);assert.equal(d.totals.forfeits,1);
 assert.equal((await runOnce(importer)).skipped,1,'No repeated processing after version upgrade');assert.equal((await api('matches')).total,1,'Same SHA/id, no duplicates');
 for(const [engineName,engine]of Object.entries({chromium,firefox,webkit})){
  const browser=await engine.launch({headless:true});
  try{for(const width of [1440,390])for(const lang of ['ru','en']){
   const page=await browser.newPage({viewport:{width,height:1000},colorScheme:'dark'}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(apiUrl+`/?lang=${lang}&theme=auto&match=${m.id}`);await page.waitForSelector('#content[aria-busy=false]');
   assert.equal(await page.locator('.player[data-player-kind=human] .participant-result').count(),1);assert.equal(await page.locator('.player[data-player-kind=bot] .participant-result').count(),0);
   assert.ok((await page.locator('.forfeit-context').innerText()).includes(lang==='ru'?'Перезапуск матча':'Match restart'));
   const content=await page.locator('#content').innerText();assert.ok(content.includes(lang==='ru'?'forfeit не участвует в расчёте':'forfeit excluded from calculation'));assert.ok(!content.includes('pp -5'));assert.ok(content.includes('Pacifist-X[200] +'+new Intl.NumberFormat(lang,{maximumFractionDigits:2}).format(botAward)));assert.ok((await page.locator('.bot-win-context').innerText()).includes(lang==='ru'?'Награда боту':'Bot win award'));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   // Synthetic ordinary loss tests the new per-match bot penalty presentation.
   const loss=structuredClone(m);loss.status='completed';loss.winnerIndex=1;loss.forfeitBy=null;delete loss.endReason;
   loss.participants[0].name='Pacifist-X[50]';loss.participants[0].skill=50;
   loss.participants[0].skillTimeline=[{fromMs:0,toMs:loss.timelineDurationMs,value:50}];
   loss.participants[0].score=5;loss.participants[1].score=39;loss.rating=ratingDetails(loss);
   await page.route('**/api/matches/'+m.id,r=>r.fulfill({json:loss}));await page.reload();await page.waitForSelector('#content[aria-busy=false]');
   assert.ok((await page.locator('.bot-loss-context').innerText()).includes(lang==='ru'?'-0,2538':'-0.2538'));
   assert.equal(await page.locator('.forfeit-context').count(),0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(engineName==='chromium'&&lang==='ru')await page.screenshot({path:dir+`/loss-${width}.png`,fullPage:true});
   await page.selectOption('#theme','light');
   if(!await page.locator('#about-link').isVisible())await page.locator('#toggle-links').click();
   await page.locator('#about-link').click();await page.waitForSelector('#content[aria-busy=false]');
   assert.ok((await page.locator('#bot-loss').innerText()).includes('250'));assert.ok((await page.locator('#difficulty').innerText()).includes(lang==='ru'?'−0,25':'−0.25'));assert.ok((await page.locator('#forfeit').innerText()).includes(lang==='ru'?'перезапуск':'restarts'));
   assert.equal(await page.locator('html').getAttribute('data-theme'),'light');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(engineName==='chromium'&&lang==='ru')await page.locator('#bot-loss').screenshot({path:dir+`/bot-loss-${width}.png`});
   assert.deepEqual(errors,[]);results.push({engineName,width,lang,passed:true});await page.close();
  }}finally{await browser.close();}
 }
 await writeFile(dir+'/result.json',JSON.stringify({passed:true,contexts:results.length,id:m.id,points:m.rating.points,score:m.participants.map(p=>p.score),reimport:upgraded,results},null,2));
 console.log(JSON.stringify({passed:true,contexts:results.length,dir}));
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));await store.close();}
