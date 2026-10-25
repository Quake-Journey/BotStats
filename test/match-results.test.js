import test from 'node:test';
import assert from 'node:assert/strict';
import {MongoClient} from 'mongodb';
import {normalizeMatchResult} from '../public/match-result.js';
import {matchResultStages} from '../src/match-results.js';
import {aggregateMatches} from '../src/store.js';
import {buildDynamics} from '../src/dynamics.js';
import {buildBotVictims} from '../src/bot-victims.js';
import {createService} from '../src/server.js';
import {testPath} from './support/paths.js';
import {game} from './support/achievement-fixtures.js';

test('interruption and forfeit always give the bot the win, preserving score and evidence',()=>{
  for(const reverse of [false,true])for(const status of ['interrupted','forfeit'])for(const scores of [[10,2],[2,10],[0,0]]){
    const raw=game(1,{status,hs:scores[0],bs:scores[1],winnerIndex:null});
    if(reverse)raw.participants.reverse();const copy=structuredClone(raw),m=normalizeMatchResult(raw);
    assert.equal(m.status,'forfeit');assert.equal(m.winnerIndex,reverse?0:1);assert.equal(m.forfeitBy,'Tester');
    assert.deepEqual(m.participants,raw.participants);assert.deepEqual(raw,copy);assert.strictEqual(normalizeMatchResult(m),m);
    if(status==='interrupted')assert.equal(m.resultCorrection,'interrupted_as_forfeit');
  }
});

test('missing completed winner follows unequal final scores; genuine draws and exclusions survive',()=>{
  for(const [hs,bs,winner]of [[2,0,0],[0,2,1],[2,2,null],[-1,-2,0]]){
    const m=normalizeMatchResult(game(1,{hs,bs,winnerIndex:null}));assert.equal(m.winnerIndex,winner);assert.equal(m.status,'completed');
  }
  const excluded=normalizeMatchResult(game(1,{status:'interrupted',ratingExcluded:'opponent_changed'}));
  assert.equal(excluded.ratingExcluded,'opponent_changed');assert.equal(aggregateMatches([excluded]).botWins,0);
  const invalid=game(1,{status:'interrupted'});invalid.participants[0].isBot=true;assert.strictEqual(normalizeMatchResult(invalid),invalid);
});

test('legacy stored results normalize before status filtering in every API without changing stored records',async()=>{
  const config={database:'q2pro_botstats_results_r17_test',mongoUri:'mongodb://127.0.0.1:27017/?directConnection=true',ingestToken:'result-policy-test-'.repeat(4),storageDir:testPath('match-results'),basePath:'/botstats'};
  const rows=[game(1,{status:'interrupted',winnerIndex:null,hs:12,bs:0}),game(2,{winnerIndex:null,hs:0,bs:2}),game(3,{hs:1,bs:0}),game(4,{hs:1,bs:1})];
  const manifest={demo:{sha256:'7'.repeat(64)},parserVersion:'0.1.6',matches:rows};
  const {app,store}=await createService(config),server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const get=async suffix=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/botstats/api/`+suffix);assert.equal(r.status,200);return r.json();};
  try{
    await store.save(manifest);
    const summary=await get('summary');assert.equal(summary.matches,4);assert.equal(summary.botWins,2);assert.equal(summary.humanWins,1);
    assert.equal(summary.players.find(p=>!p.isBot).draws,1);
    assert.equal((await get('matches?status=interrupted')).total,0);assert.equal((await get('matches?status=forfeit')).total,1);
    const detail=await get('matches/award-1');assert.equal(detail.status,'forfeit');assert.equal(detail.forfeitBy,'Tester');assert.deepEqual(detail.participants.map(p=>p.score),[12,0]);
    assert.equal((await get('matches/award-2')).winnerIndex,1);
    const dynamics=await get('dynamics');assert.equal(dynamics.totals.botWins,2);assert.equal(dynamics.totals.forfeits,1);
    const victims=await get('victims');assert.equal(victims.items[0].botWins,2);assert.equal(victims.items[0].forfeitWins,1);
    assert.equal((await store.demo(manifest.demo.sha256)).matches[0].status,'interrupted','Read normalization does not rewrite stored data');
    assert.equal(aggregateMatches(rows).botWins,summary.botWins);assert.equal(buildDynamics(rows).totals.botWins,summary.botWins);assert.equal(buildBotVictims(rows).items[0].botWins,2);
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));await store.close();}
});

test('Mongo normalization and parser/browser normalization agree for missing, inverted and valid results',async()=>{
  const client=new MongoClient('mongodb://127.0.0.1:27017/?directConnection=true');await client.connect();
  const collection=client.db('q2pro_botstats_results_r17_test').collection('parity');
  try{
    const rows=[];let i=0;
    for(const status of ['completed','interrupted','forfeit'])for(const winnerIndex of [null,0,1])for(const [hs,bs]of [[0,2],[2,0],[2,2]]){
      const m=game(++i,{status,winnerIndex,hs,bs});if(i%2)m.participants.reverse();rows.push(m);
    }
    const missing=game(++i,{hs:2,bs:0});delete missing.winnerIndex;rows.push(missing);
    for(const m of rows)await collection.replaceOne({_id:m.id},{_id:m.id,...m},{upsert:true});
    const actual=await collection.aggregate([{$match:{_id:{$in:rows.map(m=>m.id)}}},...matchResultStages(),{$project:{_id:0}}]).toArray();
    for(const m of actual)assert.deepEqual(m,normalizeMatchResult(rows.find(x=>x.id===m.id)),m.id);
  }finally{await client.close();}
});
