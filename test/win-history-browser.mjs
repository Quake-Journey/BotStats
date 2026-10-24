import assert from 'node:assert/strict';
import {chromium,firefox,webkit} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {testPath} from './support/paths.js';

const base=process.env.BOTSTATS_BASE_URL||'http://127.0.0.1:3085/botstats/',out=testPath('browser');await mkdir(out,{recursive:true});
const results=[];
for(const [engineName,engine]of Object.entries({chromium,firefox,webkit})){
 const browser=await engine.launch({headless:true});
 try{for(const width of [1440,1024,360,320])for(const lang of ['ru','en']){
  const page=await browser.newPage({viewport:{width,height:1050}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const ready=async()=>{await page.locator('#content[aria-busy=false]').waitFor();assert.equal(await page.locator('.error').count(),0);};
  const values=()=>page.locator('[data-table=rating_victory] .wins-value').evaluateAll(es=>es.map(e=>Number(e.textContent)));
  const check=async()=>{
   assert.ok(await page.locator('.wins-info').count()>0);
   assert.equal(await page.locator('.wins-history-line').count(),3*await page.locator('.wins-info').count());
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No page overflow');
   assert.ok(await page.locator('.wins-history').evaluateAll(es=>es.every(e=>e.scrollWidth<=e.clientWidth+1)),'No clipped recency');
   assert.ok(await page.locator('.wins-info').evaluateAll(es=>es.every(e=>{const c=e.closest('td').getBoundingClientRect(),r=e.getBoundingClientRect();return r.left>=c.left&&r.right<=c.right+1&&r.top>=c.top&&r.bottom<=c.bottom+1;})),'Recency fits its cell');
   assert.ok(await page.locator('.wins-info').evaluateAll(es=>es.every(e=>{
    const count=e.querySelector('.wins-value'),history=e.querySelector('.wins-history'),points=e.closest('tr').cells[1].querySelector('b');
    const a=getComputedStyle(count),b=getComputedStyle(points),c=getComputedStyle(history),d=getComputedStyle(e.closest('tr').cells[3].querySelector('b'));
    return count.getBoundingClientRect().bottom<=history.getBoundingClientRect().top&&a.fontSize===b.fontSize&&a.fontWeight===b.fontWeight&&a.color===b.color&&d.fontSize===b.fontSize&&d.fontWeight===b.fontWeight&&d.color===b.color&&c.fontSize==='11px';
   })),'Win count sits above the smaller details and matches victory-point typography');
  };
  await page.goto(base+`?lang=${lang}&theme=${width===320?'light':'dark'}&view=rating&ranking=victory`);await ready();await check();
  assert.match(await page.locator('.wins-history').first().innerText(),lang==='ru'?/Последняя победа:/:/Last win:/);
  const wins=page.locator('[data-sort-table=rating_victory][data-sort-key=normalWins]');
  await wins.click();await ready();let a=await values();assert.deepEqual(a,[...a].sort((x,y)=>y-x));
  assert.equal(new URL(page.url()).searchParams.get('sort_rating_victory'),'normalWins');
  await wins.click();await ready();a=await values();assert.deepEqual(a,[...a].sort((x,y)=>x-y));
  assert.equal(new URL(page.url()).searchParams.get('dir_rating_victory'),'asc');
  await page.reload();await ready();assert.deepEqual(await values(),a);await check();
  if(engineName==='chromium'&&lang==='ru')await page.locator('[data-table=rating_victory]').screenshot({path:`${out}/wins-${width}.png`});
  // The map filter changes the dates together with the other table statistics.
  await page.goto(base+`?lang=${lang}&view=rating&ranking=victory&map=q2duel5`);await ready();await check();
  const actual=await(await fetch(base+'api/summary?map=q2duel5')).json();
  assert.ok(actual.players.some(p=>!p.isBot&&p.lastGameAt&&p.lastWinAt));
  assert.deepEqual(errors,[],`${engineName} ${width} ${lang}`);
  results.push({engineName,width,lang,passed:true});await page.close();console.log(JSON.stringify(results.at(-1)));
 }}finally{await browser.close();}
}
await writeFile(out+'/results.json',JSON.stringify({passed:true,contexts:results.length,results},null,2));
