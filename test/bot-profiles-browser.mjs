import {chromium,firefox,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {testPath} from './support/paths.js';
const base=process.env.BOTSTATS_BASE_URL||'http://127.0.0.1:3085/botstats/';
const out=testPath('bot-profiles');await mkdir(out,{recursive:true});
const checks=[];
for(const [engineName,engine] of Object.entries({chromium,firefox,webkit})){
  const browser=await engine.launch();
  try{for(const [width,theme,lang] of [[1440,'judgment','ru'],[390,'light','en'],[320,'dark','ru']]){
    const page=await browser.newPage({viewport:{width,height:1000},hasTouch:width<500}),errors=[],requests=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});page.on('request',r=>requests.push(r.url()));
    const ready=()=>page.locator('#content[aria-busy=false]').waitFor();
    const checkPage=async()=>{
      assert.notEqual(new URL(page.url()).searchParams.get('page'),'inner','ordinary clicks must not trigger pagination');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'page overflow');
      await page.waitForFunction(()=>[...document.querySelectorAll('img.bot-avatar')].filter(e=>{const r=e.getBoundingClientRect();return !e.closest('details:not([open])')&&r.width>0&&r.top<innerHeight&&r.bottom>0;}).every(e=>e.complete&&e.naturalWidth));
      const broken=await page.locator('.bot-avatar').evaluateAll(els=>els.filter(e=>!e.closest('details:not([open])')&&e.getBoundingClientRect().top<innerHeight&&e.getBoundingClientRect().bottom>0&&!e.naturalWidth).map(e=>e.src));
      assert.deepEqual(broken,[],'visible portraits loaded');assert.deepEqual(errors,[]);
    };
    await page.goto(base+`?view=home&theme=${theme}&lang=${lang}`);await ready();
    await page.locator('#home-bots').scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>[...document.querySelectorAll('#home-bots img.bot-avatar')].filter(e=>e.getBoundingClientRect().top<innerHeight).every(e=>e.complete&&e.naturalWidth));
    assert.equal(await page.locator('#home-bots .bot-avatar').count(),12);assert.equal(await page.locator('#home-humans .bot-avatar').count(),0);
    assert.equal(requests.some(u=>u.includes('/avatars/bots/')&&u.endsWith('-384.webp')),false,'home only loads thumbnail assets');
    const overlapping=await page.locator('#home-bots .home-person-heading').evaluateAll(rows=>rows.some(row=>{
      const a=row.querySelector('.home-portrait').getBoundingClientRect(),n=row.querySelector('.home-person-name').getBoundingClientRect(),w=row.querySelector('.home-person-wins').getBoundingClientRect();
      return a.right>n.left+1||n.right>w.left+1;
    }));assert.equal(overlapping,false,'portrait/name/score do not overlap');
    await checkPage();
    if(engineName==='chromium')await page.screenshot({path:`${out}/home-${width}.png`,caret:'initial'});
    const more=page.locator('#home-bots .achievement-more').first();
    assert.equal(new URL(await more.getAttribute('href'),base).searchParams.get('view'),'bots');
    await more.click();await page.locator('#profile-achievements').waitFor();await ready();
    assert.equal(await page.locator('.tabs [aria-current=page]').getAttribute('data-view'),'bots');
    assert.equal(new URL(page.url()).hash,'#profile-achievements');
    assert.match(await page.locator('#content > .back').innerText(),/ботов|Bot directory/);
    await page.locator('#content > .back').click();await ready();
    assert.equal(new URL(page.url()).searchParams.has('profile'),false);assert.equal(await page.locator('.tabs [aria-current=page]').getAttribute('data-view'),'bots');
    await checkPage();
    await page.goto(base+`?view=players&profile=Purri-X&kind=bot&theme=${theme}&lang=${lang}`);await ready();
    await page.locator('.bot-avatar--profile').evaluate(e=>e.decode());
    assert.equal(new URL(page.url()).searchParams.get('view'),'bots','legacy deep link corrected');
    assert.equal(await page.locator('.tabs [aria-current=page]').getAttribute('data-view'),'bots');
    await checkPage();
    if(engineName==='chromium')await page.screenshot({path:`${out}/profile-${width}.png`,caret:'initial'});
    await page.goto(base+`?view=bots&profile=pp&kind=human&theme=${theme}&lang=${lang}`);await ready();
    assert.equal(await page.locator('.tabs [aria-current=page]').getAttribute('data-view'),'players');
    assert.equal(await page.locator('.bot-avatar--profile').count(),0,'human profile has no cyborg portrait');
    if(engineName==='chromium'){
      for(const view of ['matches','victims','defeats','botdefeats','achievements']){
        await page.goto(base+`?view=${view}&theme=${theme}&lang=${lang}`);await ready();
        await page.waitForFunction(()=>[...document.querySelectorAll('img.bot-avatar')].filter(e=>e.getBoundingClientRect().top<innerHeight&&e.getBoundingClientRect().bottom>0).every(e=>e.complete&&e.naturalWidth));
        await checkPage();
        const botLinks=await page.locator('#content a[href*="profile="][href*="kind=bot"]').evaluateAll(es=>es.map(e=>e.href));
        assert.ok(botLinks.length>0,view+' has bot profiles');
        assert.ok(botLinks.every(href=>new URL(href).searchParams.get('view')==='bots'),view+' bot destinations');
        if(view==='matches'){
          const tableAvatars=await page.locator('.match-row [data-player-kind=bot] .bot-avatar').count();assert.ok(tableAvatars>0);
          await page.locator('.match-row .score-link').first().click();await ready();
          await page.locator('.player[data-player-kind=bot] .bot-avatar').evaluate(e=>e.decode());await checkPage();
          if(width===390)await page.screenshot({path:`${out}/match-${width}.png`,caret:'initial'});
        }
      }
    }
    assert.deepEqual(errors,[]);checks.push({engine:engineName,width,theme,lang,passed:true});console.log(JSON.stringify(checks.at(-1)));await page.close();
  }}finally{await browser.close();}
}
await writeFile(out+'/results.json',JSON.stringify(checks,null,2));
