import {testPath} from './support/paths.js';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';

// An actual fresh HTTP-cache entry, not request interception (which disables cache).
const upstream='http://127.0.0.1:3085',evidence=testPath();
let legacyRequests=0,prime=true;
const proxy=createServer(async(req,res)=>{
  try{
    if(req.url==='/prime'){
      res.setHeader('Content-Type','text/html');
      res.end('<script type="module">import {ratingPolicy} from "/botstats/assets/rating.js";document.body.dataset.cached="yes";</script>');return;
    }
    if(prime&&req.url==='/botstats/assets/rating.js'){
      legacyRequests++;res.setHeader('Content-Type','text/javascript');res.setHeader('Cache-Control','public, max-age=3600');
      res.end('export const ratingPolicy={};export function matchPoints(){return 0;}');return;
    }
    const reply=await fetch(upstream+req.url);res.statusCode=reply.status;
    for(const key of ['content-type','cache-control','content-security-policy','x-content-type-options'])if(reply.headers.has(key))res.setHeader(key,reply.headers.get(key));
    res.end(Buffer.from(await reply.arrayBuffer()));
  }catch(error){res.statusCode=500;res.end(error.message);}
});
await new Promise(resolve=>proxy.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${proxy.address().port}`,browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/prime');await page.waitForSelector('body[data-cached=yes]');
  assert.equal(legacyRequests,1);prime=false;
  await page.goto(base+'/botstats/about?lang=ru&theme=auto');
  const loaded=await page.waitForSelector('#content[aria-busy=false]',{timeout:6000}).then(()=>true,()=>false);
  const mode=process.argv.includes('--expect-broken')?'before':'after';
  await page.screenshot({path:`${evidence}/cache-upgrade-${mode}.png`});
  const report={mode,loaded,errors,legacyRequests,content:(await page.locator('#content').innerText()).slice(0,160)};
  await writeFile(`${evidence}/cache-upgrade-${mode}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  if(mode==='before'){
    assert.equal(loaded,false);assert.ok(errors.some(e=>e.includes('botDifficulty')),'Cached older module must reproduce the failure');
  }else{
    assert.equal(loaded,true);assert.deepEqual(errors,[]);assert.equal(await page.locator('.rating-guide h1').innerText(),'О рейтинге');
    await page.goto(base+'/botstats/?view=defeats&lang=ru&theme=auto');await page.waitForSelector('#content[aria-busy=false]');assert.equal(await page.locator('#results tbody tr').count(),8);
    await page.reload();await page.waitForSelector('#content[aria-busy=false]');assert.deepEqual(errors,[]);
  }
}finally{await browser.close();await new Promise(resolve=>proxy.close(resolve));}
