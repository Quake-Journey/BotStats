import {chromium,firefox,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {testPath} from './support/paths.js';
const base='http://127.0.0.1:3085/botstats/',dir=testPath('browser');await mkdir(dir,{recursive:true});
const actual=await(await fetch(base+'api/matches?botDefeats=1&sort_matches=margin')).json();
assert.ok(actual.total>0,'Preview data contains human wins');
const results=[];
for(const [engineName,engine]of Object.entries({chromium,firefox,webkit})){
  const browser=await engine.launch({headless:true});
  try{for(const width of [1440,360])for(const lang of ['ru','en'])for(const theme of ['dark','light']){
    const page=await browser.newPage({viewport:{width,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const address=base+'?view=botdefeats&period=all&lang='+lang+'&theme='+theme;
    const ready=async()=>{await page.waitForSelector('#content[aria-busy="false"]');await page.waitForLoadState('networkidle');assert.equal(await page.locator('.error').count(),0);};
    const fits=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
    await page.goto(address);await ready();
    assert.deepEqual((await page.locator('[data-view]').evaluateAll(es=>es.map(e=>e.dataset.view))).slice(-4),['defeats','botdefeats','dynamics','achievements']);
    assert.ok((await page.locator('.defeat-intro h2').innerText()).includes(lang==='ru'?'поражения ботов':'bot defeats'));
    assert.equal(await page.locator('[data-table=botdefeats] tbody tr').count(),actual.items.length);
    const m=actual.items[0],h=m.participants.find(p=>!p.isBot),b=m.participants.find(p=>p.isBot);
    const first=page.locator('[data-table=botdefeats] tbody tr').first();
    assert.ok((await first.innerText()).includes(h.score+' : '+b.score));assert.ok((await first.innerText()).includes(String(h.score-b.score)));await fits();
    if(engineName==='chromium'&&lang==='ru')await page.screenshot({path:`${dir}/bot-defeats-${width}-${theme}.png`,fullPage:true});
    await page.locator('[data-sort-table=botdefeats][data-sort-key=margin]').click();await ready();
    assert.equal(new URL(page.url()).searchParams.get('dir_botdefeats'),'asc');await page.reload();await ready();
    assert.equal(new URL(page.url()).searchParams.get('dir_botdefeats'),'asc');
    assert.equal(await page.locator('[data-sort-table=botdefeats]').count(),8,'Every column is sortable');
    await page.locator('.primary-filters summary').click();
    // A filter refresh does not navigate the page. Wait for its final API request,
    // rather than accepting the previous navigation's already-idle load state.
    const filteredLatest=page.waitForResponse(r=>{const u=new URL(r.url());return u.pathname.endsWith('/api/matches')&&u.searchParams.get('map')==='q2duel5'&&!u.searchParams.has('sort_matches');});
    await page.locator('#f-map').selectOption('q2duel5');await(await filteredLatest).finished();await ready();
    assert.equal(new URL(page.url()).searchParams.get('map'),'q2duel5');await fits();
    await page.goto(address+'&status=forfeit');await ready();assert.equal(await page.locator('[data-table=botdefeats]').count(),0);assert.ok(await page.locator('#results .empty').isVisible());
    await page.goto(base+'?view=defeats&lang='+lang);await ready();assert.ok((await page.locator('.defeat-intro h2').innerText()).includes(lang==='ru'?'поражения людей':'human defeats'));await fits();
    assert.deepEqual(errors,[],`${engineName} ${width} ${lang} ${theme}`);results.push({engineName,width,lang,theme});await page.close();
  }}finally{await browser.close();}
}
await writeFile(dir+'/results.json',JSON.stringify({passed:true,contexts:results.length,results},null,2));console.log(JSON.stringify({passed:true,contexts:results.length,dir}));
