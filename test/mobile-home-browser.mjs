import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {testPath} from './support/paths.js';
const base=process.env.BOTSTATS_BASE_URL||'http://127.0.0.1:3085/botstats/';
const out=testPath('mobile-home');await mkdir(out,{recursive:true});
const browser=await chromium.launch(process.env.BOTSTATS_BROWSER_CHANNEL?{channel:process.env.BOTSTATS_BROWSER_CHANNEL}:{});
const checks=[];
const ready=page=>page.locator('#content[aria-busy=false]').waitFor();
const noOverflow=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
let latestId;
try{
 for(const [width,lang,theme] of [[320,'ru','dark'],[390,'en','light'],[768,'ru','judgment'],[1440,'ru','judgment']]){
  const mobile=width<=800,page=await browser.newPage({viewport:{width,height:950},hasTouch:mobile}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  const homeReply=page.waitForResponse(r=>new URL(r.url()).pathname==='/botstats/api/home');
  const awardsReply=page.waitForResponse(r=>new URL(r.url()).pathname==='/botstats/api/achievements');
  // Old shared URLs must not hide the overview anymore.
  await page.goto(base+`?view=home&lang=${lang}&theme=${theme}&overviewStats=0&overviewLatest=0`);await ready(page);
  const home=await(await homeReply).json(),catalog=await(await awardsReply).json();latestId=home.latest.id;
  assert.equal(await page.locator('#shared-shell details').count(),0);
  assert.equal(await page.locator('.tabs [data-view]').count(),12);
  assert.equal(await page.locator('#kpis .kpi').count(),mobile?2:4);
  assert.equal(await page.locator('.home-ai-heading').count(),mobile?0:1);
  assert.equal(await page.locator('.home-award').count(),mobile?1:4);
  assert.ok(await page.locator('#latest').isVisible());assert.ok(await noOverflow(page));
  for(const [kind,bot] of [['bots',true],['humans',false]]){
   const people=home.players.filter(p=>p.isBot===bot).sort((a,b)=>b.wins-a.wins||b.matches-a.matches||a.name.localeCompare(b.name,lang));
   assert.deepEqual(await page.locator(`#home-${kind} .home-person-name`).allTextContents(),people.slice(0,mobile?3:12).map(p=>p.name));
   assert.ok((await page.locator(`#home-${kind} .home-shown`).textContent()).includes(String(people.length)));
  }
  const grants=catalog.items.flatMap(a=>a.holders.map(h=>({a,h}))).filter(x=>Number.isFinite(Date.parse(x.h.earnedAt)));
  grants.sort((a,b)=>Date.parse(b.h.earnedAt)-Date.parse(a.h.earnedAt)||a.a.id.localeCompare(b.a.id)||a.h.name.localeCompare(b.h.name));
  for(const [i,{a,h}] of grants.slice(0,mobile?1:4).entries()){
   const card=page.locator('.home-award').nth(i),kind=h.kind||a.audience||'human';
   const earned=catalog.items.filter(item=>(item.audience||'human')===kind&&item.holders.some(p=>p.name===h.name));
   assert.equal(await card.locator('.achievement-mini').count(),earned.length);
   assert.ok(await card.locator('.achievement-mini:not([hidden])').count()>0);
   const link=new URL(await card.locator('.achievement-mini:not([hidden])').first().getAttribute('href'),base);
   assert.equal(link.searchParams.get('awardPlayer'),h.name);assert.equal(link.searchParams.get('view'),'achievements');
  }
  if(mobile){
   assert.equal(await page.locator('#kpis .note,#kpis .kpi-history,#kpis .kpi-killer,#kpis .win-balance').count(),0);
   for(const key of ['allMatches','humanWins','botWins'])assert.equal(await page.locator(`#kpis [data-kpi=${key}] .value`).textContent(),new Intl.NumberFormat(lang).format(home[key==='allMatches'?'matches':key]));
   assert.equal(requests.some(u=>u.includes('/api/online/version')),false);
   assert.ok(!((await page.locator('.compact-latest-meta').textContent()).includes('—')),'Latest duration supplied');
   assert.ok(await page.locator('#latest').evaluate(e=>e.getBoundingClientRect().height<190));
   assert.ok(await page.locator('#kpis').evaluate(e=>e.getBoundingClientRect().height<135));
  }else await page.waitForFunction(()=>document.querySelector('#home-mod-version')?.textContent.includes('Beta'));
  assert.equal(requests.some(u=>/\/api\/(summary|matches|charts)(\/|\?|$)/.test(u)),false,'Home remains lightweight');
  await page.screenshot({path:`${out}/home-${width}.png`,fullPage:true});
  checks.push({home:width,lang,theme,awards:mobile?1:4,roster:mobile?3:12,passed:true});
  if(width===390){
   await page.locator('.home-award .achievement-mini:not([hidden])').first().click();await ready(page);
   assert.ok(await page.locator('.achievement-detail').isVisible());assert.equal(new URL(page.url()).searchParams.get('view'),'achievements');
   await page.locator('.tabs [data-view=home]').click();await ready(page);
   await page.locator('#home-bots .home-section-more>a').click();await ready(page);
   assert.equal(new URL(page.url()).searchParams.get('view'),'bots');
   await page.locator('.tabs [data-view=home]').click();await ready(page);
   await page.setViewportSize({width:1440,height:950});await page.locator('.home-ai-heading').waitFor();await ready(page);
   assert.equal(await page.locator('#home-bots .home-participant').count(),12);
   await page.setViewportSize({width:390,height:950});await page.locator('.home-compact').waitFor();await ready(page);
   assert.equal(await page.locator('#home-bots .home-participant').count(),3);assert.equal(await page.locator('#kpis .kpi').count(),2);
   checks.push({resizeAndLinks:true,passed:true});
  }
  assert.deepEqual(errors,[]);console.log('PASS width '+width);await page.close();
 }
 for(const width of [320,390]){
  const page=await browser.newPage({viewport:{width,height:950},hasTouch:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const route of ['view=rating','view=matches','view=online','view=players','view=bots','view=defeats','view=victims','view=botdefeats','view=dynamics','view=charts','view=achievements','view=about','view=players&profile=pp&kind=human','view=bots&profile=Purri-X&kind=bot','view=matches&match='+latestId]){
   await page.goto(base+'?lang=ru&theme=light&'+route);await ready(page);
   assert.equal(await page.locator('#content>.error').count(),0,route);assert.ok(await noOverflow(page),route+' overflow');
   assert.equal(await page.locator('.tabs [data-view]').count(),12);assert.equal(await page.locator('#shared-shell .overview').isVisible(),false);
   const gap=await page.evaluate(()=>document.querySelector('#content').getBoundingClientRect().top-document.querySelector('.shared-tabs').getBoundingClientRect().bottom);
   assert.ok(gap<=25,route+' no blank overview space');
   if(width===390&&['view=rating','view=matches','view=achievements','view=online'].includes(route))await page.screenshot({path:`${out}/${route.slice(5)}.png`});
   if(route==='view=rating'){
    assert.equal(await page.locator('.rating-explanation').getAttribute('open'),null);
    await page.locator('.rating-explanation>summary').click();await page.waitForURL(/ratingInfo=1/);
    await page.reload();await ready(page);assert.ok(await page.locator('.rating-explanation').evaluate(e=>e.open));
    const sort=page.locator('[data-sort-select=rating_victory]');
    await sort.selectOption('normalWins');await ready(page);assert.equal(new URL(page.url()).searchParams.get('sort_rating_victory'),'normalWins');
   }
   if(width===390&&route==='view=matches'){
    await page.locator('.mobile-filters>summary').click();
    await page.locator('.primary-filters>summary').click();
    await page.locator('#f-map').selectOption('q2duel5');
    await page.locator('#filters button[type=submit]').click();
    await page.waitForFunction(()=>new URL(location.href).searchParams.get('map')==='q2duel5');await ready(page);
    await page.waitForFunction(()=>[...document.querySelectorAll('.match-row .map-name')].every(e=>e.textContent==='q2duel5'));
    await page.locator('#reset').click();await page.waitForFunction(()=>!new URL(location.href).searchParams.has('map'));
   }
   if(width===390&&route==='view=players&profile=pp&kind=human'){
    await page.locator('[data-profile-page="2"]').first().click();
    await page.waitForURL(/profilePage=2/);await ready(page);
    assert.ok(await page.locator('#profile-matches .match-row').count()>0);
   }
   checks.push({width,route,passed:true});
  }
  assert.deepEqual(errors,[]);console.log('PASS width '+width);await page.close();
 }
 await writeFile(out+'/results.json',JSON.stringify({passed:true,checks},null,2));console.log(JSON.stringify({passed:true,checks}));
}finally{await browser.close();}
