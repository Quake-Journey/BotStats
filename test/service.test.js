import {testPath} from './support/paths.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createService } from '../src/server.js';
import { sendManifest } from '../src/importer.js';
import { parseTable } from '../src/parser.js';

test('API: auth, validation, durable publication, dedupe, download and filters',async()=>{
  const payload=Buffer.from('4d56443203000102030000','hex'),sha=createHash('sha256').update(payload).digest('hex');
  const dir=testPath('api-test');await mkdir(dir,{recursive:true});const file=dir+'/fixture.mvd2';await writeFile(file,payload);
  const table=parseTable(await readFile(new URL('./fixtures/stats.txt',import.meta.url),'utf8'));
  const fixture={schemaVersion:1,parserVersion:'0.1.0',demo:{sha256:sha,size:payload.length,originalName:'fixture.mvd2',recordedAt:null,dateSource:null},matches:[{id:sha+'-0-0',map:table.map,participants:table.participants,status:'completed',winnerIndex:0,statsComplete:true,startedAt:null,durationSeconds:600,recordedSeconds:600}]};
  const config={database:'q2pro_botstats_test',mongoUri:'mongodb://127.0.0.1:27017/?directConnection=true',ingestToken:'test-secret-'.repeat(4),storageDir:testPath('api-test'),basePath:'/botstats'};
  const {app,store}=await createService(config),server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const apiUrl=`http://127.0.0.1:${server.address().port}/botstats`,headers={'x-ingest-token':config.ingestToken,'content-type':'application/json'};
  try {
    assert.equal((await fetch(apiUrl+'/api/ingest/manifests',{method:'POST',body:'{}',headers:{'content-type':'application/json'}})).status,401);
    assert.equal((await fetch(apiUrl+'/api/ingest/manifests',{method:'POST',body:'{}',headers})).status,400);
    const missing=structuredClone(fixture);missing.demo.sha256='0'.repeat(64);missing.matches.forEach(m=>m.id='0'.repeat(64)+'-0-0');
    assert.equal((await fetch(apiUrl+'/api/ingest/manifests',{method:'POST',body:JSON.stringify(missing),headers})).status,409);
    assert.equal((await fetch(apiUrl+'/api/ingest/demos/'+'0'.repeat(64),{method:'PUT',body:'bad file',headers:{'x-ingest-token':config.ingestToken}})).status,422);
    assert.equal((await sendManifest({...config,apiUrl},file,fixture)).accepted,true);
    assert.equal((await sendManifest({...config,apiUrl},file,fixture)).duplicate,true);
    const oldImport=structuredClone(fixture);
    Object.assign(oldImport.matches[0],{scoreSource:'server_stats',timelineDurationMs:600000,scoreHistory:[{timeMs:0,scores:[0,0]},{timeMs:590000,scores:[12,4]}]});
    await store.save(oldImport);
    const detail=await(await fetch(apiUrl+'/api/matches/'+fixture.matches[0].id)).json();
    assert.deepEqual(detail.scoreHistory.at(-1),{timeMs:600000,scores:[13,4]});
    assert.equal((await store.match(fixture.matches[0].id)).scoreHistory.length,2,'Reading old data does not rewrite it');
    await store.save(fixture);
    const matches=await(await fetch(apiUrl+'/api/matches')).json();assert.equal(matches.items.filter(m=>m.demo.sha256===sha).length,1);
    assert.equal((await(await fetch(apiUrl+'/api/matches?q=pp&map=q2duel5')).json()).items.some(m=>m.demo.sha256===sha),true);
    assert.equal((await(await fetch(apiUrl+'/api/matches?q=%5B.*%5D')).json()).total,0);
    const downloaded=Buffer.from(await(await fetch(apiUrl+'/api/demos/'+fixture.demo.sha256)).arrayBuffer());assert.equal(createHash('sha256').update(downloaded).digest('hex'),fixture.demo.sha256);
    const redirect=await fetch(apiUrl,{redirect:'manual'});assert.equal(redirect.status,308);assert.equal((await fetch(apiUrl+'/')).status,200);
    const html=await fetch(apiUrl+'/');assert.equal(html.headers.get('cache-control'),'no-cache');
    const markup=await html.text(),assetRoot=markup.match(/\.\/assets\/[a-f0-9]{20}\//)?.[0];assert.ok(assetRoot,'Content-addressed asset directory');
    assert.ok([...markup.matchAll(/(?:src|href)="(\.\/assets\/[^\"]+)"/g)].every(m=>m[1].startsWith(assetRoot)),'Every initial asset has the same revision');
    const moduleURL=apiUrl+'/'+assetRoot.slice(2)+'app.js';const appSource=await(await fetch(moduleURL)).text();
    for(const match of appSource.matchAll(/from ['"](\.\/[^'"]+)['"]/g))assert.equal((await fetch(new URL(match[1],moduleURL))).status,200,'Relative dependency in same revision');
    const css=await fetch(apiUrl+'/assets/style.css');assert.equal(css.headers.get('cache-control'),'no-cache');
    assert.equal((await fetch(apiUrl+'/assets/../../local.json')).status,404);
    const summary=await(await fetch(apiUrl+'/api/summary')).json();assert.ok(summary.botWins>=1);assert.ok(summary.players.find(p=>p.name==='pp').losses>=1);
    const many=structuredClone(fixture);
    many.matches=Array.from({length:45},(_,i)=>{const m=structuredClone(fixture.matches[0]);m.id=sha+'-0-'+i;m.participants[0].score=i;m.participants[1].name='sorting-probe';return m;});
    await store.save(many);
    try{
      const first=await(await fetch(apiUrl+'/api/matches?q=sorting-probe&sort_matches=score&dir_matches=desc')).json();
      const second=await(await fetch(apiUrl+'/api/matches?q=sorting-probe&sort_matches=score&dir_matches=desc&page=2')).json();
      assert.equal(first.total,45);assert.deepEqual(first.items.map(m=>m.participants[0].score),Array.from({length:20},(_,i)=>44-i));
      assert.equal(second.items[0].participants[0].score,24);
      const asc=await(await fetch(apiUrl+'/api/matches?q=sorting-probe&sort_matches=score&dir_matches=asc')).json();assert.equal(asc.items[0].participants[0].score,0);
      const defeats=await(await fetch(apiUrl+'/api/matches?q=sorting-probe&humanDefeats=1&sort_matches=margin&dir_matches=desc')).json();
      assert.equal(defeats.total,40);assert.equal(defeats.items[0].participants[0].score,44);
      const smallest=await(await fetch(apiUrl+'/api/matches?q=sorting-probe&humanDefeats=1&sort_matches=margin&dir_matches=asc')).json();assert.equal(smallest.items[0].participants[0].score,5);
      const cannot=await(await fetch(apiUrl+'/api/matches?q=sorting-probe&humanDefeats=1&status=interrupted')).json();assert.equal(cannot.total,0);
      assert.equal(defeats.items[0].rating.difficulty.factor,1);
    }finally{await store.save(fixture);}
  }finally{await new Promise(r=>server.close(r));await store.close();}
});
