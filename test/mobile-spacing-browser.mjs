import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {testPath} from './support/paths.js';
const base=process.env.BOTSTATS_BASE_URL||'http://127.0.0.1:3085/botstats/',out=testPath('mobile-spacing');await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:process.env.BOTSTATS_BROWSER_CHANNEL||'chrome'}),checks=[];
const latest=(await(await fetch(base+'api/home')).json()).latest.id;
const catalog=await(await fetch(base+'api/achievements')).json();
const routes=[...['home','rating','matches','online','players','bots','defeats','victims','botdefeats','dynamics','charts','achievements','about'].map(view=>[view,'view='+view]),['human','view=players&profile=pp&kind=human'],['bot','view=bots&profile=Purri-X&kind=bot'],['match','view=matches&match='+latest],['award','view=achievements&achievement='+catalog.items[0].id]];
const ready=p=>p.locator('#content[aria-busy=false]').waitFor();
const images=async p=>p.evaluate(async()=>{await document.fonts.ready;const visible=[...document.images].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&r.bottom>0&&r.top<innerHeight;});await Promise.all(visible.map(e=>e.decode().catch(()=>{})));return visible.filter(e=>!e.naturalWidth).map(e=>e.src);});
try{
 for(const [width,lang,theme] of [[320,'ru','dark'],[390,'en','light'],[440,'ru','judgment'],[768,'ru','auto']]){
  const p=await browser.newPage({viewport:{width,height:956},hasTouch:true}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  for(const [id,route] of routes){
   await p.goto(base+'?lang='+lang+'&theme='+theme+'&'+route);await ready(p);
   assert.equal(await p.locator('#content>.error,#results>.error').count(),0,id);
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),id+' horizontal overflow');
   assert.equal(await p.locator('.tabs [data-view]').count(),12);
   const data={width,id};
   if(['victims','defeats','botdefeats','bots','rating','players'].includes(id)){
    const gap=await p.evaluate(()=>{
     const intro=document.querySelector('.defeat-intro,.ranking-intro'),last=intro.querySelector('summary')||intro.querySelector('h2');
     return document.querySelector('.compact-sort').getBoundingClientRect().top-last.getBoundingClientRect().bottom;
    });assert.ok(gap>=0&&gap<=12,id+' accumulated blank space: '+gap);data.introGap=gap;
    if(width===440)assert.ok((await p.locator('.compact-row').first().boundingBox()).y<450,id+' first result without excessive preamble');
   }
   if(['human','bot'].includes(id)){
    assert.equal(await p.locator('.profile-filters').evaluate(e=>e.open),false);
    assert.ok((await p.locator('.profile-achievements').boundingBox()).height<180,'Awards cannot consume a screen');
    assert.ok((await p.locator('#content>.kpis').boundingBox()).y<650,'Profile statistics on first screen');
    assert.equal(await p.locator('.profile-achievements .achievement-mini').count(),await p.locator('.profile-achievements .achievement-mini:visible').count(),'All profile awards retained');
    if(width===440){
     await p.locator('.profile-filters>summary').click();await p.waitForURL(/profileFilters=1/);
     await p.locator('#f-period').selectOption('week');await ready(p);
     assert.equal(await p.locator('.profile-filters').evaluate(e=>e.open),true);assert.equal(new URL(p.url()).searchParams.get('period'),'week');
     await p.reload();await ready(p);assert.equal(await p.locator('#f-period').inputValue(),'week');
     await p.locator('#f-period').selectOption('all');await ready(p);await p.locator('.profile-filters>summary').click();
    }
   }
   if(id==='charts'){
    assert.equal(await p.locator('.chart-chooser').evaluate(e=>e.open),false);
    assert.ok(await p.locator('.chart-chooser>summary').isVisible());
    assert.equal(await p.locator('.chart-explanation').evaluate(e=>e.open),false);
    assert.ok((await p.locator('.chart-bar-row').first().boundingBox()).y<650,'Chart begins on first screen');
    await p.locator('.chart-explanation>summary').click();assert.ok(await p.locator('.chart-note').isVisible());await p.locator('.chart-explanation>summary').click();
   }
   if(id==='dynamics'){
    const cards=await p.locator('.trend-stat').evaluateAll(els=>els.map(e=>e.getBoundingClientRect().y));assert.equal(new Set(cards).size,1,'No unused grid cell');
    assert.ok((await p.locator('.trend-panel').boundingBox()).y<600,'Chart not pushed out by summary');
   }
   assert.deepEqual(await images(p),[],id+' visible broken image');
   if(width===440||width===320&&['victims','human','charts','dynamics'].includes(id))await p.screenshot({path:out+'/'+id+'-'+width+'.png'});
   if(['victims','defeats','botdefeats'].includes(id)){const info=p.locator('.victim-rules,.section-info').first();await info.locator('summary').click();assert.ok(await info.locator('p').isVisible());}
   checks.push({...data,passed:true});
  }
  assert.deepEqual(errors,[]);await p.close();console.log('PASS '+width);
 }
 const p=await browser.newPage({viewport:{width:1440,height:956}});
 for(const view of ['victims','charts']){
  await p.goto(base+'?lang=ru&theme=dark&view='+view);await ready(p);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(view==='victims'){assert.ok(await p.locator('.defeat-intro>p').isVisible());assert.ok(await p.locator('.data-table thead').isVisible());}
  else{assert.equal(await p.locator('.chart-explanation').count(),0);assert.ok(await p.locator('.chart-note').isVisible());}
  checks.push({width:1440,id:view,passed:true});
 }await p.close();await writeFile(out+'/results.json',JSON.stringify({passed:true,checks},null,2));console.log(JSON.stringify({passed:true,count:checks.length}));
}finally{await browser.close();}
