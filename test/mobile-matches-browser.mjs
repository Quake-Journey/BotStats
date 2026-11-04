import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {testPath} from './support/paths.js';
const base=process.env.BOTSTATS_BASE_URL||'http://127.0.0.1:3085/botstats/',out=testPath('mobile-matches');await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:process.env.BOTSTATS_BROWSER_CHANNEL||'chrome'}),checks=[];
const ready=p=>p.locator('#content[aria-busy=false]').waitFor();
const capture=async(p,name)=>{await p.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&r.top<innerHeight&&r.bottom>0;}).map(e=>e.decode().catch(()=>{})));});await p.screenshot({path:out+'/'+name+'.png'});};
try{
 for(const [width,lang,theme] of [[320,'ru','dark'],[390,'en','light'],[440,'ru','judgment'],[768,'ru','auto'],[1440,'ru','judgment']]){
  const mobile=width<=800,p=await browser.newPage({viewport:{width,height:956},hasTouch:mobile}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base+`?view=home&lang=${lang}&theme=${theme}`);await ready(p);
  if(mobile){
   const result=await p.locator('.compact-latest-result').boundingBox(),score=await p.locator('.compact-latest-score').boundingBox(),meta=await p.locator('.compact-latest-meta').boundingBox();
   assert.ok(result.y>=score.y+score.height,'Latest result below score');assert.ok(Math.abs(result.x+result.width/2-(meta.x+meta.width/2))<2,'Result centred in metadata');
   assert.ok((await p.locator('#latest').boundingBox()).height<125);await capture(p,'home-'+width);
  }else assert.ok(await p.locator('.latest-heading .latest-result').isVisible());
  const response=p.waitForResponse(r=>new URL(r.url()).pathname==='/botstats/api/matches');
  await p.goto(base+`?view=matches&lang=${lang}&theme=${theme}`);await ready(p);const data=await(await response).json();
  if(mobile){
   const rows=p.locator('.compact-match');assert.equal(await rows.count(),data.items.length);
   for(const [i,m] of data.items.entries()){
    const row=rows.nth(i);
    assert.deepEqual(await row.locator('.compact-identity>a>span').allTextContents(),m.participants.map(p=>p.name),'Participant/score order retained');
    assert.deepEqual(await row.locator('.score>span').allTextContents(),[String(m.participants[0].score),':',String(m.participants[1].score)]);
    assert.equal(await row.locator('[data-player-kind=bot] [data-outcome=forfeit-loss]').count(),0,'Bots cannot forfeit');
    if(m.status==='forfeit')assert.equal(await row.locator('[data-player-kind=human] [data-outcome=forfeit-loss]').count(),1);
    assert.equal(await row.locator('.mode-tag:visible').count(),2,'Both modes remain visible');
    const target=new URL(await row.locator('.score-link').getAttribute('href'),base);assert.equal(target.searchParams.get('match'),m.id);
   }
   const heights=await rows.evaluateAll(es=>es.slice(0,5).map(e=>e.getBoundingClientRect().height));
   assert.ok(heights.every(h=>h<(width<=360?150:130)),'Dense match rows');
   if(width===440)assert.ok((await rows.nth(5).boundingBox()).y<956,'Sixth match starts on first screen');
   await capture(p,'matches-'+width);
   await rows.first().locator('summary').click();assert.ok(await rows.first().locator('dl').isVisible());
   assert.equal(await rows.first().locator('dl>div').count(),data.items[0].participants.filter(p=>p.isBot).length+1,'Bot settings and version available');
   await rows.first().locator('summary').click();
   const select=p.locator('[data-sort-select=matches]'),choice=await select.locator('option').last().getAttribute('value');
   await select.selectOption(choice);await ready(p);assert.equal(new URL(p.url()).searchParams.get('sort_matches'),choice);
   await p.reload();await ready(p);assert.equal(await p.locator('[data-sort-select=matches]').inputValue(),choice);
   await p.locator('.compact-match .score-link').first().click();await ready(p);assert.ok(await p.locator('.detail-score').isVisible());
   checks.push({width,lang,matchHeights:heights,sortingAndLinks:true,passed:true});
  }else{
   assert.equal(await p.locator('.compact-match').count(),0);assert.equal(await p.locator('.match-row .duel').count(),data.items.length);checks.push({width,desktopRetained:true,passed:true});
  }
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);await p.close();
 }
 const p=await browser.newPage({viewport:{width:440,height:956},hasTouch:true});
 for(const [id,route] of [['profile','view=players&profile=pp&kind=human'],['chart','view=charts&chart=duration&bucket=minute2&chartOutcome=all']]){
  await p.goto(base+'?lang=ru&theme=judgment&'+route);await ready(p);await p.locator('.compact-match').first().waitFor();
  await p.locator('.compact-match').first().scrollIntoViewIfNeeded();assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await capture(p,id);checks.push({sharedMatchRenderer:id,passed:true});
 }
 // A changed mode and overtime must wrap without overlapping either participant.
 await p.route('**/api/matches?*',async route=>{const response=await route.fetch(),data=await response.json();const m=data.items[0];m.overtime=true;m.overtimeKind='sudden_death';m.modes={hardcore:{initial:true,changed:true},training:{initial:false,changed:true}};await route.fulfill({json:{...data,items:[m]}});});
 await p.setViewportSize({width:320,height:956});await p.goto(base+'?view=matches&lang=ru&theme=light');await ready(p);
 assert.equal(await p.locator('.compact-match .mode-variable').count(),2);assert.ok(await p.locator('.compact-match .overtime').isVisible());assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await capture(p,'variable-overtime-320');checks.push({variableModesOvertime:true,passed:true});await p.close();
 await writeFile(out+'/results.json',JSON.stringify({passed:true,checks},null,2));console.log(JSON.stringify({passed:true,checks}));
}finally{await browser.close();}
