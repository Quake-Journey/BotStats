import {testPath} from './support/paths.js';
import {chromium,firefox,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const dir=testPath(),base='http://127.0.0.1:3085/botstats/';await mkdir(dir,{recursive:true});
const report=[];
for(const [name,engine]of Object.entries({chromium,firefox,webkit})){
  const browser=await engine.launch({headless:true});
  try {
    for(const mobile of [false,true]){
      const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},colorScheme:'dark',reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
      await page.goto(base+`?lang=${mobile?'en':'ru'}&theme=auto`);await page.waitForSelector('.match-row');
      assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
      await page.emulateMedia({colorScheme:'light'});await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');
      await page.selectOption('#theme','dark');assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
      await page.selectOption('#theme','light');assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No page-wide overflow');
      await page.fill('#f-q','David');await page.locator('#filters button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#count')?.textContent.startsWith('2 '));assert.equal(await page.locator('.match-row').count(),2);
      await page.selectOption('#f-map','q3t2');await page.waitForSelector('.empty');
      await page.click('#reset');await page.waitForSelector('.match-row');
      await page.click('[data-view=players]');await page.waitForSelector('.table-wrap table tbody tr');
      await page.click('[data-view=bots]');await page.waitForSelector('.map-leader');
      assert.ok((await page.locator('#results').innerText()).includes('Purri-X'));
      await page.selectOption('#f-period','week');await page.waitForFunction(()=>new URLSearchParams(location.search).get('period')==='week');
      await page.click('[data-view=rating]');await page.waitForSelector('.map-leader');
      await page.locator('.table-wrap tbody td a').first().click();await page.waitForSelector('.detail-top h1');
      await page.selectOption('#f-period','custom');await page.waitForSelector('#content[aria-busy=false]');
      await page.fill('#f-from','2035-01-01');await page.locator('#f-from').blur();await page.waitForSelector('.empty');
      await page.selectOption('#f-period','week');await page.waitForSelector('#content[aria-busy=false]');await page.waitForSelector('.table-wrap tbody tr');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Profile no overflow');assert.deepEqual(await page.locator('.table-wrap').evaluateAll(es=>es.filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.className)),[],'No horizontal table scrolling');
      if(mobile){await page.setViewportSize({width:320,height:740});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'320px profile no overflow');await page.setViewportSize({width:390,height:844});}
      await page.locator('.back').click();await page.waitForSelector('.map-leader');
      await page.click('[data-view=matches]');await page.waitForSelector('.match-row');
      if(name==='chromium')await page.screenshot({path:`${dir}/${mobile?'mobile-en-light':'desktop-ru-light'}.png`,fullPage:true});
      await page.locator('.match-row').first().click();await page.waitForSelector('.detail-score');assert.equal(await page.locator('.download').isVisible(),!mobile);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Detail no page-wide overflow');
      await page.locator('[data-weapon-player="1"]').click();assert.equal(await page.locator('[data-weapon-player="1"]').getAttribute('class'),'active');
      await page.selectOption('#language',mobile?'ru':'en');await page.waitForFunction(l=>document.documentElement.lang===l,mobile?'ru':'en');
      await page.selectOption('#theme','dark');
      assert.equal(new URL(page.url()).searchParams.get('weapon'),'1');
      if(!mobile){
        const copied=page.url(),clean=await browser.newContext({viewport:{width:1360,height:900},colorScheme:'light'}),other=await clean.newPage();
        await other.goto(copied);await other.waitForSelector('.detail-score');
        assert.equal(await other.locator('html').getAttribute('data-theme'),'dark');
        assert.equal(await other.locator('html').getAttribute('lang'),'en');
        assert.equal(await other.locator('[data-weapon-player="1"]').getAttribute('class'),'active');
        assert.equal(await other.locator('.detail-score').innerText(),await page.locator('.detail-score').innerText());
        await other.goto(base+'?lang=ru&theme=light&view=bots&period=custom&from=2026-10-20&to=2026-10-21&map=q2duel5&bot=David-X&skill=200&style=default&modVersion=11.5&q=pp&page=1');
        await other.waitForSelector('.table-wrap tbody tr');
        for(const [key,value]of Object.entries({period:'custom',from:'2026-10-20',to:'2026-10-21',map:'q2duel5',bot:'David-X',skill:'200',style:'default',modVersion:'11.5',q:'pp'}))assert.equal(await other.locator('#f-'+key).inputValue(),value);
        assert.equal(await other.locator('[data-view=bots]').getAttribute('aria-selected'),'true');
        assert.equal(await other.locator('.table-wrap tbody tr').count(),1);
        assert.ok((await other.locator('#count').innerText()).startsWith('2 '));
        await clean.close();
      }
      if(name==='chromium')await page.screenshot({path:`${dir}/${mobile?'mobile-ru-detail':'desktop-en-detail'}.png`,fullPage:true});
      assert.deepEqual(errors,[]);report.push({browser:name,mobile,passed:true});await context.close();
    }
  }finally{await browser.close();}
}
await writeFile(dir+'/browser-checks.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
