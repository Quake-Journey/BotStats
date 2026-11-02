import {chromium,firefox,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {testPath} from './support/paths.js';
const base=process.env.BOTSTATS_BASE_URL||'http://127.0.0.1:3085/botstats/',out=testPath('home-browser');await mkdir(out,{recursive:true});
const checks=[];
for(const [engineName,engine] of Object.entries({chromium,firefox,webkit})){
  const browser=await engine.launch();
  try{for(const [width,theme,lang] of [[2560,'judgment','ru'],[1440,'light','en'],[390,'judgment','ru'],[320,'dark','en']]){
    console.log(engineName,width,theme);const page=await browser.newPage({viewport:{width,height:1000}}),errors=[],requests=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});page.on('request',r=>requests.push(r.url()));
    await page.goto(base+`?theme=${theme}&lang=${lang}`);await page.locator('#content[aria-busy=false]').waitFor();await page.locator('.home-page').waitFor();
    assert.deepEqual(errors,[]);assert.equal(await page.locator('.data-table').count(),0,'Home has no rating table');
    assert.equal(requests.filter(u=>u.includes('/api/home')).length,1);
    assert.equal(requests.some(u=>/\/api\/(summary|matches|facets|charts)(\/|\?|$)/.test(u)),false,'Home does not calculate rankings or charts, or duplicate theme counts');
    assert.equal(await page.locator('#judgment-caption').count(),0);
    if(theme==='judgment'){
      await page.waitForSelector('#judgment-scene[data-bot-share]');
    }
    assert.equal(await page.locator('.home-directory,.home-section-link').count(),0);
    for(const kind of ['bots','humans']){
      const wins=await page.locator('#home-'+kind+' .home-participant').evaluateAll(els=>els.map(e=>Number(e.dataset.wins)));
      assert.ok(wins.every((n,i)=>!i||wins[i-1]>=n));
      assert.ok(await page.locator('#home-'+kind+' .achievement-mini:not([hidden])').count()>0);
    }
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    // WebKit screenshot helpers inject inline CSS despite caret:'initial'.
    // Keep security/error checks strict and capture visuals with the other engines.
    if(engineName!=='webkit')await page.screenshot({path:`${out}/${engineName}-${width}.png`,fullPage:false,caret:'initial'});
    const chart=page.locator('[data-view=charts]');
    await chart.click();await page.locator('.chart-panel').waitFor();assert.equal(await page.locator('#judgment-caption').count(),0);
    assert.equal(await page.locator('.home-page').count(),0);assert.ok(await page.evaluate(()=>document.querySelector('.workspace').getBoundingClientRect().top>=document.querySelector('#shared-shell').getBoundingClientRect().bottom),'Inner content follows the common overview');
    await page.locator('[data-view=home]').click();await page.locator('.home-page').waitFor();await page.locator('#content[aria-busy=false]').waitFor();
    assert.equal(new URL(page.url()).searchParams.get('chart'),null,'Home navigation resets section-only state');
    assert.equal(await page.locator('#judgment-caption').count(),0);
    assert.deepEqual(errors,[]);checks.push({engineName,width,theme,lang,passed:true});await page.close();
  }}finally{await browser.close();}
}
const browser=await chromium.launch();
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  for(const route of ['view=rating','view=matches','view=players','view=bots','view=defeats','view=victims','view=botdefeats','view=dynamics','view=achievements','profile=pp&kind=human','view=online']){
    await page.goto(base+'?theme=judgment&lang=ru&'+route);await page.locator('#content[aria-busy=false]').waitFor();assert.equal(await page.locator('#judgment-caption').count(),0,route);
  }
  await page.goto(base+'?theme=judgment');await page.locator('.home-page').waitFor();await page.locator('#theme').selectOption('light');await page.waitForFunction(()=>!document.getElementById('judgment-caption'));
  await page.locator('#theme').selectOption('judgment');await page.waitForSelector('#judgment-scene[data-bot-share]');
  assert.equal(new URL(page.url()).searchParams.get('theme'),'judgment');
  checks.push({innerRoutesAndThemeToggle:true,passed:true});
}finally{await browser.close();}
await writeFile(out+'/checks.json',JSON.stringify({passed:true,checks},null,2));console.log(JSON.stringify({passed:true,cases:checks.length}));
