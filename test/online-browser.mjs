import assert from 'node:assert/strict';
import {chromium,firefox,webkit,devices} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.BOTSTATS_PREVIEW_URL||'http://127.0.0.1:3085/botstats/';
const dir=process.env.BOTSTATS_BROWSER_EVIDENCE||'O:/Claude2/_agent_temp/botstats_online_20261028';await mkdir(dir,{recursive:true});
const result=[];
for(const [name,type] of [['chromium',chromium],['firefox',firefox],['webkit',webkit]]){
  const browser=await type.launch({headless:true});
  try{
    for(const [size,width,theme,lang] of [['desktop',1440,'dark','ru'],['phone',390,'light','en']]){
      const p=await browser.newPage({viewport:{width,height:950}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
      await p.goto(base+`?view=online&lang=${lang}&theme=${theme}`);await p.waitForSelector('.online-name');
      assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await p.locator('#online-refresh').selectOption('30');assert.ok(p.url().includes('onlineRefresh=30'));
      await p.locator('[data-online-sort="name"]').click();assert.ok(p.url().includes('sort_online=name'));
      await p.locator('#online-settings summary').click();await p.locator('#online-reload').click();await p.waitForFunction(()=>!document.querySelector('#online-reload').disabled);assert.equal(await p.locator('#online-settings').getAttribute('open'),null);
      await p.screenshot({path:dir+`/online-${name}-${size}.png`,fullPage:true});assert.deepEqual(errors,[]);
      result.push({name,size,overflow:false,errors});await p.close();
    }
    const p=await browser.newPage({viewport:{width:1366,height:900}});
    await p.goto(base+'?lang=ru&theme=dark&profile=pp&kind=human');await p.waitForSelector('#profile-matches');
    const first=await p.locator('#profile-matches .match-row .score-link').evaluateAll(els=>els.map(e=>e.href));assert.equal(first.length,20);
    await p.locator('[data-profile-page="2"]').first().click();await p.waitForFunction(()=>location.search.includes('profilePage=2')&&document.querySelector('[data-profile-page="3"]'));
    const second=await p.locator('#profile-matches .match-row .score-link').evaluateAll(els=>els.map(e=>e.href));assert.equal(second.length,20);assert.equal(second.some(x=>first.includes(x)),false);
    await p.reload();await p.waitForSelector('[data-profile-page="3"]');assert.equal(await p.locator('#profile-matches .match-row').count(),20);
    await p.locator('#profile-matches [data-sort-key="score"]').click();await p.waitForSelector('[data-profile-page="2"]');assert.ok(!p.url().includes('profilePage='));
    await p.goto(base+'?lang=ru&theme=dark&profile=pp&kind=human&profilePage=7');await p.waitForSelector('#profile-matches');assert.equal(await p.locator('#profile-matches .match-row').count(),11);
    await p.locator('#profile-matches').screenshot({path:dir+`/profile-last-${name}.png`});
    await p.goto(base+'?lang=ru&theme=dark&profile=David-X&kind=bot&profilePage=2');await p.waitForSelector('#profile-matches');assert.ok(await p.locator('#profile-matches .match-row').count()>0);assert.ok(p.url().includes('profilePage=2'));await p.close();result.push({name,profiles:'human and bot pagination passed'});
  }finally{await browser.close();}
}
await writeFile(dir+'/browser-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
