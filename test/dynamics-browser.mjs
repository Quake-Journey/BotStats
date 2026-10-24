import {chromium,firefox,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {testPath} from './support/paths.js';
const base='http://127.0.0.1:3085/botstats/',dir=testPath('browser');await mkdir(dir,{recursive:true});
const actual=await(await fetch(base+'api/dynamics')).json();assert.ok(actual.totals.matches>0);assert.ok(actual.points.length>1);
async function ready(page){await page.locator('#content[aria-busy=false]').waitFor();assert.equal(await page.locator('.error').count(),0);}
async function overflow(page){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');}
const results=[];
for(const [engineName,engine] of Object.entries({chromium,firefox,webkit})){
  const browser=await engine.launch({headless:true});
  try{for(const width of [1440,360])for(const lang of ['ru','en'])for(const theme of ['dark','light','auto']){
    const page=await browser.newPage({viewport:{width,height:1050},colorScheme:'dark'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const query=`view=dynamics&lang=${lang}&theme=${theme}`;
    await page.goto(base+'?'+query);await ready(page);await page.waitForSelector('.trend-chart svg');
    assert.deepEqual((await page.locator('[data-view]').evaluateAll(es=>es.map(e=>e.dataset.view))).slice(-4),['defeats','botdefeats','dynamics','achievements']);
    assert.equal(await page.locator('.trend-target').count(),actual.points.length);assert.equal(await page.locator('.trend-line').count(),2);
    assert.equal(await page.locator('#f-skill').count(),0);assert.equal(await page.locator('#f-status').count(),0);
    assert.equal(await page.locator('.trend-summary .trend-bot').innerText(),String(actual.totals.botWins));assert.equal(await page.locator('.trend-summary .trend-human').innerText(),String(actual.totals.humanWins));
    await overflow(page);
    if(engineName==='chromium'&&lang==='ru'&&theme!=='auto')await page.screenshot({path:`${dir}/dynamics-${width}-${theme}.png`,fullPage:true});
    await page.locator('.trend-target').first().click();assert.equal(new URL(page.url()).searchParams.get('trendPoint'),actual.points[0].key);
    await page.reload();await ready(page);await page.waitForSelector('.trend-target.selected');assert.equal(await page.locator('.trend-target.selected').getAttribute('data-trend-index'),'0');
    await page.locator('.trend-target').first().focus();await page.keyboard.press('ArrowRight');assert.equal(new URL(page.url()).searchParams.get('trendPoint'),actual.points[1].key);
    const matchLink=new URL(await page.locator('.trend-values a').getAttribute('href'),base);assert.equal(matchLink.searchParams.get('view'),'matches');assert.equal(matchLink.searchParams.get('from'),actual.points[1].from);assert.equal(matchLink.searchParams.get('to'),actual.points[1].to);
    await page.locator('.trend-values a').click();await ready(page);assert.ok(await page.locator('.match-row').count()>0);await overflow(page);
    await page.goto(base+'?'+query);await ready(page);
    await page.locator('.trend-table summary').click();await page.locator('[data-sort-table=dynamics][data-sort-key=bot]').click();await ready(page);
    assert.equal(new URL(page.url()).searchParams.get('sort_dynamics'),'bot');assert.equal(await page.locator('.trend-table').evaluate(e=>e.open),true);
    await page.locator('.primary-filters summary').click();
    await page.locator('#f-period').selectOption('year');await page.waitForFunction(()=>document.querySelectorAll('.trend-target').length>=12&&document.querySelectorAll('.trend-target').length<=13);
    assert.equal(new URL(page.url()).searchParams.get('period'),'year');await overflow(page);
    await page.reload();await ready(page);assert.equal(await page.locator('#f-period').inputValue(),'year');
    await page.locator('#f-period').selectOption('month');await page.waitForFunction(()=>document.querySelectorAll('.trend-target').length===30);await overflow(page);
    if(engineName==='chromium'&&lang==='ru'&&theme==='dark')await page.locator('.trend-panel').screenshot({path:`${dir}/month-${width}.png`});
    const empty={...actual,totals:{botWins:0,humanWins:0,botForfeitWins:0,humanForfeitWins:0,matches:0,forfeits:0,botWinPercent:null},points:[]};
    await page.route('**/api/dynamics?*',r=>r.fulfill({json:empty}));await page.goto(base+'?'+query);await ready(page);assert.equal(await page.locator('.trend-chart').count(),0);assert.ok(await page.locator('#results .empty').isVisible());
    assert.deepEqual(errors,[]);results.push({engineName,width,lang,theme,passed:true});await page.close();console.log(JSON.stringify(results.at(-1)));
  }}finally{await browser.close();}
}
await writeFile(dir+'/results.json',JSON.stringify({passed:true,variants:results.length,results},null,2));console.log(JSON.stringify({passed:true,variants:results.length,dir}));
