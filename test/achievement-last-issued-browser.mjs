import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {testPath} from './support/paths.js';
const out=testPath('last-issued');await mkdir(out,{recursive:true});
const base=process.env.BOTSTATS_BASE_URL||'http://127.0.0.1:3085/botstats/';
const browser=await chromium.launch({channel:process.env.BOTSTATS_BROWSER_CHANNEL||'chrome'}),checks=[];
const ready=p=>p.locator('#content[aria-busy=false]').waitFor();
try{for(const width of [320,390,1440]){
 const p=await browser.newPage({viewport:{width,height:956}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 const response=p.waitForResponse(r=>new URL(r.url()).pathname==='/botstats/api/achievements');
 await p.goto(base+'?view=achievements&lang=ru&theme=dark');await ready(p);
 const catalog=await(await response).json();
 const latest=a=>a.holders.reduce((best,h)=>Date.parse(h.earnedAt)>Date.parse(best.earnedAt)?h:best,a.holders[0]);
 const expected=[...catalog.items].sort((a,b)=>Date.parse(latest(b).earnedAt)-Date.parse(latest(a).earnedAt));
 const ids=()=>p.locator('.achievement-caption h2>a').evaluateAll(links=>links.map(a=>new URL(a.href).searchParams.get('achievement')));
 assert.deepEqual(await ids(),expected.map(a=>a.id));
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const first=p.locator('[data-table=achievements] tbody tr').first();
 assert.ok((await first.locator('.achievement-latest-holder').textContent()).includes(latest(expected[0]).name));
 assert.equal(await first.locator('.achievement-first-date').count(),1);
 await p.screenshot({path:out+'/achievements-'+width+'.png'});
 if(width<=800){assert.equal(await p.locator('[data-sort-select=achievements]').inputValue(),'lastIssued');await p.locator('.compact-sort [data-sort-table=achievements]').click();}
 else await p.locator('[data-sort-table=achievements][data-sort-key=lastIssued]').click();
 await ready(p);assert.equal(new URL(p.url()).searchParams.get('dir_achievements'),'asc');
 assert.deepEqual(await ids(),[...catalog.items].sort((a,b)=>Date.parse(latest(a).earnedAt)-Date.parse(latest(b).earnedAt)).map(a=>a.id));
 await p.reload();await ready(p);assert.equal(new URL(p.url()).searchParams.get('sort_achievements'),'lastIssued');
 const proof=p.locator('.achievement-latest-holder .award-proof-link').first(),url=new URL(await proof.getAttribute('href'),base);
 await proof.click();await ready(p);assert.equal(new URL(p.url()).searchParams.get('awardPlayer'),url.searchParams.get('awardPlayer'));
 assert.ok(await p.locator('.award-evidence').isVisible());assert.deepEqual(errors,[]);checks.push({width,lastIssuedSort:true,firstIssuedPreserved:true,recipientEvidenceLink:true});await p.close();
}await writeFile(out+'/results.json',JSON.stringify({passed:true,checks},null,2));console.log(JSON.stringify({passed:true,checks}));}finally{await browser.close();}
