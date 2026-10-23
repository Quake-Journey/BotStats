import {testPath} from './support/paths.js';
import {chromium,firefox,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';

const base='http://127.0.0.1:3085/botstats/',dir=testPath();
const matches=(await(await fetch(base+'api/matches')).json()).items;
const summary=await(await fetch(base+'api/summary')).json();
const routes=[...['matches','players','bots','rating','defeats','about'].map(view=>({view})),
  {profile:'q',kind:'human'},{profile:'Purri-X',kind:'bot'},{match:matches[0].id}];
const report={layouts:[],records:[],sorting:[],cache:{}};
async function open(page,query){
  await page.goto(base+'?'+new URLSearchParams(query));
  await page.waitForSelector('#content[aria-busy=false]');
  assert.equal(await page.locator('.error').count(),0,'No load errors');
  assert.doesNotMatch(await page.locator('#content').innerText(),/\b(?:NaN|undefined)\b/,'No invalid rendered values');
}
async function layout(page,label){
  const problems=await page.evaluate(()=>{
    const bad=[];
    if(document.documentElement.scrollWidth>innerWidth+1)bad.push('page overflow');
    for(const el of document.querySelectorAll('.table-wrap, .data-table td, .data-table th, .sort-button, .match-row, .panel, .events, .formula, .guide-columns, .guide-contents')){
      if(el.clientWidth&&el.scrollWidth>el.clientWidth+1)bad.push(`${el.tagName}.${el.className} overflows: ${el.scrollWidth}/${el.clientWidth} ${el.textContent.slice(0,35)}`);
      if(el.clientHeight&&el.scrollHeight>el.clientHeight+1&&['auto','scroll'].includes(getComputedStyle(el).overflowY))bad.push('nested vertical scroll');
    }
    return bad;
  });
  assert.deepEqual(problems,[],label);
  if(page.viewportSize().width>=1920){
    const brand=await page.locator('.brand').boundingBox(),nav=await page.locator('.header-links').boundingBox(),prefs=await page.locator('.preferences').boundingBox();
    assert.ok(nav.x>=brand.x+brand.width&&nav.x+nav.width<=prefs.x,'Links between brand and preferences');
    const tops=await page.locator('.header-links>a,.header-links>button').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return r.y+r.height/2;}));
    assert.ok(Math.max(...tops)-Math.min(...tops)<2,'Desktop links share one row');
  }
  assert.equal(await page.locator('th').count(),await page.locator('th [data-sort-table]').count(),'Every table column is sortable');
  await page.evaluate(()=>scrollTo(0,500));
  assert.ok(Math.abs((await page.locator('.header').boundingBox()).y)<1,'Pinned header');
  await page.evaluate(()=>scrollTo(0,0));
  const untranslated=await page.locator('[data-i18n]').evaluateAll(es=>es.filter(e=>e.textContent===e.dataset.i18n&&e.dataset.i18n!=='theme').map(e=>e.dataset.i18n));
  assert.deepEqual(untranslated,[],label+' translations');
}
for(const [browserName,engine]of Object.entries({chromium,firefox,webkit})){
  const browser=await engine.launch({headless:true});
  try{
    const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.setViewportSize({width:390,height:960});
    await open(page,{lang:'ru',theme:'dark'});
    await page.click('#toggle-links');
    assert.equal(await page.locator('#toggle-links').getAttribute('aria-expanded'),'true');
    assert.equal(await page.locator('#copy-server').isVisible(),true);
    for(const href of ['https://q2pro-x.com/','https://t.me/Q2RTX','https://t.me/Q2PROX','https://t.me/QuakeJourney','quake2://91.227.18.67:27950'])assert.equal(await page.locator(`.header-links a[href="${href}"]`).count(),1);
    for(const width of [320,390,1024,1440,1920]){
      await page.setViewportSize({width,height:960});
      for(const lang of ['ru','en'])for(const theme of ['light','dark']){
        // Every page type in each language/theme; intermediate sizes checked in Chromium.
        if(browserName!=='chromium'&&[320,1024,1920].includes(width))continue;
        for(const route of routes){
          const query={lang,theme,...route};await open(page,query);await layout(page,JSON.stringify({browserName,width,...query}));
          report.layouts.push({browserName,width,...query});
        }
      }
    }
    if(browserName==='chromium'){
      for(const route of [...matches.map(m=>({match:m.id})),...summary.players.map(p=>({profile:p.name,kind:p.isBot?'bot':'human'}))]){
        for(const width of [390,1440]){
          await page.setViewportSize({width,height:960});await open(page,{lang:'ru',theme:'dark',...route});await layout(page,JSON.stringify({width,...route}));report.records.push({width,...route});
        }
      }
      await page.setViewportSize({width:1440,height:1000});
      for(const route of [{view:'bots'},{view:'defeats'},{profile:'q',kind:'human'},{match:matches[0].id}]){
        await open(page,{lang:'ru',theme:'light',...route});
        const columns=await page.locator('[data-sort-table]').evaluateAll(es=>es.map(e=>({table:e.dataset.sortTable,key:e.dataset.sortKey})));
        for(const {table,key}of columns){
          const selector=`[data-sort-table="${table}"][data-sort-key="${key}"]`;
          for(let click=0;click<2;click++){
            const dir=await page.locator(selector).getAttribute('data-sort-dir');
            await page.locator(selector).click();await page.waitForSelector('#content[aria-busy=false]');
            await page.waitForFunction(({table,key,dir})=>{const p=new URLSearchParams(location.search),el=document.querySelector(`[data-sort-table="${table}"][data-sort-key="${key}"]`);return p.get('sort_'+table)===key&&p.get('dir_'+table)===dir&&el?.classList.contains('sorted')&&el.dataset.sortDir!==dir;},{table,key,dir});
            report.sorting.push({table,key,dir});
          }
        }
        const before=await page.locator('.data-table tbody,.match-row').allTextContents(),link=page.url();
        const sizes=await page.locator('.data-table td,.data-table .cell-value,.match-row .person,.match-row .score,.match-row .date,.match-row .badge,.match-row .row-meta').evaluateAll(es=>[...new Set(es.map(e=>getComputedStyle(e).fontSize))]);
        assert.deepEqual(sizes,['16px'],'Uniform table type size');
        const clean=await browser.newPage({viewport:{width:1440,height:1000}});await clean.goto(link);await clean.waitForSelector('#content[aria-busy=false]');assert.deepEqual(await clean.locator('.data-table tbody,.match-row').allTextContents(),before,'Shared sort link');await clean.close();
      }
      for(const [name,query,width]of [
        ['ux-defeats-ru-dark',{view:'defeats',lang:'ru',theme:'dark'},1440],
        ['ux-about-ru-light',{view:'about',lang:'ru',theme:'light'},1440],
        ['ux-about-mobile-en-dark',{view:'about',lang:'en',theme:'dark'},390],
        ['ux-matches-ru-dark',{view:'matches',lang:'ru',theme:'dark'},1440],
        ['ux-rating-en-light',{view:'rating',lang:'en',theme:'light'},1440],
        ['ux-bots-ru-dark',{view:'bots',lang:'ru',theme:'dark'},1920],
        ['ux-profile-ru-light',{profile:'q',kind:'human',lang:'ru',theme:'light'},1440],
        ['ux-match-en-dark',{match:matches[0].id,lang:'en',theme:'dark'},1440],
        ['ux-mobile-ru-light',{view:'matches',lang:'ru',theme:'light'},390],
        ['ux-mobile-profile-en-dark',{profile:'q',kind:'human',lang:'en',theme:'dark'},390],
        ['ux-mobile-detail-ru-light',{match:matches[0].id,lang:'ru',theme:'light'},390]]){
        await page.setViewportSize({width,height:960});await open(page,query);await page.screenshot({path:`${dir}/${name}.png`,fullPage:true});
      }
    }
    assert.deepEqual(errors,[],browserName+' script errors');
  }finally{await browser.close();}
  console.log(browserName+' layouts complete');
}
const currentHTML=await(await fetch(base)).text(),assetRoot=currentHTML.match(/\.\/assets\/[a-f0-9]{20}\//)[0].slice(2);
for(const asset of ['',...['style.css','app.js','tables.js'].map(name=>assetRoot+name)]){
  const response=await fetch(base+asset);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-cache');report.cache[asset]='revalidate';
}
await writeFile(dir+'/ux-checks.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({layouts:report.layouts.length,records:report.records.length,sortClicks:report.sorting.length,cache:report.cache}));
