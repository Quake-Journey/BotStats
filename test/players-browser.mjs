import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,firefox,webkit} from 'playwright';
import {testPath} from './support/paths.js';
const base=process.env.BOTSTATS_BASE_URL||'http://127.0.0.1:3085/botstats/';
const dir=testPath('players-browser');await mkdir(dir,{recursive:true});
const summary=await(await fetch(base+'api/summary?playerSearch=1')).json(),humans=summary.players.filter(p=>!p.isBot);
const runs=[],errors=[];
for(const [name,engine] of Object.entries({chromium,firefox,webkit})){
 const browser=await engine.launch({headless:true});
 try{for(const width of [1440,390]){
  const lang=width===1440?'ru':'en',theme=width===1440?'dark':'light';
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  const ready=async()=>{await page.locator('#content[aria-busy=false]').waitFor();assert.equal(await page.locator('.error').count(),0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));};
  const go=async q=>{await page.goto(base+'?lang='+lang+'&theme='+theme+'&'+q);await ready();};
  await go('view=rating');assert.equal(await page.locator('.ranking-choices').count(),1);
  await page.locator('[data-view=players]').click();await ready();
  assert.equal(await page.locator('.ranking-choices').count(),0);assert.equal(await page.locator('.map-leaders').count(),0);
  assert.equal(await page.locator('[data-table=players] tbody tr').count(),humans.length);
  assert.equal(await page.locator('[data-table=players] .rank').count(),0);
  const names=await page.locator('.player-directory-name').allTextContents();
  assert.deepEqual(names,[...names].sort((a,b)=>a.localeCompare(b,lang,{numeric:true,sensitivity:'base'})));
  assert.equal(await page.locator('[data-sort-table=players][data-sort-key=name]').getAttribute('class'),'sort-button sorted');
  assert.equal(await page.locator('.overview-fold[open]').count(),width===390?0:2);
  for(const p of humans.filter(p=>p.normalWins===0))assert.equal(await page.locator('[data-table=players] .player-directory-name').filter({hasText:new RegExp('^'+p.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')}).count(),1);
  assert.equal(await page.title(),(lang==='ru'?'Игроки':'Players')+' · BotStats · Q2PRO-X');
  for(const key of ['name','matches','normalWins','normalLosses','forfeits','draws','completedWinRate','lastGameAt']){
   await page.locator(`[data-sort-table=players][data-sort-key=${key}]`).click();await ready();
   assert.equal(new URL(page.url()).searchParams.get('sort_players'),key);
  }
  await page.reload();await ready();assert.equal(await page.locator('[data-sort-key=lastGameAt]').getAttribute('class'),'sort-button sorted');
  const latest=page.locator('.player-directory-last').first(),href=await latest.getAttribute('href'),id=new URL(href,base).searchParams.get('match');
  assert.ok((await latest.innerText()).endsWith('↗'));
  assert.equal(await latest.getAttribute('title'),lang==='ru'?'Открыть матч':'Open match');
  await latest.click();await ready();assert.equal(new URL(page.url()).searchParams.get('match'),id);assert.equal(await page.locator('.detail-score').count(),1);
  await page.goBack();await ready();assert.equal(await page.locator('[data-table=players]').count(),1);
  const player=page.locator('.player-directory-name').first(),nick=await player.innerText();
  await player.click();await ready();assert.equal(new URL(page.url()).searchParams.get('profile'),nick);
  assert.ok((await page.locator('.back').innerText()).includes(lang==='ru'?'списку игроков':'Player directory'));
  await page.locator('.back').click();await ready();assert.equal(await page.locator('[data-table=players]').count(),1);
  await go('view=players&ranking=maps');assert.equal(await page.locator('[data-table=players]').count(),1,'Ranking URL residue cannot replace directory');
  await go('view=players&map=q2duel5&q=pp&filters=1');
  const filtered=await(await fetch(base+'api/summary?playerSearch=1&map=q2duel5&q=pp')).json();
  assert.equal(await page.locator('[data-table=players] tbody tr').count(),filtered.players.filter(p=>!p.isBot).length);
  const shared=page.url(),copy=await context.newPage();await copy.goto(shared);await copy.locator('#content[aria-busy=false]').waitFor();assert.equal(await copy.locator('[data-table=players] tbody tr').count(),filtered.players.filter(p=>!p.isBot).length);await copy.close();
  await page.locator('#f-q').fill('David-X');await page.waitForFunction(()=>new URL(location.href).searchParams.get('q')==='David-X');await page.waitForFunction(()=>!document.querySelector('[data-table=players]'));assert.ok(await page.locator('#results .empty').count()>0,'Bot nick is not a human match');
  await go('view=players');await page.screenshot({path:dir+`/${name}-${width}.png`});
  if(width===390){await page.setViewportSize({width:320,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  runs.push({engine:name,width,lang,theme,players:humans.length,passed:true});await context.close();
 }}finally{await browser.close();}
}
assert.deepEqual(errors,[]);await writeFile(dir+'/results.json',JSON.stringify({passed:true,runs},null,2));console.log(JSON.stringify({passed:true,contexts:runs.length,players:humans.length,evidence:dir}));
