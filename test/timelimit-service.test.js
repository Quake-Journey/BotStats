import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {MongoClient} from 'mongodb';
import {createService} from '../src/server.js';
import {testPath} from './support/paths.js';

const ended=[{timeMs:600000,text:'Timelimit hit. Match ended.'}];
function oldMatch(id,overrides={}){
  return {id,map:'koldduel1',status:'completed',winnerIndex:0,startedAt:'2026-11-08T20:00:00Z',
    startObserved:true,startMs:0,endMs:600000,timelineDurationMs:600000,recordedSeconds:600,durationSeconds:120,
    events:ended,participants:[{name:'David-X[200]',profile:'David-X',isBot:true,skill:200,score:22},
      {name:'Duration probe',isBot:false,score:11}],...overrides};
}

test('old imports use corrected time everywhere, before sorting; stored data remains unchanged',async()=>{
  const config={database:'q2pro_botstats_duration_test_'+randomBytes(4).toString('hex'),mongoUri:'mongodb://127.0.0.1:27017',
    storageDir:testPath('duration-api'),ingestToken:'duration-test-only-'.repeat(4),basePath:'/botstats'};
  const {app,store}=await createService(config),server=app.listen(0,'127.0.0.1');
  await new Promise(r=>server.once('listening',r));
  const api=async route=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/botstats/api/`+route);assert.equal(r.status,200);return r.json();};
  const sha='d'.repeat(64),id=n=>sha+'-0-'+n;
  const matches=[oldMatch(id(0)),oldMatch(id(1),{durationSeconds:300,timelineDurationMs:300000,endMs:300000,recordedSeconds:300})];
  const manifest={schemaVersion:1,parserVersion:'0.3.0',demo:{sha256:sha,size:1,originalName:'duration.mvd2'},matches};
  try{
    await store.save(manifest);
    const m=await api('matches/'+id(0));assert.equal(m.durationSeconds,600);assert.equal(m.rating.points[0],10);
    assert.equal(m.durationCorrection,'active_time_after_timelimit_change');
    assert.equal((await store.demo(sha)).matches[0].durationSeconds,120,'No destructive migration');
    assert.deepEqual((await api('matches?sort_matches=duration&dir_matches=desc')).items.map(x=>x.id),[id(0),id(1)]);
    assert.deepEqual((await api('matches?sort_matches=duration&dir_matches=asc')).items.map(x=>x.id),[id(1),id(0)]);
    const summary=await api('summary');assert.equal(summary.minutes,15);assert.equal(summary.averageCompletedDurationSeconds,450);
    assert.equal(summary.players.find(p=>p.isBot).points,m.rating.points[0]+(await api('matches/'+id(1))).rating.points[0]);
    const home=await api('home');assert.equal(home.minutes,15);assert.equal(home.latest.durationSeconds,600);
    const chart=await api('chart-matches/duration?bucket=minute10');assert.equal(chart.total,1);assert.equal(chart.items[0].id,id(0));

    // Current metadata can eliminate frame drift, even when imported by 0.3.0.
    const snapshots=[{timeMs:100,event:'start',settings:{duration_seconds:120}},
      {timeMs:115000,event:'change',settings:{duration_seconds:600}},
      {timeMs:600000,event:'end',settings:{duration_seconds:600}},
      {timeMs:600100,event:'change',settings:{duration_seconds:1200}}];
    const variants=[
      oldMatch(id(2),{timelineDurationMs:599900,endMs:599900,recordedSettings:{snapshots}}),
      oldMatch(id(3),{durationSeconds:600,timelineDurationMs:120000,endMs:120000}),
      oldMatch(id(4),{durationSeconds:120,timelineDurationMs:151300,endMs:151300}),
      ...[{status:'forfeit'},{startObserved:false},{overtime:true},{overtimePlayed:true},
        {events:[{text:'Duration probe: Timelimit hit. Match ended.'}]},{events:[]},{durationSeconds:null},
        {timelineDurationMs:120100},{durationSeconds:'120'},{timelineDurationMs:'600000'}].map((patch,i)=>oldMatch(id(5+i),patch))
    ];
    await store.save({...manifest,matches:variants});
    const expected=[600,120,151.3,...variants.slice(3).map(m=>m.durationSeconds)];
    for(let i=0;i<variants.length;i++)assert.equal((await store.match(variants[i].id)).durationSeconds,expected[i],variants[i].id);
    assert.deepEqual((await store.demo(sha)).matches,variants);
  }finally{
    await new Promise(r=>server.close(r));await store.close();
    const client=new MongoClient(config.mongoUri);await client.connect();
    try{await client.db(config.database).dropDatabase();}finally{await client.close();}
  }
});
