import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBotVictims} from '../src/bot-victims.js';
import {createService} from '../src/server.js';
import {game} from './support/achievement-fixtures.js';
import {testPath} from './support/paths.js';

const fixture=()=>[
  game(0,{human:'q',bot:'David-X',hs:5,bs:20}),
  game(1,{human:'q',bot:'David-X',skill:50,hs:20,bs:5}),
  game(2,{human:'q',bot:'David-X',hs:30,bs:-1,status:'forfeit',winnerIndex:1}),
  game(3,{human:'q',bot:'David-X',hs:10,bs:10}),
  game(4,{human:'q',bot:'GOD-X',skill:250,hs:1,bs:8}),
  game(5,{human:'other',bot:'David-X',hs:1,bs:10}),
  game(6,{human:'unbeaten',hs:20,bs:0}),
  game(7,{human:'q',hs:0,bs:99,status:'interrupted',winnerIndex:null}),
  game(8,{human:'q',hs:0,bs:99,ratingExcluded:'opponent_changed'})
];
test('victims: pair identities, all results in denominator, technical wins and pre-forfeit score',()=>{
  const rows=fixture(),reverse=structuredClone(rows[0]);reverse.participants.reverse();reverse.winnerIndex=0;rows[0]=reverse;
  const result=buildBotVictims([...rows,rows[0]]);assert.equal(result.total,3);
  assert.deepEqual(result.items[0],{bot:'David-X',human:'q',matches:4,botWins:2,forfeitWins:1,botWinPercent:50,lastBotWinAt:rows[2].startedAt,lastBotWinMatchId:rows[2].id,scoredMatches:4,averageBotFrags:8.5,averageHumanFrags:16.25});
  assert.ok(result.items.some(x=>x.bot==='GOD-X'&&x.human==='q'));
  assert.ok(!result.items.some(x=>x.human==='unbeaten'));
});
test('victims: missing dates/scores stay unknown and invalid results are excluded',()=>{
  const row=game(1,{hs:2,bs:3,startedAt:null});row.participants[1].score=null;
  const result=buildBotVictims([row,game(2,{winnerIndex:99}),game(3,{winnerIndex:undefined}),{...game(4),participants:[]}]);
  assert.equal(result.total,1);assert.equal(result.items[0].matches,1);assert.equal(result.items[0].lastBotWinAt,null);assert.equal(result.items[0].lastBotWinMatchId,null);assert.equal(result.items[0].averageBotFrags,null);assert.equal(result.items[0].averageHumanFrags,null);
});
test('victims API applies map, bot, player, dates, status, skill and style before grouping',async()=>{
  const config={database:'q2pro_botstats_victims_test',mongoUri:'mongodb://127.0.0.1:27017/?directConnection=true',ingestToken:'victims-test-secret-'.repeat(4),storageDir:testPath('victims-api'),basePath:'/botstats'};
  const {app,store}=await createService(config),server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  try{
    const rows=fixture();rows[2].map='ztn2dm3';
    for(const m of rows)for(const p of m.participants)if(p.isBot){p.skillTimeline=[{value:p.skill,fromMs:0,toMs:600000}];p.styleTimeline=[{value:p.skill===50?'arcade':'default',fromMs:0,toMs:600000}];}
    await store.save({demo:{sha256:'b'.repeat(64)},parserVersion:'0.1.6',matches:rows});
    const get=async q=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/botstats/api/victims?`+q);assert.equal(r.status,200);return r.json();};
    assert.deepEqual(await get(''),buildBotVictims(rows));
    const selected=await get('q=q&bot=David-X');assert.equal(selected.total,1);assert.equal(selected.items[0].matches,4);
    assert.equal((await get('q=q&bot=David-X&map=q2duel5')).items[0].botWins,1);
    assert.equal((await get('q=q&bot=David-X&map=q2duel5')).items[0].lastBotWinMatchId,rows[0].id,'Filtered date and link refer to the same victory');
    assert.equal((await get('q=q&bot=David-X&status=forfeit')).items[0].botWinPercent,100);
    assert.equal((await get('q=q&bot=David-X&status=completed')).items[0].matches,3);
    assert.equal((await get('q=q&bot=David-X&skill=50')).total,0);
    assert.equal((await get('q=q&bot=David-X&style=arcade')).total,0);
    assert.equal((await get('q=q&bot=David-X&from=2026-10-02&to=2026-10-03')).total,0);
    assert.equal((await get('q=%5B.*%5D')).total,0);
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));await store.close();}
});
