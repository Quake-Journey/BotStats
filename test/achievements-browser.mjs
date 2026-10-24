import {chromium,firefox,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {computeAchievements,publicAchievements,achievementDetail,DEFINITIONS} from '../src/achievements.js';
import {collection,game} from './support/achievement-fixtures.js';
import {testPath} from './support/paths.js';
const base='http://127.0.0.1:3085/botstats/',dir=testPath('browser');await mkdir(dir,{recursive:true});
const real=await(await fetch(base+'api/achievements')).json();
assert.ok(real.items.length,'Local recorded games provide actual unlocked awards');
const human=real.items[0].holders[0].name;
const rows=collection().concat(Array.from({length:260},(_,i)=>game(1000+i,{hs:0,bs:10})));
rows.forEach(m=>{if(m.participants[0].name==='Tester')m.participants[0].name=human;});
const index=computeAchievements(rows),catalog=publicAchievements(index);
assert.equal(catalog.items.filter(a=>a.holders.some(p=>p.name===human)).length,24);
const results=[];
async function ready(page){await page.locator('#content[aria-busy="false"]').waitFor();assert.equal(await page.locator('.error').count(),0);}
async function overflow(page,label){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+' horizontal overflow');}
for(const [engineName,engine] of Object.entries({chromium,firefox,webkit}).filter(([name])=>!process.env.BOTSTATS_BROWSER||name===process.env.BOTSTATS_BROWSER)){
  const browser=await engine.launch({headless:true});
  try{
    for(const width of [1440,360])for(const lang of ['ru','en'])for(const theme of ['light','dark','auto']){
      const context=await browser.newContext({viewport:{width,height:1000},colorScheme:'dark'});
      const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
      const suffix=`lang=${lang}&theme=${theme}`;
      await page.goto(base+'?view=achievements&'+suffix);await ready(page);
      assert.equal(await page.locator('[data-view]').last().getAttribute('data-view'),'achievements');
      assert.equal(await page.locator('[data-view]').nth(4).getAttribute('data-view'),'defeats');
      assert.equal(await page.locator('[data-table=achievements] tbody tr').count(),real.items.length);
      await overflow(page,'real awards');
      if(engineName==='chromium'&&lang==='ru'&&theme!=='auto')await page.screenshot({path:`${dir}/real-${width}-${theme}.png`,fullPage:true});
      await page.locator('.achievement-art').first().click();await ready(page);
      assert.equal(await page.locator('.achievement-detail').count(),1);
      await page.locator('[data-table=award_holders] .award-proof-link').first().click();await ready(page);
      assert.ok(await page.locator('.award-evidence tbody tr').count()>0);
      await overflow(page,'real proof');
      await page.locator('[data-table=award_evidence] tbody a').first().click();await ready(page);
      assert.equal(await page.locator('.detail-score').count(),1);await overflow(page,'real match');
      await page.goto(base+'?view=players&profile='+encodeURIComponent(human)+'&kind=human&'+suffix);await ready(page);
      assert.equal(await page.locator('.profile-achievements .achievement-mini').count(),real.items.filter(a=>a.holders.some(p=>p.name===human)).length);
      await overflow(page,'real profile');
      // Expanded fixtures exist only inside this browser context. No database writes.
      await page.route('**/api/achievements',r=>r.fulfill({json:catalog}));
      await page.route('**/api/achievements/*',r=>{const u=new URL(r.request().url()),value=achievementDetail(index,u.pathname.split('/').at(-1),Object.fromEntries(u.searchParams));return r.fulfill({status:value?200:404,json:value||{error:'Not found'}});});
      await page.goto(base+'?view=achievements&'+suffix);await ready(page);
      assert.equal(await page.locator('[data-table=achievements] tbody tr').count(),24);
      await page.locator('.achievement-art img').evaluateAll(async imgs=>{imgs.forEach(i=>i.loading='eager');await Promise.all(imgs.map(i=>i.decode()));});
      assert.ok(await page.locator('.achievement-art img').evaluateAll(imgs=>imgs.every(i=>i.naturalWidth===384)));
      await overflow(page,'24 awards');
      await page.locator('[data-sort-table=achievements][data-sort-key=name]').click();await ready(page);
      assert.equal(new URL(page.url()).searchParams.get('sort_achievements'),'name');
      await page.locator('#achievement-search').fill(human);await page.waitForFunction(name=>new URLSearchParams(location.search).get('achievementSearch')===name,human);await ready(page);
      await page.reload();await ready(page);assert.equal(await page.locator('#achievement-search').inputValue(),human);
      await page.goto(base+'?view=achievements&achievement=farm-owner&awardPlayer='+encodeURIComponent(human)+'&'+suffix);await ready(page);
      assert.equal(await page.locator('.award-evidence tbody tr').count(),20);
      await page.locator('.award-evidence .pagination a').last().click();await ready(page);assert.equal(new URL(page.url()).searchParams.get('awardPage'),'2');
      await page.locator('[data-sort-table=award_evidence][data-sort-key=score]').click();await ready(page);assert.equal(new URL(page.url()).searchParams.get('awardPage'),null);
      await overflow(page,'paginated proof');
      await page.goto(base+'?view=players&profile='+encodeURIComponent(human)+'&kind=human&'+suffix);await ready(page);
      assert.equal(await page.locator('.profile-achievements .achievement-mini').count(),24);
      await page.locator('.profile-achievements img').evaluateAll(imgs=>Promise.all(imgs.map(async i=>{i.loading='eager';await i.decode();})));
      await overflow(page,'24 profile badges');
      if(engineName==='chromium'&&lang==='ru'&&theme==='dark')await page.screenshot({path:`${dir}/profile24-${width}.png`});
      for(const view of ['rating','matches','players','defeats','bots']){
        await page.goto(base+'?view='+view+'&'+suffix);await ready(page);await overflow(page,view);
        assert.equal(await page.locator('a a').count(),0,'No nested clickable badges');
      }
      await page.route('**/api/achievements',r=>r.fulfill({json:{items:[]}}));
      await page.goto(base+'?view=achievements&'+suffix);await ready(page);
      assert.equal(await page.locator('.achievement-empty').count(),1);assert.equal(await page.locator('.achievement-art').count(),0);
      assert.ok(!(await page.locator('#content').innerText()).includes('Дуновение смерти'));
      assert.deepEqual(errors,[]);
      results.push({engineName,width,lang,theme,passed:true});await context.close();
      console.log(JSON.stringify(results.at(-1)));
    }
    if(engineName==='chromium'){
      const page=await browser.newPage({viewport:{width:1400,height:1150}});
      await page.setContent(`<body style="margin:0;background:#111b2e;color:#e5ecf8;font:17px Segoe UI;display:grid;grid-template-columns:repeat(6,1fr);gap:12px;padding:20px">${DEFINITIONS.map(a=>`<div style="text-align:center"><img src="${base}assets/${a.icon}" style="width:190px;height:190px"><div>${a.name.ru}</div></div>`).join('')}</body>`);
      await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
      await page.screenshot({path:dir+'/icon-collection.png',fullPage:true});await page.close();
    }
  }finally{await browser.close();}
}
await writeFile(dir+'/results.json',JSON.stringify({passed:true,contexts:results.length,results},null,2));
console.log(JSON.stringify({passed:true,contexts:results.length,dir}));
