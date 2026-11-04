import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {testPath} from './support/paths.js';
const out=testPath('mobile-header');await mkdir(out,{recursive:true});
const base=process.env.BOTSTATS_BASE_URL||'http://127.0.0.1:3085/botstats/';
const b=await chromium.launch({channel:process.env.BOTSTATS_BROWSER_CHANNEL||'chrome'}),checks=[];
const ready=p=>p.locator('#content[aria-busy=false]').waitFor();
try{
 for(const width of [320,440]){
  const p=await b.newPage({viewport:{width,height:956},hasTouch:true}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  for(const view of ['players','bots','rating','defeats','botdefeats','victims']){
   await p.goto(base+'?view='+view+'&lang=ru&theme=judgment');await ready(p);
   const rows=p.locator('.compact-row');assert.ok(await rows.count()>0);
   const measured=await rows.evaluateAll(els=>els.map(row=>{
    const summary=row.querySelector('summary').getBoundingClientRect(),header=row.querySelector('.compact-identities').getBoundingClientRect();
    return {h:row.getBoundingClientRect().height,dy:Math.abs(summary.y-header.y),gap:summary.x-header.right+parseFloat(getComputedStyle(row.querySelector('.compact-identities')).paddingRight),badges:[...row.querySelectorAll('.compact-identities .achievement-badges')].map(e=>e.getBoundingClientRect().right<=summary.x)};
   }));
   assert.ok(measured.every(r=>r.dy<2&&r.gap>=0&&r.badges.every(Boolean)),view+' header controls do not overlap identity/awards');
   const first=rows.first(),height=(await first.boundingBox()).height;
   await first.locator('summary').click();assert.ok(await first.locator('dl').isVisible());assert.ok((await first.boundingBox()).height>height);
   await first.locator('summary').click();assert.equal(await first.locator('dl').isVisible(),false);
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await p.screenshot({path:out+'/'+view+'-'+width+'.png'});checks.push({width,view,firstHeight:height,passed:true});
  }
  await p.goto(base+'?view=online&lang=ru&theme=judgment');await p.locator('.online-table').waitFor();
  assert.ok(await p.locator('.online-watch-controls').evaluate(e=>e.nextElementSibling.matches('.online-options')));
  assert.equal(await p.locator('.online-options').evaluate(e=>e.open),false);
  assert.ok((await p.locator('.online-table').boundingBox()).y<750);
  await p.screenshot({path:out+'/online-'+width+'.png'});checks.push({width,onlineOptions:true,passed:true});
  await p.goto(base+'?view=charts&lang=ru&theme=judgment');await ready(p);
  await p.locator('.mobile-filters .chart-controls').waitFor({state:'attached'});
  assert.equal(await p.locator('.chart-panel .chart-controls').count(),0);
  assert.equal(await p.locator('#chart-results').isVisible(),false);
  await p.screenshot({path:out+'/charts-'+width+'.png'});
  await p.locator('.mobile-filters>summary').click();await p.locator('#chart-results').selectOption('completed');
  await p.waitForURL(/chartResults=completed/);await p.waitForFunction(()=>!document.querySelector('#results .chart-loading'));
  await p.locator('#chart-scale').selectOption('percent');await p.waitForURL(/chartScale=percent/);
  await p.reload();await ready(p);await p.locator('.mobile-filters #chart-results').waitFor();
  assert.equal(await p.locator('#chart-results').inputValue(),'completed');assert.equal(await p.locator('#chart-scale').inputValue(),'percent');
  assert.equal(await p.locator('#chart-results').count(),1);assert.equal(await p.locator('#chart-scale').count(),1);
  await p.locator('.mobile-filters>summary').click();assert.equal(await p.locator('#chart-results').isVisible(),false);
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));checks.push({width,chartFilters:true,passed:true});
  assert.deepEqual(errors,[]);await p.close();
 }
 const p=await b.newPage({viewport:{width:1440,height:956}});await p.goto(base+'?view=charts&lang=en');await ready(p);
 await p.locator('.chart-panel #chart-results').waitFor();assert.equal(await p.locator('.mobile-filters').count(),0);
 checks.push({desktopChartControls:true,passed:true});await p.close();
 await writeFile(out+'/results.json',JSON.stringify({passed:true,checks},null,2));console.log(JSON.stringify({passed:true,checks}));
}finally{await b.close();}
