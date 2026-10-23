import {chromium,firefox,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {testPath} from './support/paths.js';

// Pass the saved public API response of the reported match. Interception tests
// the UI against an old import without altering any local or production data.
const fixture=JSON.parse((await readFile(process.argv[2],'utf8')).replace(/^\uFEFF/,''));
const base='http://127.0.0.1:3085/botstats/',dir=testPath('score-filters');
await mkdir(dir,{recursive:true});
const results=[];
for(const [engineName,engine] of Object.entries({chromium,firefox,webkit})){
  const browser=await engine.launch({headless:true});
  try{
    for(const width of [1440,360])for(const lang of ['ru','en']){
      const context=await browser.newContext({viewport:{width,height:1000},colorScheme:'dark'});
      const page=await context.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
      await page.route('**/api/matches/'+fixture.id,route=>route.fulfill({json:fixture}));
      await page.goto(base+`?lang=${lang}&theme=auto&view=matches`);
      await page.waitForSelector('#count:not(:empty)');
      assert.equal(await page.locator('.primary-filters').evaluate(e=>e.open),false);
      assert.equal(await page.locator('#f-period').isVisible(),false);
      assert.equal(await page.locator('.advanced').evaluate(e=>e.open),false);
      await page.locator('.primary-filters summary').click();
      await page.locator('#f-map').selectOption('q3t2');
      await page.locator('#f-period').selectOption('week');
      await page.waitForFunction(()=>new URLSearchParams(location.search).get('period')==='week');
      await page.locator('.primary-filters summary').click();
      await page.waitForFunction(()=>new URLSearchParams(location.search).get('filters')==='0');
      await page.reload();await page.waitForSelector('#count:not(:empty)');
      assert.equal(await page.locator('.primary-filters').evaluate(e=>e.open),false);
      assert.equal(await page.locator('#f-map').inputValue(),'q3t2');
      assert.equal(await page.locator('#f-period').inputValue(),'week');
      await page.locator('.advanced summary').click();
      assert.equal(await page.locator('#f-status').isVisible(),true);
      assert.equal(await page.locator('#f-period').isVisible(),false);
      await page.locator('.advanced summary').click();
      await page.waitForFunction(()=>new URLSearchParams(location.search).get('advanced')==='0');
      if(engineName==='chromium'&&lang==='ru')await page.screenshot({path:`${dir}/filters-${width}.png`,fullPage:true});
      for(const theme of ['dark','light']){
        await page.goto(base+`?lang=${lang}&theme=${theme}&match=${fixture.id}`);
        await page.waitForSelector('.score-end');
        assert.deepEqual(await page.locator('.score-end').evaluateAll(es=>es.map(e=>Number(e.dataset.score))),[1,2]);
        assert.deepEqual(await page.locator('.score-tick').allTextContents(),['0','1','2']);
        const ends=await page.locator('.score-end').evaluateAll(es=>es.map(e=>Number(e.getAttribute('cy'))));
        assert.ok(ends[1]<ends[0],'Bot final score is above the human');
        assert.deepEqual(await page.locator('.chart + .legend > span').allTextContents(),['player — 1','OptiMus-X[200] — 2']);
        assert.ok((await page.locator('footer').innerText()).includes('BOTSTATS by ly'));
        assert.equal(await page.locator('footer a').getAttribute('href'),'https://github.com/Quake-Journey/BotStats');
        assert.ok(!(await page.locator('footer').innerText()).includes('preview'));
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
        if(engineName==='chromium'&&lang==='ru'){
          await page.screenshot({path:`${dir}/match-${width}-${theme}.png`,fullPage:true});
          await page.locator('.panel').filter({has:page.locator('.chart')}).screenshot({path:`${dir}/chart-${width}-${theme}.png`});
        }
        results.push({engineName,width,lang,theme,passed:true});
      }
      assert.deepEqual(errors,[]);await context.close();
    }
  }finally{await browser.close();}
}
await writeFile(`${dir}/result.json`,JSON.stringify({passed:true,results},null,2));
console.log(JSON.stringify({passed:true,chartViews:results.length,filterSessions:results.length/2,dir}));
