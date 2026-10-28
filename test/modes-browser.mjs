import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,firefox,webkit} from 'playwright';
import {testPath} from './support/paths.js';

const base=process.env.BOTSTATS_BASE_URL||'http://127.0.0.1:3085/botstats/';
const dir=testPath('modes-browser');await mkdir(dir,{recursive:true});
const result=await(await fetch(base+'api/matches?q='+encodeURIComponent('Пример'))).json();
assert.equal(result.total,6,'Use the isolated modes preview, never production');
const both=result.items.find(m=>m.participants[0].name==='Пример Оба режима');
const changed=result.items.find(m=>m.participants[0].name==='Пример Смена режимов');
const old=result.items.find(m=>m.participants[0].name==='Пример Старый формат');
const errors=[],runs=[];
for(const [engineName,engine]of Object.entries({chromium,firefox,webkit})){
  const browser=await engine.launch({headless:true});
  try{for(const width of [1440,390]){
    const lang=width===1440?'ru':'en',theme=width===1440?'dark':'light';
    const context=await browser.newContext({viewport:{width,height:960}}),page=await context.newPage();
    page.on('pageerror',e=>errors.push(`${engineName}: ${e.message}`));
    const ready=async()=>{await page.locator('#content[aria-busy=false]').waitFor();assert.equal(await page.locator('.error').count(),0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal document overflow');};
    const go=async(query)=>{await page.goto(base+'?'+new URLSearchParams({lang,theme,...query}));await ready();};
    for(const view of ['rating','matches','defeats','botdefeats']){
      await go({view,q:'Пример'});
      assert.equal(await page.locator('#latest .match-modes [data-mode]').count(),2);
      const rows=view==='matches'?page.locator('.match-row'):page.locator(`table[data-table=${view}] tbody tr`);
      if(view!=='rating')for(const row of await rows.all())assert.equal(await row.locator('.match-modes [data-mode]').count(),2);
      if(view==='matches'){
        const before=await page.locator('.match-row').count();
        await page.locator('[data-sort-table=matches][data-sort-key=score]').click();await ready();
        assert.equal(new URL(page.url()).searchParams.get('sort_matches'),'score');assert.equal(await page.locator('.match-row').count(),before);
        await page.screenshot({path:dir+`/${engineName}-${width}-matches.png`,fullPage:true});
      }
    }
    await go({match:both.id});assert.equal(await page.locator('.modes-panel .mode-on').count(),2);
    assert.ok((await page.locator('.modes-panel').innerText()).includes('×1.'));
    assert.equal(await page.locator('a.download').count(),0,'Synthetic preview is not a downloadable demo');
    await page.screenshot({path:dir+`/${engineName}-${width}-both.png`,fullPage:true});
    await go({match:changed.id});assert.equal(await page.locator('.modes-panel .mode-variable').count(),2);
    await page.locator('.mode-history-fold summary').click();assert.equal(await page.locator('.mode-history li').count(),4);
    await page.screenshot({path:dir+`/${engineName}-${width}-changed.png`,fullPage:true});
    await go({match:old.id});assert.equal(await page.locator('.modes-panel .mode-unknown').count(),2);
    await go({profile:'Пример Оба режима',kind:'human'});assert.equal(await page.locator('.match-row .mode-on').count(),2);
    await go({view:'achievements',achievement:'death-breath',awardPlayer:'Пример Оба режима'});
    assert.ok(await page.locator('.award-evidence .mode-on').count()>=2);
    await go({view:'about'});assert.equal(await page.locator('#modes').count(),1);assert.ok((await page.locator('#modes').innerText()).includes('Hardcore'));
    await page.screenshot({path:dir+`/${engineName}-${width}-guide.png`,fullPage:true});
    runs.push({engine:engineName,width,lang,theme,passed:true});await context.close();
  }}finally{await browser.close();}
}
assert.deepEqual(errors,[]);await writeFile(dir+'/checks.json',JSON.stringify({runs,errors},null,2));console.log(JSON.stringify({runs: runs.length,errors,screenshots:dir}));
