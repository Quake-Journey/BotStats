import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,firefox,webkit} from 'playwright';
import {compactMatchDate,timeWithoutWin} from '../public/win-history.js';
import {testPath} from './support/paths.js';

const base=process.env.BOTSTATS_BASE_URL||'http://127.0.0.1:3085/botstats/';
const out=testPath('overview');await mkdir(out,{recursive:true});const results=[];
for(const [engineName,engine] of Object.entries({chromium,firefox,webkit})){
  const browser=await engine.launch({headless:true});
  try{
    for(const [width,lang,theme] of [[2560,'ru','dark'],[1440,'ru','light'],[1024,'en','dark'],[390,'ru','dark'],[320,'en','light']]){
      const page=await browser.newPage({viewport:{width,height:1050}}),errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base+`?lang=${lang}&theme=${theme}`);
      await page.locator('#content[aria-busy=false]').waitFor();
      assert.equal(await page.locator('.error').count(),0);
      const summary=await(await page.request.get(base+'api/summary')).json();
      const kpi=key=>page.locator(`[data-kpi=${key}]`);
      assert.equal(await kpi('humanWins').locator('.value').innerText(),new Intl.NumberFormat(lang).format(summary.humanWins));
      assert.equal(await kpi('allMatches').locator('.wins-history-value').innerText(),new Intl.NumberFormat(lang).format(summary.uniqueHumans));
      assert.equal(await kpi('humanWins').locator('.wins-history-value').first().innerText(),compactMatchDate(summary.lastHumanWinAt));
      assert.equal(await kpi('botWins').locator('.wins-history-value').innerText(),compactMatchDate(summary.lastBotWinAt));
      const elapsed=timeWithoutWin(summary.lastHumanWinAt,summary.asOf);
      assert.equal(await kpi('humanWins').locator('.wins-history-value').last().innerText(),elapsed?`${elapsed.days} ${lang==='ru'?'д':'d'} ${elapsed.hours} ${lang==='ru'?'ч':'h'}`:'—');
      const balance=kpi('gameTime').locator('.win-balance');
      const leader=summary.players.filter(p=>p.isBot&&p.wins>0).sort((a,b)=>b.wins-a.wins||a.name.localeCompare(b.name,'en'))[0];
      const killer=kpi('allMatches').locator('.kpi-killer');
      assert.equal(await killer.locator('.kpi-killer-name').innerText(),leader?.name||'—');
      if(leader){
        const profileURL=new URL(await killer.locator('.kpi-killer-name').getAttribute('href'),base);
        assert.equal(profileURL.searchParams.get('profile'),leader.name);assert.equal(profileURL.searchParams.get('kind'),'bot');
        const awards=await(await page.request.get(base+'api/achievements')).json();
        const earned=awards.items.filter(a=>a.audience==='bot'&&a.holders.some(h=>h.name===leader.name));
        assert.equal(await killer.locator('.achievement-mini').count(),earned.length);
        if(earned.length)assert.ok(await killer.locator('.achievement-mini:visible').count()>0);
      }
      assert.ok(await killer.evaluate(e=>{const b=e.getBoundingClientRect(),c=e.closest('.kpi').getBoundingClientRect();return b.bottom<=c.bottom&&e.scrollWidth<=e.clientWidth+1;}));
      assert.equal(await page.locator('.win-balance').count(),1);
      const humanShare=summary.humanWins/(summary.humanWins+summary.botWins)*100;
      assert.ok(Math.abs(Number(await balance.locator('.win-balance-human-fill').getAttribute('width'))-humanShare)<0.0001);
      const balanceBounds=await balance.evaluate(e=>{const b=e.getBoundingClientRect(),c=e.closest('.kpi').getBoundingClientRect();return {fits:e.scrollWidth<=e.clientWidth+1,bottom:c.bottom-b.bottom};});
      assert.ok(balanceBounds.fits);assert.ok(balanceBounds.bottom>=10&&balanceBounds.bottom<=20,'Balance is at the bottom of the tile');
      const layout=await page.evaluate(()=>{
        const cards=[...document.querySelectorAll('#kpis .kpi')];
        const inside=[...document.querySelectorAll('.kpi-history .wins-history-value,.kpi-history .wins-history-label')].every(e=>{const r=e.getBoundingClientRect(),c=e.closest('.kpi').getBoundingClientRect();return r.left>=c.left&&r.right<=c.right+1&&r.bottom<=c.bottom;});
        const history=document.querySelector('.wins-info .wins-history');
        const sameFont=history&&[...document.querySelectorAll('.kpi-history')].every(e=>['fontSize','lineHeight','fontFamily'].every(p=>getComputedStyle(e)[p]===getComputedStyle(history)[p]));
        const topOffsets=selector=>cards.map(e=>e.querySelector(selector).getBoundingClientRect().top-e.getBoundingClientRect().top);
        return {overflow:document.documentElement.scrollWidth>innerWidth,inside,sameFont,heights:cards.map(e=>e.getBoundingClientRect().height),latestHeight:document.querySelector('#latest').getBoundingClientRect().height,labelOffsets:topOffsets(':scope > .label'),valueOffsets:topOffsets(':scope > .value')};
      });
      assert.equal(layout.overflow,false);assert.ok(layout.inside);assert.ok(layout.sameFont);
      assert.ok(Math.max(...layout.labelOffsets)-Math.min(...layout.labelOffsets)<1,'Tile titles share the same vertical position');
      assert.ok(Math.max(...layout.valueOffsets)-Math.min(...layout.valueOffsets)<1,'Main numbers share the same vertical position');
      if(width>1300){assert.ok(Math.max(...layout.heights)-Math.min(...layout.heights)<1);assert.ok(Math.abs(layout.heights[0]-layout.latestHeight)<1);}
      if(engineName==='chromium')await page.screenshot({path:`${out}/${width}-${lang}-${theme}.png`});
      // Check actual filtered API summaries and the zero-match case, not only DOM labels.
      for(const map of ['q2duel5','no_such_map']){
        await page.goto(base+`?lang=${lang}&theme=${theme}&map=${map}`);await page.locator('#content[aria-busy=false]').waitFor();
        const filtered=await(await page.request.get(base+'api/summary?map='+map)).json();
        assert.equal(await kpi('allMatches').locator('.wins-history-value').innerText(),new Intl.NumberFormat(lang).format(filtered.uniqueHumans));
        assert.equal(await kpi('humanWins').locator('.wins-history-value').first().innerText(),compactMatchDate(filtered.lastHumanWinAt));
        assert.equal(await kpi('botWins').locator('.wins-history-value').innerText(),compactMatchDate(filtered.lastBotWinAt));
        const filteredLeader=filtered.players.filter(p=>p.isBot&&p.wins>0).sort((a,b)=>b.wins-a.wins||a.name.localeCompare(b.name,'en'))[0];
        assert.equal(await killer.locator('.kpi-killer-name').innerText(),filteredLeader?.name||'—');
        if(map==='no_such_map'){assert.equal(filtered.uniqueHumans,0);assert.equal(await kpi('humanWins').locator('.wins-history-value').last().innerText(),'—');assert.equal(await balance.locator('rect').count(),0);assert.equal(await balance.locator('b').first().innerText(),'—');assert.equal(await killer.locator('.achievement-mini').count(),0);}
        else assert.ok(Math.abs(Number(await balance.locator('.win-balance-human-fill').getAttribute('width'))-filtered.humanWins/(filtered.humanWins+filtered.botWins)*100)<0.0001);
      }
      assert.deepEqual(errors,[]);results.push({engineName,width,lang,theme,passed:true});await page.close();
      console.log(JSON.stringify(results.at(-1)));
    }
  }finally{await browser.close();}
}
await writeFile(out+'/results.json',JSON.stringify({passed:true,results},null,2));
