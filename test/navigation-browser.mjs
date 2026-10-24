import {chromium,firefox,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {testPath} from './support/paths.js';

const base=process.env.BOTSTATS_BASE_URL||'http://127.0.0.1:3085/botstats/';
const dir=testPath('navigation');await mkdir(dir,{recursive:true});
const ready=page=>page.waitForSelector('#content[aria-busy=false]');
const query=page=>new URL(page.url()).searchParams;
const results=[];

async function checkLinks(page,expected={}){
  const links=await page.locator('a[href]').evaluateAll(anchors=>anchors.map(a=>({href:a.href,raw:a.getAttribute('href'),route:a.dataset.route})));
  const current=new URL(page.url());let count=0;
  for(const a of links){
    const u=new URL(a.href);
    if(u.origin!==current.origin||![new URL(base).pathname,new URL(base).pathname+'about'].includes(u.pathname)||a.raw.startsWith('#'))continue;
    assert.ok(a.route,'Internal navigation must carry its destination: '+a.href);
    for(const key of ['theme','lang'])assert.equal(u.searchParams.get(key),current.searchParams.get(key),key+' on '+a.href);
    const {extra,options}=JSON.parse(a.route);
    for(const [key,value] of Object.entries(expected))if(!options.home&&!Object.hasOwn(extra,key))assert.equal(u.searchParams.get(key),value,key+' on '+a.href);
    count++;
  }
  assert.ok(count>1,'Navigation links were inspected');
}
async function headerQuery(page,expected){
  for(const selector of ['#about-link','[data-view=players]']){
    const u=new URL(await page.locator(selector).getAttribute('href'),base);
    for(const [k,v]of Object.entries(expected))assert.equal(u.searchParams.get(k),v,selector+' '+k);
  }
  await checkLinks(page,expected);
}

for(const [engineName,engine]of Object.entries({chromium,firefox,webkit})){
  const browser=await engine.launch({headless:true});
  try{for(const width of [1440,390])for(const lang of ['ru','en']){
    const context=await browser.newContext({viewport:{width,height:1000},colorScheme:'dark'}),page=await context.newPage(),errors=[],externalWarnings=[];
    const recordError=text=>{
      // Local antivirus injects its own blocked script. Record it separately;
      // application failures and every other CSP error still fail the check.
      if(text.includes('Content-Security-Policy:')&&text.includes('http://ff.kis.v2.scr.kaspersky-labs.com/')&&text.includes("script-src 'self'"))externalWarnings.push(text);else errors.push(text);
    };
    page.on('pageerror',e=>recordError(e.message));
    page.on('console',e=>{if(e.type()==='error')recordError(e.text());});
    // The exact reported failure: preference change followed by an existing link.
    await page.goto(base+`?lang=${lang}&theme=auto`);await ready(page);
    const external=await page.locator('a[href^="https:"],a[href^="quake2:"]').evaluateAll(es=>es.map(e=>e.href));
    await page.selectOption('#theme','light');await checkLinks(page);
    assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
    assert.deepEqual(await page.locator('a[href^="https:"],a[href^="quake2:"]').evaluateAll(es=>es.map(e=>e.href)),external);
    if(!await page.locator('#about-link').isVisible())await page.locator('#toggle-links').click();
    await page.locator('#about-link').click();await ready(page);
    assert.equal(query(page).get('theme'),'light');assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
    await page.locator('.guide-contents a[href="#difficulty"]').click();
    await page.selectOption('#theme','dark');assert.equal(new URL(page.url()).hash,'#difficulty');await checkLinks(page);
    await page.locator('.back').click();await ready(page);assert.equal(query(page).get('theme'),'dark');
    // Real modified click: the href itself must be current, not only a click handler.
    await page.selectOption('#theme','light');
    const [tab]=await Promise.all([context.waitForEvent('page'),page.locator('[data-view=matches]').click({modifiers:['Control']})]);
    await ready(tab);assert.equal(query(tab).get('theme'),'light');assert.equal(query(tab).get('view'),'matches');await tab.close();

    // Previously stale header/tab links after filters, sorting and filter disclosure.
    await page.goto(base+`?lang=${lang}&theme=auto&view=matches&filters=1`);await ready(page);
    await page.selectOption('#f-map','q2duel5');await headerQuery(page,{map:'q2duel5',filters:'1'});
    await page.selectOption('#f-period','month');await headerQuery(page,{period:'month',map:'q2duel5'});
    await page.fill('#f-q','pp');await page.locator('#filters button[type=submit]').click();await headerQuery(page,{q:'pp'});
    await page.selectOption('#f-map','');await headerQuery(page,{map:null});
    await page.locator('.primary-filters summary').click();
    await page.waitForFunction(()=>new URLSearchParams(location.search).get('filters')==='0');await headerQuery(page,{filters:'0'});
    await page.locator('#reset').click();await ready(page);await headerQuery(page,{map:null,q:null,period:null});
    await page.locator('[data-sort-table=matches][data-sort-key=duration]').click();
    await page.waitForFunction(()=>new URLSearchParams(location.search).get('sort_matches')==='duration');
    await headerQuery(page,{sort_matches:'duration'});
    // A copied URL in a new browser context reproduces all explicit preferences/state.
    const shared=page.url(),fresh=await browser.newContext({viewport:{width,height:1000},colorScheme:'light'}),other=await fresh.newPage();
    await other.goto(shared);await ready(other);assert.equal(query(other).get('sort_matches'),'duration');await checkLinks(other);await fresh.close();

    // History restores both the address and rendered state, not stale controls.
    await page.goto(base+`?lang=${lang}&theme=light&view=matches`);await ready(page);
    await page.locator('[data-view=players]').click();await ready(page);
    const otherLang=lang==='ru'?'en':'ru';await page.selectOption('#language',otherLang);await ready(page);await page.selectOption('#theme','dark');
    await page.goBack();await ready(page);assert.equal(query(page).get('view'),'matches');assert.equal(await page.locator('#theme').inputValue(),'light');assert.equal(await page.locator('#language').inputValue(),lang);await checkLinks(page);
    await page.goForward();await ready(page);assert.equal(query(page).get('view'),'players');assert.equal(await page.locator('#theme').inputValue(),'dark');assert.equal(await page.locator('#language').inputValue(),otherLang);await checkLinks(page);
    await page.reload();await ready(page);assert.equal(await page.locator('#language').inputValue(),otherLang);assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');

    // Every view uses the same route builder, including dynamically mounted links.
    for(const view of ['rating','matches','players','bots','defeats','botdefeats','dynamics','achievements']){
      await page.goto(base+`?view=${view}&lang=${lang}&theme=auto`);await ready(page);
      await page.selectOption('#theme','light');await checkLinks(page);
      await page.selectOption('#language',otherLang);await ready(page);await checkLinks(page);
      await page.selectOption('#theme','auto');await page.emulateMedia({colorScheme:'light'});await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
      await page.emulateMedia({colorScheme:'dark'});await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');await checkLinks(page);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No page overflow: '+view);
    }
    // Match controls update existing back/profile/about links; download URLs stay intact.
    await page.goto(base+`?view=matches&lang=${lang}&theme=auto`);await ready(page);
    await page.locator('.match-row .score-link').first().click();await ready(page);
    const download=await page.locator('.download').getAttribute('href');
    await page.locator('[data-weapon-player="1"]').click();await checkLinks(page,{weapon:'1'});
    await page.locator('.pickup-details summary').click();await page.waitForFunction(()=>new URLSearchParams(location.search).get('pickups')==='1');await checkLinks(page,{weapon:'1',pickups:'1'});
    await page.selectOption('#theme','light');await checkLinks(page);assert.equal(await page.locator('.download').getAttribute('href'),download);
    // Profile, achievement details and graph dates retain their own destinations.
    await page.goto(base+`?view=rating&lang=${lang}&theme=auto`);await ready(page);
    await page.locator('#results a[href*="profile="]').first().click();await ready(page);
    await page.selectOption('#theme','light');await checkLinks(page);
    await page.goto(base+`?view=achievements&lang=${lang}&theme=auto`);await ready(page);
    await page.locator('.achievement-caption h2 a').first().click();await ready(page);await page.selectOption('#theme','light');await checkLinks(page);
    await page.goto(base+`?view=dynamics&lang=${lang}&theme=auto`);await ready(page);await page.waitForSelector('#trend-detail a');
    const periodLink=new URL(await page.locator('#trend-detail a').getAttribute('href'),base),dates=['from','to'].map(k=>periodLink.searchParams.get(k));
    await page.selectOption('#theme','light');await checkLinks(page);
    const updated=new URL(await page.locator('#trend-detail a').getAttribute('href'),base);assert.deepEqual(['from','to'].map(k=>updated.searchParams.get(k)),dates);assert.equal(updated.searchParams.get('period'),'custom');assert.equal(updated.searchParams.get('theme'),'light');
    if(engineName==='chromium'&&lang==='ru')await page.screenshot({path:`${dir}/${width}.png`,fullPage:true});
    assert.deepEqual(errors,[]);results.push({engineName,width,lang,passed:true,externalWarnings});console.log(JSON.stringify(results.at(-1)));await context.close();
  }}finally{await browser.close();}
}
await writeFile(dir+'/results.json',JSON.stringify({passed:true,contexts:results.length,results},null,2));
console.log(JSON.stringify({passed:true,contexts:results.length,dir}));
