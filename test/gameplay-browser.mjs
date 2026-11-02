import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,firefox,webkit} from 'playwright';
import {testPath} from './support/paths.js';
const base=process.env.BOTSTATS_BASE_URL||'http://127.0.0.1:3085/botstats/';
const native='e550639abb16361d3a066b4e67dddf055c5c2f74c7857774fa08ced668e19b1f-0-0';
const reference=await(await fetch(base+'api/matches/'+native)).json();
const dir=testPath('browser');await mkdir(dir,{recursive:true});
const results=[],errors=[];
for(const [name,engine]of Object.entries({chromium,firefox,webkit})){
  const browser=await engine.launch({headless:true});
  try{for(const [width,lang,theme]of [[1440,'ru','dark'],[1440,'en','light'],[390,'ru','light'],[390,'en','dark'],[320,'ru','dark']]){
    const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();page.on('pageerror',e=>errors.push(`${name}/${width}: ${e.message}`));
    const ready=async()=>{await page.locator('#content[aria-busy=false]').waitFor();assert.equal(await page.locator('.error').count(),0);};
    const fits=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');
    const go=async(id)=>{await page.goto(base+'?'+new URLSearchParams({lang,theme,match:id}));await ready();await fits();};
    await go(native);
    const botMeta=await page.locator('.detail-score [data-player-kind=bot] .meta').first().innerText();
    assert.equal(botMeta,lang==='ru'?'Скилл и стиль: переменные':'Skill and style: variable');
    assert.equal(await page.locator('[data-gameplay-state=model] .gameplay-endpoints').count(),0,'Unchanged model is shown once');
    assert.equal(await page.locator('.style-timeline .skill-interval').count(),3,'Initial/default, arcade, defence; identical metadata snapshots are not repeated');
    assert.equal(await page.locator('.download').count(),0);
    assert.equal(await page.locator('.gameplay-state').count(),4);
    assert.ok((await page.locator('[data-gameplay-state=preset]').innerText()).includes(lang==='ru'?'Максимальная агрессия':'Maximum aggression'));
    assert.ok((await page.locator('[data-gameplay-state=preset]').innerText()).includes(lang==='ru'?'Переменный':'Variable'));
    assert.ok((await page.locator('[data-gameplay-state=model]').innerText()).includes('regular'));
    assert.ok((await page.locator('[data-gameplay-state=aggression]').innerText()).includes('100%'));
    assert.equal(await page.locator('.gameplay-snapshot-body').filter({hasText:/./}).count(),0,'Snapshot payloads are lazy');
    await page.locator('.gameplay-panel').screenshot({path:`${dir}/${name}-${width}-${lang}-${theme}-card.png`});
    await page.locator('.gameplay-history>summary').click();assert.equal(await page.locator('.gameplay-history li').count(),6);
    const baseEdit=page.locator('.gameplay-history li').nth(1);await baseEdit.locator('summary').click();
    assert.equal(await baseEdit.locator('.gameplay-diff>div').count(),3);assert.ok((await baseEdit.innerText()).includes('37%'));
    await fits();await page.locator('.gameplay-panel').screenshot({path:`${dir}/${name}-${width}-${lang}-${theme}-history.png`});
    await page.locator('.gameplay-snapshots>summary').click();const snapshot=page.locator('[data-gameplay-snapshot="6"]');await snapshot.locator(':scope>summary').click();
    await snapshot.locator('.gameplay-parameters').first().waitFor();assert.equal(await page.locator('.gameplay-snapshot').count(),8);
    let source=0;for(const list of await snapshot.locator('.gameplay-parameters').all()){
      await list.locator('summary').click();assert.equal(await list.locator('dt').count(),228);
      const long=list.locator('dl>div').filter({has:page.locator('dt',{hasText:/^otx_bot3_style_maps$/})});assert.equal(await long.locator('dd').textContent(),reference.recordedSettings.snapshots[6][source++?'baseParams':'params'].otx_bot3_style_maps);await fits();
      await list.locator('summary').click();
    }
    await snapshot.locator('.gameplay-technical>summary').click();assert.ok((await snapshot.locator('pre').innerText()).includes('OTX_MATCH_PARAM_TEXT'));await fits();
    await go('c'.repeat(64)+'-0-0');assert.ok((await page.locator('[data-gameplay-state=preset]').innerText()).includes(lang==='ru'?'Конфигурация сервера':'Server configuration'));
    assert.ok((await page.locator('[data-gameplay-state=preset]').innerText()).includes(lang==='ru'?'Переменный':'Variable'));
    assert.equal(await page.locator('[data-gameplay-state=aggression]>strong').innerText(),'1%');
    await go('d'.repeat(64)+'-0-0');assert.equal(await page.locator('.gameplay-state').count(),0);assert.ok((await page.locator('.gameplay-empty').innerText()).includes(lang==='ru'?'не записаны':'not recorded'));
    for(const query of [{view:'matches'},{profile:'David-X',kind:'bot'},{view:'defeats'},{view:'botdefeats'}]){
      await page.goto(base+'?'+new URLSearchParams({lang,theme,...query}));await ready();await fits();
      if(query.view==='matches'){
        const overview=page.locator('[data-overview=overviewLatest]');
        if(!await overview.evaluate(el=>el.open))await overview.locator(':scope>summary').click();
        assert.equal(await page.locator('#latest .person[data-player-kind=bot] small').textContent(),lang==='ru'?'Скилл и стиль: переменные':'Skill and style: variable');
        await page.locator('#latest').screenshot({path:`${dir}/${name}-${width}-${lang}-${theme}-latest.png`});await fits();
      }
      for(const label of await page.locator('.person[data-player-kind=bot] small').allTextContents()){
        assert.ok(label===(lang==='ru'?'Скилл и стиль: переменные':'Skill and style: variable')||label.includes(lang==='ru'?'Стиль:':'Style:'),'Every style is named');
      }
      assert.equal((await page.locator('#content').innerText()).includes('Переменный · Переменный'),false);
    }
    results.push({engine:name,width,lang,theme,passed:true});await context.close();
  }}finally{await browser.close();}
}
assert.deepEqual(errors,[]);await writeFile(dir+'/checks.json',JSON.stringify({results,errors},null,2));console.log(JSON.stringify({passed:results.length,errors,evidence:dir}));
