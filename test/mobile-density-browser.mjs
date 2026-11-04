import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {testPath} from './support/paths.js';
const base=process.env.BOTSTATS_BASE_URL||'http://127.0.0.1:3085/botstats/';
const out=testPath('mobile-density');await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:process.env.BOTSTATS_BROWSER_CHANNEL||'chrome'}),checks=[];
const ready=p=>p.locator('#content[aria-busy=false]').waitFor();
const capture=async(p,name)=>{
 await p.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&r.bottom>0&&r.top<innerHeight;}).map(e=>e.decode().catch(()=>{})));});
 await p.screenshot({path:out+'/'+name+'.png'});
};
try{
 for(const [width,lang,theme] of [[320,'ru','dark'],[390,'en','light'],[440,'ru','judgment'],[768,'ru','auto'],[1440,'ru','judgment']]){
  const mobile=width<=800,p=await browser.newPage({viewport:{width,height:956},hasTouch:mobile}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  for(const type of ['duration','finished','maps','skill','margin','modes','items','activity']){
   const requests=[],record=r=>requests.push(r.url());p.on('request',record);
   await p.goto(base+`?view=charts&chart=${type}&lang=${lang}&theme=${theme}`);await ready(p);await p.locator('.chart-panel').waitFor();
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),type+' fits screen');
   assert.equal(await p.locator('.chart-error').count(),0);
   const chartRequests=requests.filter(u=>u.includes('/api/charts/')).map(u=>u.split('/api/charts/')[1].split('?')[0]);
   assert.deepEqual([...new Set(chartRequests)],[type],'Only the opened graph is calculated');
   assert.equal(requests.some(u=>/\/api\/(summary|matches)(\?|$)/.test(u)),false,'No unrelated tables loaded');
   if(type==='duration'){
    assert.equal(await p.locator('.chart-bar-row').count(),15);
    if(mobile){
     const row=p.locator('.chart-bar-row').first();assert.ok((await row.boundingBox()).height<=70,'Compact two-line graph row');
     const label=await row.locator('.chart-bar-label').boundingBox(),count=await row.locator('.chart-bar-counts').boundingBox();
     assert.ok(label.x+label.width<=count.x,'Labels and totals do not overlap');
    }
   }
   if(type==='activity')assert.equal(await p.locator('.heat-cell').count(),168);
   if(type==='finished'){
    await p.waitForFunction(()=>{const s=document.querySelector('.finished-chart svg');return s&&Math.abs(s.viewBox.baseVal.width-s.getBoundingClientRect().width)<2;});
    assert.equal(await p.locator('.finished-line').count(),2);
    const height=await p.locator('.finished-chart svg').evaluate(e=>e.viewBox.baseVal.height);assert.equal(height,mobile?220:260);
    await p.locator('#chart-point').selectOption({index:0});await p.waitForURL(/chartPoint=/);await ready(p);
    assert.equal(await p.locator('#chart-point').inputValue(),new URL(p.url()).searchParams.get('chartPoint'));
   }
   if(width===320||width===440)await capture(p,type+'-'+width);
   checks.push({width,chart:type,passed:true});p.off('request',record);
  }
  if(mobile){
   for(const view of ['home','players','bots']){
    const requests=[],record=r=>requests.push(r.url());p.on('request',record);
    await p.goto(base+`?view=${view}&lang=${lang}&theme=${theme}`);await ready(p);
    assert.equal(requests.some(u=>u.includes('/api/charts/')),false,'No graphs calculated on '+view);
    const selector=view==='home'?'.home-participant':'.compact-row',rows=p.locator(selector);
    const heights=await rows.evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height));
    assert.ok(heights.every(h=>h<=100),view+' cards stay compact');
    const name=view==='home'?'.home-person-name':'.compact-identity>a';
    assert.ok((await p.locator(name).evaluateAll(es=>es.map(e=>parseFloat(getComputedStyle(e).fontSize)))).every(n=>n<=14),'Names use the compact mobile size');
    if(view!=='home'){
     await rows.first().locator('summary').click();assert.ok(await rows.first().locator('dl').isVisible());
     assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Expanded details fit');
     await rows.first().locator('summary').click();
    }
    if(width===320||width===440)await capture(p,view+'-'+width);
    checks.push({width,view,maxHeight:Math.max(...heights),passed:true});p.off('request',record);
   }
  }
  await p.goto(base+`?view=dynamics&lang=${lang}&theme=${theme}`);await ready(p);await p.locator('.trend-target').first().waitFor();
  assert.equal(await p.locator('.trend-chart svg').evaluate(e=>e.viewBox.baseVal.height),mobile?240:340);
  await p.locator('.trend-target[tabindex="0"]').focus();await p.keyboard.press('Home');await p.waitForURL(/trendPoint=/);
  assert.equal(await p.locator('.trend-target.selected').getAttribute('data-trend-index'),'0');
  await p.locator('[data-trend-step="1"]').click();assert.equal(await p.locator('.trend-target.selected').getAttribute('data-trend-index'),'1');
  if(width===320||width===440)await capture(p,'dynamics-'+width);
  checks.push({width,view:'dynamics',selection:true,passed:true});
  assert.deepEqual(errors,[]);await p.close();console.log('PASS '+width);
 }
 await writeFile(out+'/results.json',JSON.stringify({passed:true,checks},null,2));console.log(JSON.stringify({passed:true,count:checks.length}));
}finally{await browser.close();}
