import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createService} from '../src/server.js';
import {testPath} from './support/paths.js';
import {matchPoints} from '../public/rating.js';

test('ingested effective modes and fractional skills agree in detail, lists, summaries and achievement evidence',async()=>{
  const config={mongoUri:'mongodb://127.0.0.1:27017',database:'q2pro_botstats_modes_test',ingestToken:'test-mode-ingestion-only-'.repeat(3),storageDir:testPath('modes-api'),basePath:'/botstats'};
  const {app,store}=await createService(config),server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const base=`http://127.0.0.1:${server.address().port}/botstats/api`,headers={'x-ingest-token':config.ingestToken,'content-type':'application/json'};
  const payload=Buffer.from('4d56443203000102030000','hex'),sha=createHash('sha256').update(payload).digest('hex');
  const mode=initial=>({initial,changed:false,timeline:[{fromMs:0,toMs:600000,value:initial}]});
  const match={id:sha+'-0-0',map:'q2duel5',status:'completed',winnerIndex:0,statsComplete:false,startedAt:'2026-10-28T10:00:00Z',durationSeconds:600,timelineDurationMs:600000,startObserved:true,modes:{hardcore:mode(true),training:mode(false)},participants:[{name:'Mode API human',score:20,isBot:false,stats:null},{name:'God-X[225]',profile:'God-X',isBot:true,skill:225.5,style:'default',score:0,stats:null}],recordedSettings:{snapshots:[]}};
  const manifest={schemaVersion:1,parserVersion:'0.2.0',demo:{sha256:sha,size:payload.length,originalName:'modes-api-fixture.mvd2',recordedAt:null,dateSource:null},matches:[match]};
  try{
    assert.equal((await fetch(base+'/ingest/demos/'+sha,{method:'PUT',headers,body:payload})).status,200);
    const put=await fetch(base+'/ingest/manifests',{method:'POST',headers,body:JSON.stringify(manifest)});assert.ok(put.ok,await put.text());
    const detail=await(await fetch(base+'/matches/'+match.id)).json(),list=await(await fetch(base+'/matches?q=Mode%20API%20human')).json();
    assert.deepEqual(detail.modes,match.modes);assert.equal(detail.participants[1].skill,225.5);
    assert.deepEqual(detail.rating.points,[0,1].map(i=>matchPoints(match,i)));assert.deepEqual(list.items[0].rating.points,detail.rating.points);
    assert.equal(list.items[0].recordedSettings,undefined,'Large raw snapshots are excluded from lists');
    const summary=await(await fetch(base+'/summary?q=Mode%20API%20human')).json();
    assert.equal(summary.players.find(p=>!p.isBot).victoryPoints,matchPoints(match,0));
    assert.equal(summary.players.find(p=>p.isBot).points,matchPoints(match,1));
    const proof=await(await fetch(base+'/achievements/death-breath?player=Mode%20API%20human')).json();assert.deepEqual(proof.evidence.matches[0].modes,match.modes);
    match.modes.training=mode(true);
    assert.ok((await fetch(base+'/ingest/manifests',{method:'POST',headers,body:JSON.stringify(manifest)})).ok);
    const updated=await(await fetch(base+'/summary?q=Mode%20API%20human')).json();assert.equal(updated.matches,1);assert.ok(Math.abs(updated.players.find(p=>!p.isBot).victoryPoints-11.275)<1e-9);
  }finally{await new Promise(r=>server.close(r));await store.close();}
});
