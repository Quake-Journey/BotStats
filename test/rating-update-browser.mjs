import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,firefox,webkit} from 'playwright';
import {testPath} from './support/paths.js';
const base=process.env.BOTSTATS_BASE_URL||'http://127.0.0.1:3085/botstats/';
const dir=testPath('rating-update-browser');await mkdir(dir,{recursive:true});
const summary=await(await fetch(base+'api/summary')).json(),victims=await(await fetch(base+'api/victims')).json();
assert.ok(summary.players.some(p=>!p.isBot&&p.performance));assert.ok(victims.items.some(p=>p.averageBotSkill!==null));
const runs=[],errors=[];
for(const [engineName,engine]of Object.entries({chromium,firefox,webkit})){
  const browser=await engine.launch({headless:true});
  try{for(const width of [1440,390]){
    const lang=width===390?'en':'ru',theme=width===390?'light':'dark';
    const context=await browser.newContext({viewport:{width,height:960}}),page=await context.newPage();
    page.on('pageerror',e=>errors.push(e.message));
    const ready=async()=>{await page.locator('#content[aria-busy=false]').waitFor();assert.equal(await page.locator('.error').count(),0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));};
    const go=async extra=>{await page.goto(base+'?lang='+lang+'&theme='+theme+'&'+extra);await ready();};
    await go('view=rating');assert.equal(await page.locator('.overview-fold[open]').count(),2,'Homepage expanded');
    await go('view=rating&ranking=average');
    assert.equal(await page.locator('.overview-fold[open]').count(),width===390?0:2,'Internal mobile overview collapsed');
    if(summary.players.some(p=>p.name==='pp'&&p.performance?.games>=10)){
      assert.ok((await page.locator('[data-table=rating_average] tbody tr').first().innerText()).includes('pp'));
    }
    for(const table of await page.locator('table[data-table^=rating_average]').all()){
      for(const button of await table.locator('thead button').all()){
        const id=await button.getAttribute('data-sort-table'),key=await button.getAttribute('data-sort-key');
        await button.click();await ready();assert.equal(new URL(page.url()).searchParams.get('sort_'+id),key);
      }
    }
    await page.screenshot({path:dir+`/${engineName}-${width}-average.png`,fullPage:true});
    await go('view=rating&ranking=forfeits&status=forfeit');
    const pp=summary.players.find(p=>p.name==='pp');
    if(pp){const row=page.locator('[data-table=rating_forfeits] tbody tr').filter({has:page.getByRole('link',{name:'pp',exact:true})});assert.ok((await row.innerText()).includes(new Intl.NumberFormat(lang,{maximumFractionDigits:2}).format(pp.forfeitRate)));}
    assert.equal(await page.locator('#f-status').count(),0);
    for(const key of ['name','forfeitRate','forfeits','finished','normalMatches']){await page.locator(`[data-sort-table=rating_forfeits][data-sort-key=${key}]`).click();await ready();}
    await go('view=victims');
    assert.ok(await page.locator('[data-sort-key=averageBotSkill]').count()>0);
    await page.locator('[data-sort-key=averageBotSkill]').click();await ready();assert.equal(new URL(page.url()).searchParams.get('sort_victims'),'averageBotSkill');
    if(width===390){
      assert.equal(await page.locator('#latest').isVisible(),false);assert.equal(await page.locator('#kpis').isVisible(),false);
      await page.locator('[data-overview=overviewLatest] summary').click();await page.waitForFunction(()=>new URL(location.href).searchParams.get('overviewLatest')==='1');assert.equal(await page.locator('#latest').isVisible(),true);
      await page.reload();await ready();assert.equal(await page.locator('#latest').isVisible(),true);assert.equal(await page.locator('#kpis').isVisible(),false);
      await page.setViewportSize({width:1440,height:960});await page.waitForFunction(()=>document.querySelectorAll('.overview-fold[open]').length===2);
      await page.setViewportSize({width,height:960});await page.waitForFunction(()=>!document.querySelector('[data-overview=overviewStats]').open);
      await page.locator('[data-overview=overviewLatest] summary').click();await page.waitForFunction(()=>!document.querySelector('[data-overview=overviewLatest]').open);
    }
    await page.screenshot({path:dir+`/${engineName}-${width}-victims.png`,fullPage:true});
    const profile=summary.players.find(p=>!p.isBot&&p.performance.games>0).name;
    await go('view=players&kind=human&profile='+encodeURIComponent(profile));assert.ok(await page.locator('[data-table=profile] [data-sort-key=performance]').count()>0);
    await page.goto(base+'about?lang='+lang+'&theme='+theme);await ready();assert.equal(await page.locator('#performance').count(),1);assert.ok(!(await page.locator('#content').innerText()).includes('−5'));
    runs.push({engine:engineName,width,lang,theme,passed:true});await context.close();
  }}finally{await browser.close();}
}
assert.deepEqual(errors,[]);await writeFile(dir+'/results.json',JSON.stringify({passed:true,runs},null,2));console.log(JSON.stringify({passed:true,runs: runs.length,evidence:dir}));
