import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {testPath} from './support/paths.js';
const base=process.env.BOTSTATS_BASE_URL||'http://127.0.0.1:3085/botstats/',out=testPath('mobile-matches');await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:process.env.BOTSTATS_BROWSER_CHANNEL||'chrome'}),checks=[];
const ready=p=>p.locator('#content[aria-busy=false]').waitFor();
const detailReady=async p=>{await p.locator('.detail-score').waitFor({timeout:10000}).catch(async e=>{throw new Error('Match detail did not open: '+await p.locator('#content').innerText(),{cause:e});});};
const capture=async(p,name)=>{await p.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&r.top<innerHeight&&r.bottom>0;}).map(e=>e.decode().catch(()=>{})));});await p.screenshot({path:out+'/'+name+'.png'});};
async function verifyRows(p,data,{humanFirst=false}={}){
 if(data.items.length)await p.waitForFunction(id=>document.querySelector('.compact-match')?.dataset.match===id,data.items[0].id);
 const rows=p.locator('.compact-match');assert.equal(await rows.count(),data.items.length);
 for(const [i,m] of data.items.entries()){
  const row=rows.nth(i),participants=humanFirst?[...m.participants].sort((a,b)=>Number(a.isBot)-Number(b.isBot)):m.participants;
  assert.deepEqual(await row.locator('.compact-match-player').allTextContents(),participants.map(p=>p.name),'Names and score keep the same order');
  assert.deepEqual(await row.locator('.score>span').allTextContents(),[String(participants[0].score),':',String(participants[1].score)]);
  if(Number.isInteger(m.winnerIndex))assert.equal(await row.locator('.score .win').textContent(),String(m.participants[m.winnerIndex].score),'Winner highlight follows reordered score');
  assert.equal(await row.locator('.achievement-badges').count(),0,'No achievements in match lists');
  const loser=m.participants.find((v,j)=>!v.isBot&&m.status==='forfeit'&&(Number.isInteger(m.winnerIndex)?m.winnerIndex!==j:m.forfeitBy===v.name));
  assert.equal(await row.locator('[data-outcome=forfeit-loss]').count(),loser?1:0);
  if(loser){assert.equal(await row.locator('[data-outcome=forfeit-loss]').getAttribute('data-player-kind'),'human');assert.ok((await row.locator('[data-outcome=forfeit-loss]').getAttribute('aria-label')).startsWith(loser.name+':'));}
  assert.equal(await row.locator('.mode-tag:visible').count(),0,'Secondary context stays collapsed');
  const target=new URL(await row.locator('.score-link').getAttribute('href'),base);assert.equal(target.searchParams.get('match'),m.id);
  for(const [j,participant] of participants.entries()){
   const name=row.locator('.compact-match-player').nth(j),url=new URL(await name.getAttribute('href'),base);
   assert.equal(url.searchParams.get('profile'),participant.isBot?(participant.profile||participant.name):participant.name);
   assert.equal(url.searchParams.get('kind'),participant.isBot?'bot':'human');assert.equal(await name.getAttribute('title'),participant.name);
  }
 }
 const layout=await rows.evaluateAll(es=>es.map(e=>{
  const rect=n=>n.getBoundingClientRect(),box=rect(e),duel=e.querySelector('.compact-match-duel'),names=[...duel.querySelectorAll('.compact-match-player')].map(rect),score=rect(duel.querySelector('.score-link')),summary=rect(e.querySelector('summary')),foot=[...e.querySelector('summary').children].map(rect),loss=e.querySelector('.compact-match-forfeit'),lossBox=loss&&rect(loss);
  return {forfeitCenter:lossBox?Math.abs(lossBox.x+lossBox.width/2-(score.x+score.width/2)):0,height:box.height,center:Math.abs(score.x+score.width/2-(box.x+box.width/2)),nameCenters:names.map(n=>Math.abs(n.y+n.height/2-(score.y+score.height/2))),topOverlap:names[0].right>score.x||score.right>names[1].x,footerBelow:summary.y>=score.bottom,footAligned:foot.every(n=>Math.abs(n.y+n.height/2-(summary.y+summary.height/2))<1),footInside:foot.every(n=>n.x>=box.x&&n.right<=box.right),footOverlap:foot.some((n,i)=>i&&n.x<foot[i-1].right)};
 }));
 for(const r of layout){assert.ok(r.height<=66,'Closed match occupies two lines at every mobile width');assert.ok(r.center<1&&r.nameCenters.every(v=>v<1),'Duel names/score centred');assert.ok(r.forfeitCenter<1,'Forfeit label is centred directly below score');assert.ok(!r.topOverlap&&r.footerBelow&&r.footAligned&&r.footInside&&!r.footOverlap,'No overlap or wrapped third line');}
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
 return layout.slice(0,5).map(r=>r.height);
}
async function verifyDetails(row){
 await row.locator('summary').click();assert.ok(await row.locator('dl').isVisible());assert.equal(await row.locator('.mode-tag:visible').count(),2,'Hardcore and Training remain accessible');
 assert.ok(await row.locator('.compact-match-expanded .button-link').isVisible());
 await row.locator('summary').focus();await row.press('Enter');assert.equal(await row.locator('details').getAttribute('open'),null,'Disclosure works by keyboard');
}
try{
 for(const [width,lang,theme] of [[320,'ru','dark'],[390,'en','light'],[440,'ru','judgment'],[768,'ru','auto'],[1440,'ru','judgment']]){
  const mobile=width<=800,p=await browser.newPage({viewport:{width,height:956},hasTouch:mobile}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base+`?view=home&lang=${lang}&theme=${theme}`);await ready(p);
  if(mobile){
   const result=await p.locator('.compact-latest-result').boundingBox(),score=await p.locator('.compact-latest-score').boundingBox(),meta=await p.locator('.compact-latest-meta').boundingBox();
   assert.ok(result.y>=score.y+score.height,'Latest result below score');assert.ok(Math.abs(result.x+result.width/2-(meta.x+meta.width/2))<2,'Result centred in metadata');
   assert.ok((await p.locator('#latest').boundingBox()).height<125);
  }else assert.ok(await p.locator('.latest-heading .latest-result').isVisible());
  const response=p.waitForResponse(r=>new URL(r.url()).pathname==='/botstats/api/matches');
  await p.goto(base+`?view=matches&lang=${lang}&theme=${theme}`);await ready(p);const data=await(await response).json();
  if(mobile){
   const heights=await verifyRows(p,data),rows=p.locator('.compact-match');
   await capture(p,'matches-'+width);await verifyDetails(rows.first());
   const select=p.locator('[data-sort-select=matches]'),choice=await select.locator('option').last().getAttribute('value');
   await select.selectOption(choice);await ready(p);assert.equal(new URL(p.url()).searchParams.get('sort_matches'),choice);
   await p.reload();await ready(p);assert.equal(await p.locator('[data-sort-select=matches]').inputValue(),choice);
   await p.locator('.compact-match .score-link').first().click();await ready(p);await detailReady(p);
   checks.push({width,lang,matchHeights:heights,sortingAndLinks:true,passed:true});
  }else{
   assert.equal(await p.locator('.compact-match').count(),0);assert.equal(await p.locator('.match-row .duel').count(),data.items.length);checks.push({width,desktopRetained:true,passed:true});
  }
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);await p.close();
 }
 const p=await browser.newPage({viewport:{width:440,height:956},hasTouch:true}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 for(const [id,route] of [['profile-human','view=players&profile=pp&kind=human'],['profile-bot','view=bots&profile=God-X&kind=bot'],['chart','view=charts&chart=duration&bucket=minute2&chartOutcome=all'],['defeats','view=defeats'],['botdefeats','view=botdefeats']]){
  const response=p.waitForResponse(r=>new URL(r.url()).pathname===(id==='chart'?'/botstats/api/chart-matches/duration':'/botstats/api/matches'));
  await p.goto(base+'?lang=ru&theme=judgment&'+route);await ready(p);await p.locator('.compact-match').first().waitFor();const data=await(await response).json();
  const humanFirst=['defeats','botdefeats'].includes(id),heights=await verifyRows(p,data,{humanFirst});
  await p.locator('.compact-match').first().scrollIntoViewIfNeeded();await capture(p,id);await verifyDetails(p.locator('.compact-match').first());
  if(humanFirst){
   const change=p.waitForResponse(r=>new URL(r.url()).pathname==='/botstats/api/matches');
   await p.locator(`[data-sort-select=${id}]`).selectOption('date');await ready(p);const sorted=await(await change).json();await verifyRows(p,sorted,{humanFirst});
   assert.equal(new URL(p.url()).searchParams.get('sort_'+id),'date');
   await p.setViewportSize({width:1440,height:956});await ready(p);await p.locator(`table[data-table=${id}]`).waitFor();assert.equal(await p.locator('.compact-match').count(),0,'Desktop defeat table retained');
   await p.setViewportSize({width:440,height:956});await ready(p);
  }
  checks.push({sharedMatchRenderer:id,heights,passed:true});
 }
 // Pairs share the two-line layout without pretending aggregate wins are a match score.
 for(const [width,lang] of [[320,'ru'],[390,'en'],[440,'ru'],[768,'ru'],[1440,'en']]){
  await p.setViewportSize({width,height:956});
  const response=p.waitForResponse(r=>new URL(r.url()).pathname==='/botstats/api/victims');
  await p.goto(base+`?view=victims&lang=${lang}&theme=judgment`);await ready(p);const data=await(await response).json();
  if(width<=800){
   const rows=p.locator('.compact-match[data-pair]');assert.equal(await rows.count(),data.items.length);assert.equal(await rows.locator('.achievement-badges').count(),0);
   for(const [i,r] of data.items.entries()){
    const row=rows.nth(i);assert.deepEqual(await row.locator('.compact-match-player').allTextContents(),[r.bot,r.human]);
    assert.equal(await row.locator('.compact-pair-wins b').textContent(),r.botWins.toLocaleString(lang));
    assert.equal(await row.locator('.compact-pair-matches b').textContent(),r.matches.toLocaleString(lang));
    assert.equal(await row.locator('.compact-pair-rate').textContent(),r.botWinPercent.toLocaleString(lang,{maximumFractionDigits:1})+'%');
   }
   const geometry=await rows.evaluateAll(es=>es.map(e=>{
    const r=n=>n.getBoundingClientRect(),box=r(e),left=r(e.querySelector('.compact-match-player')),mid=r(e.querySelector('.compact-pair-wins')),right=r(e.querySelectorAll('.compact-match-player')[1]),foot=[...e.querySelector('summary').children].map(r);
    return {height:box.height,center:Math.abs(mid.x+mid.width/2-(box.x+box.width/2)),clear:left.right<=mid.x&&mid.right<=right.x&&foot.every((v,i)=>!i||v.x>=foot[i-1].right)};
   }));
   assert.ok(geometry.every(g=>g.height<=68&&g.center<1&&g.clear),'Pair rows occupy two lines without overlaps');
   await capture(p,'victims-'+width);await rows.first().locator('summary').click();
   assert.equal(await rows.first().locator('dl>div').count(),9,'All original pair metrics preserved');
   const target=new URL(await rows.first().locator('.last-bot-win').getAttribute('href'),base);assert.equal(target.searchParams.get('match'),data.items[0].lastBotWinMatchId);
   await rows.first().locator('.last-bot-win').click();await ready(p);await detailReady(p);
   await p.goto(base+`?view=victims&lang=${lang}&theme=judgment`);await ready(p);
   await p.locator('[data-sort-table=victims]').click();await p.waitForURL(/dir_victims=asc/);
   await p.waitForFunction(()=>{const n=[...document.querySelectorAll('.compact-pair-wins b')].map(e=>Number(e.textContent.replace(/[^0-9]/g,'')));return n.length&&n.every((v,i)=>!i||v>=n[i-1]);});
   await p.reload();await ready(p);assert.equal(new URL(p.url()).searchParams.get('dir_victims'),'asc');
  }else{assert.ok(await p.locator('table[data-table=victims]').isVisible());assert.equal(await p.locator('.compact-match').count(),0);}
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));checks.push({victims:true,width,lang,passed:true});
 }
 // Both human and bot award evidence must use the same match renderer.
 const catalog=await(await p.request.get(base+'api/achievements')).json();
 for(const kind of ['human','bot']){
  const award=catalog.items.find(a=>(a.audience||'human')===kind),player=award.holders[0].name;
  for(const width of [320,440,1440]){
   await p.setViewportSize({width,height:956});
   const response=p.waitForResponse(r=>new URL(r.url()).pathname==='/botstats/api/achievements/'+award.id);
   await p.goto(base+'?'+new URLSearchParams({view:'achievements',lang:'ru',theme:'light',achievement:award.id,awardPlayer:player}));await ready(p);const data=await(await response).json();
   if(width<=800){
    const items=data.evidence.matches.map(m=>({...m,participants:[{name:m.human,isBot:false,score:m.score[0]},{name:m.bot,profile:m.bot.replace(/(?:\[\d+\]|>\d+)$/,''),isBot:true,score:m.score[1]}],winnerIndex:m.status==='forfeit'?1:m.status==='completed'&&m.score[0]!==m.score[1]?(m.score[0]>m.score[1]?0:1):null}));
    await verifyRows(p,{items});await p.locator('.compact-match').first().scrollIntoViewIfNeeded();await capture(p,'award-'+kind+'-'+width);await verifyDetails(p.locator('.compact-match').first());
    await p.locator('[data-sort-select=award_evidence]').selectOption('map');await p.waitForURL(/sort_award_evidence=map/);await ready(p);
    await p.reload();await ready(p);assert.equal(await p.locator('[data-sort-select=award_evidence]').inputValue(),'map');
    await p.locator('.compact-match .score-link').first().click();await ready(p);await detailReady(p);
   }else assert.ok(await p.locator('table[data-table=award_evidence]').isVisible());
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));checks.push({awardEvidence:kind,width,passed:true});
  }
 }
 // Long names, large/negative scores, overtime, and variable modes at 320px.
 const sample=await(await p.request.get(base+'api/matches')).json();const m=structuredClone(sample.items[0]);
 m.participants[0].name='ОченьДлинноеИмяБотаБезПробелов[250]';m.participants[1].name='Long human name with spaces & <tag>';m.participants[0].score=-10;m.participants[1].score=123;
 m.status='forfeit';m.winnerIndex=m.participants.findIndex(p=>p.isBot);m.overtime=true;m.overtimeKind='sudden_death';m.modes={hardcore:{initial:true,changed:true},training:{initial:false,changed:true}};
 const fixture={...sample,items:[m],total:1,pages:1};
 await p.route('**/api/matches?*',route=>route.fulfill({json:fixture}));
 for(const lang of ['ru','en']){
  await p.setViewportSize({width:320,height:956});await p.goto(base+`?view=matches&lang=${lang}&theme=light`);await ready(p);await verifyRows(p,fixture);
  await capture(p,'long-names-'+lang+'-320');await p.locator('.compact-match summary').click();
  assert.equal(await p.locator('.compact-match .mode-variable:visible').count(),2);assert.ok(await p.locator('.compact-match .overtime').isVisible());
  for(const participant of m.participants)assert.ok((await p.locator('.compact-match dl').innerText()).includes(participant.name),'Full names available on touch');
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await capture(p,'expanded-'+lang+'-320');checks.push({longNamesNegativeScoreVariableOvertime:true,lang,passed:true});
 }
 assert.deepEqual(errors,[]);await p.close();await writeFile(out+'/results.json',JSON.stringify({passed:true,checks},null,2));console.log(JSON.stringify({passed:true,checks}));
}finally{await browser.close();}
