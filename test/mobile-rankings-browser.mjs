import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {testPath} from './support/paths.js';
const base=process.env.BOTSTATS_BASE_URL||'http://127.0.0.1:3085/botstats/',out=testPath('mobile-rankings');await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:process.env.BOTSTATS_BROWSER_CHANNEL||'chrome'}),checks=[];
const ready=p=>p.locator('#content[aria-busy=false]').waitFor();
try{
 for(const width of [320,440]){
  const p=await browser.newPage({viewport:{width,height:956},hasTouch:true}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  for(const ranking of ['victory','average','forfeits','activity','maps']){
   await p.goto(base+'?view=rating&lang=ru&theme=judgment&ranking='+ranking);await ready(p);
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await p.locator('.error').count(),0);
   assert.equal(await p.locator('[data-ranking-choice]').inputValue(),ranking);
   const first=p.locator('.compact-row').first();assert.ok((await first.boundingBox()).height<105);
   await first.locator('summary').click();assert.ok(await first.locator('dl').isVisible());
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(ranking==='maps'){
    assert.ok(await first.locator('.completed-average').isVisible(),'Average duration retained in details');
    const mapLink=new URL(await first.locator('.compact-identity>a').getAttribute('href'),base);
    assert.equal(mapLink.searchParams.get('view'),'matches');assert.ok(mapLink.searchParams.get('map'));
   }
   await first.locator('summary').click();await p.screenshot({path:out+'/'+ranking+'-'+width+'.png'});
   if(await p.locator('.map-leaders').count()){
    const leaders=p.locator('.map-leaders');await leaders.scrollIntoViewIfNeeded();
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await p.screenshot({path:out+'/'+ranking+'-leaders-'+width+'.png'});
   }
   checks.push({width,ranking,passed:true});
  }
  assert.deepEqual(errors,[]);await p.close();
 }
 const p=await browser.newPage({viewport:{width:1440,height:956}});
 await p.goto(base+'?view=rating&ranking=maps&lang=ru');await ready(p);
 assert.ok(await p.locator('[data-table=popularity] thead').isVisible());assert.equal(await p.locator('.compact-row').count(),0);await p.close();
 checks.push({width:1440,ranking:'maps',passed:true});
 await writeFile(out+'/results.json',JSON.stringify({passed:true,checks},null,2));console.log(JSON.stringify({passed:true,count:checks.length}));
}finally{await browser.close();}
