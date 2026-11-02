import {chromium,firefox,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const root='O:/Claude2/_agent_temp/botstats_charts_20261102',base='http://127.0.0.1:3085/botstats/';await mkdir(root+'/browser',{recursive:true});
const types=['duration','finished','maps','skill','margin','modes','items','activity'];
const checks=[];
async function ready(page){await page.locator('#content[aria-busy=false]').waitFor();assert.equal(await page.locator('.error,.chart-error').count(),0);}
async function noOverflow(page){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No page overflow');}
for(const [name,engine,width,lang,theme] of [['chromium',chromium,1440,'ru','dark'],['chromium',chromium,390,'ru','judgment'],['firefox',firefox,390,'en','light'],['webkit',webkit,320,'ru','judgment']]){
  const browser=await engine.launch({headless:true});
  try{for(const chart of types){
    console.log(name,width,chart);
    const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),errors=[],requests=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});page.on('request',r=>requests.push(r.url()));
    await page.goto(base+'?view=charts&chart='+chart+'&lang='+lang+'&theme='+theme);await ready(page);await page.waitForSelector('.chart-panel');
    if(theme==='judgment')await page.waitForSelector('#judgment-scene[data-bot-share]');
    await noOverflow(page);assert.deepEqual(errors,[]);
    const requested= requests.filter(u=>u.includes('/api/charts/')).map(u=>u.split('/api/charts/')[1].split('?')[0]);
    assert.deepEqual([...new Set(requested)].sort(),[chart]);
    assert.equal(requests.some(u=>/\/api\/(summary|matches)(\?|$)/.test(u)),false,'Charts do not preload rankings or match lists');
    if(chart==='duration')assert.equal(await page.locator('.chart-bar-row').count(),15);
    if(chart==='activity')assert.equal(await page.locator('.heat-cell').count(),168);
    if(chart==='finished'){assert.equal(await page.locator('.finished-line').count(),2);assert.equal(await page.locator('.legend-forfeit').count(),0);await page.waitForFunction(()=>{const el=document.querySelector('.finished-chart svg');return el&&Math.abs(el.viewBox.baseVal.width-el.getBoundingClientRect().width)<2;});}
    if(width<=390)assert.equal(await page.locator('.chart-chooser').evaluate(el=>el.open),false);
    if(name==='chromium')await page.screenshot({path:`${root}/browser/${name}-${width}-${chart}.png`,fullPage:true});
    checks.push({name,width,lang,theme,chart,passed:true});await context.close();
  }}finally{await browser.close();}
}
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),requests=[];page.on('request',r=>requests.push(r.url()));
  await page.goto(base+'?view=rating&theme=auto&lang=ru');await ready(page);
  assert.equal(requests.some(u=>u.includes('/api/charts/')||u.includes('charts-ui.js')||u.includes('judgment-theme.js')||u.includes('/themes/judgment/')),false,'Ordinary page has zero chart/theme costs');
  await page.locator('#theme').selectOption('judgment');await page.waitForSelector('#judgment-scene[data-bot-share]');
  assert.equal(new URL(page.url()).searchParams.get('theme'),'judgment');assert.ok(Number(await page.locator('#judgment-scene').getAttribute('data-bot-share'))>.8);
  const preferenceLink=new URL(await page.locator('[data-view=charts]').getAttribute('href'),base);assert.equal(preferenceLink.searchParams.get('theme'),'judgment');
  await page.locator('[data-view=charts]').click();await ready(page);await page.waitForSelector('.chart-panel');
  await page.locator('#chart-results').selectOption('completed');await page.waitForFunction(()=>document.querySelector('#count').textContent.includes('263'));assert.equal(await page.locator('.chart-segment.forfeit').count(),0);
  await page.locator('#chart-scale').selectOption('percent');await page.waitForFunction(()=>new URL(location.href).searchParams.get('chartScale')==='percent');
  const before=requests.filter(u=>u.includes('/api/charts/duration')).length;
  await page.locator('.chart-segment.human').first().click();await page.waitForSelector('.chart-drill-title');assert.ok(await page.locator('.chart-drill-list .match-row').count()>0);
  assert.equal(requests.filter(u=>u.includes('/api/charts/duration')).length,before,'Scale and drilldown reuse opened aggregate');
  const url=page.url();await page.reload();await ready(page);await page.waitForSelector('.chart-drill-title');assert.equal(page.url(),url);
  await page.setViewportSize({width:390,height:900});await page.waitForFunction(()=>!document.querySelector('.chart-chooser').open);
  await page.setViewportSize({width:1440,height:1000});await page.waitForFunction(()=>document.querySelector('.chart-chooser').open);assert.equal(await page.locator('.chart-picker a:visible').count(),8);
  await page.locator('#theme').selectOption('light');await page.waitForFunction(()=>!document.getElementById('judgment-scene'));assert.equal(new URL(page.url()).searchParams.get('theme'),'light');
  for(const v of [0,.5,1]){
    await page.route('**/api/home?*',async route=>{const response=await route.fetch(),data=await response.json();await route.fulfill({json:{...data,humanWins:(1-v)*10,botWins:v*10}});});
    await page.goto(base+'?view=charts&chart=maps&theme=judgment');await ready(page);await page.waitForSelector('#judgment-scene[data-bot-share]');assert.equal(Number(await page.locator('#judgment-scene').getAttribute('data-bot-share')),v);
    await page.waitForFunction(expected=>Math.abs(Number(getComputedStyle(document.querySelector('.judgment-machines')).opacity)-expected)<.001,v);
    await page.screenshot({path:`${root}/browser/theme-bots-${v*100}.png`,fullPage:false});await page.unroute('**/api/home?*');
  }
  checks.push({navigationLazyLoadingDrilldownThemeExtremes:true,passed:true});await page.close();
}finally{await browser.close();}
await writeFile(root+'/browser/checks.json',JSON.stringify({passed:true,checks},null,2));console.log(JSON.stringify({passed:true,cases:checks.length}));
