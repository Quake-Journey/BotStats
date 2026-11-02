import test from 'node:test';
import assert from 'node:assert/strict';
import {buildChart,chartProjection,chartSelection,durationBucket,makeChartCache} from '../src/charts.js';
import {game} from './support/achievement-fixtures.js';

test('duration bins have no gaps or overlap; partial time is not full match time',()=>{
  const cases=[[0,'under10'],[9.99,'under10'],[10,'10to30'],[29.99,'10to30'],[30,'30to60'],[59.99,'30to60'],[60,'minute1'],[119.99,'minute1'],[120,'minute2'],[599.99,'minute9'],[600,'minute10'],[600.01,'over10']];
  for(const [seconds,bucket] of cases)assert.equal(durationBucket(game(0,{seconds})),bucket);
  assert.equal(durationBucket(game(0,{startObserved:false,seconds:10})),'unknown');
  assert.equal(durationBucket(game(0,{durationSeconds:null,timelineDurationMs:null,recordedSeconds:2})),'unknown');
});
test('all games versus completed only; interrupted never becomes a human win; segments drill to exact counts',()=>{
  const rows=[game(1),game(2,{hs:0,bs:10}),game(3,{status:'forfeit',hs:50,bs:0}),game(4,{status:'interrupted'}),game(5,{hs:2,bs:2}),game(6,{ratingExcluded:'opponent_changed'})];
  const all=buildChart(rows,'duration');assert.deepEqual(all.totals,{key:'total',humanWins:1,botWins:3,forfeits:2,draws:1,matches:5});
  const normal=buildChart(rows,'duration',{chartResults:'completed'});assert.equal(normal.totals.matches,3);assert.equal(normal.totals.forfeits,0);
  for(const [outcome,n] of [['human',1],['bot',1],['forfeit',2],['draw',1],['all',5]])assert.equal(chartSelection(rows,'duration',{bucket:'minute10',chartOutcome:outcome}).length,n);
  const finished=buildChart(rows,'finished');assert.equal(finished.totals.matches,3);assert.equal(finished.trend.totals.matches,2);assert.equal(finished.trend.totals.forfeits,0);
  assert.equal(buildChart(rows,'margin').totals.matches,3);
});
test('profile maxima, variable weighted skill and unknown histories remain distinct',()=>{
  const variable=game(1,{skillVariable:true});variable.participants[1].skillVariable=true;variable.participants[1].skillTimeline=[{fromMs:0,toMs:300000,value:100},{fromMs:300000,toMs:600000,value:200}];
  const d=buildChart([game(2,{bot:'Human-X',skill:100}),game(3,{bot:'GOD-X',skill:250}),game(4),variable,game(5,{startObserved:false})],'skill');
  assert.equal(d.groups.find(x=>x.key==='100').matches,3);assert.equal(d.groups.find(x=>x.key==='50to75').matches,1);assert.equal(d.groups.find(x=>x.key==='unknown').matches,1);
});
test('changing back to original mode remains variable; missing modes are never off',()=>{
  const d=buildChart([game(1,{modes:{hardcore:{initial:false,final:false,changed:true},training:{initial:false}}}),game(2),game(3,{modes:{hardcore:{initial:true},training:{initial:true}}})],'modes');
  assert.equal(d.groups.find(g=>g.key==='variable').matches,1);assert.equal(d.groups.find(g=>g.key==='unknown').matches,1);assert.equal(d.groups.find(g=>g.key==='both').matches,1);
});
test('items use comparable time exposure per map, with no fabricated missing pickups or forfeits',()=>{
  const a=game(1,{seconds:600}),b=game(2,{seconds:120}),c=game(3,{status:'forfeit'}),missing=game(4),partial=game(5,{startObserved:false});
  for(const m of [a,b,c,partial]){m.participants[0].stats.control=[{name:'Mega Health',pickups:2}];m.participants[1].stats.control=[{name:'Mega Health',pickups:1}];}
  missing.participants[0].stats.control=[{name:'Mega Health',pickups:99}];
  const d=buildChart([a,b,c,missing,partial],'items');assert.equal(d.eligible,2);assert.equal(d.groups.length,1);assert.equal(d.groups[0].matches,2);assert.equal(d.groups[0].winnerPer10,4*600/720);assert.equal(d.groups[0].loserPer10,2*600/720);
});
test('activity uses Moscow local weekday and hour; dates are never guessed',()=>{
  const a=game(1,{startedAt:'2026-11-01T21:15:00Z'}),b=game(2,{startedAt:null});const d=buildChart([a,b],'activity');
  assert.equal(d.groups.find(g=>g.key==='0-0').matches,1);assert.equal(d.groups.find(g=>g.key==='unknown').matches,1);
});
test('opened-chart projections omit unrelated heavy metadata; unknown chart rejects',()=>{
  assert.equal(chartProjection('duration')['participants.stats.control'],undefined);assert.equal(chartProjection('duration')['participants.skillTimeline'],undefined);
  assert.equal(chartProjection('skill')['participants.skillTimeline'],1);assert.equal(chartProjection('items')['participants.stats.control'],1);
  for(const type of ['duration','skill','items','balance'])for(const field of ['recordedSettings','gameplay','events','scoreHistory'])assert.equal(chartProjection(type)[field],undefined);
  const m=game(0);Object.defineProperty(m.participants[1],'skillTimeline',{get(){throw new Error('Unrelated calculation');}});assert.equal(buildChart([m],'duration').totals.matches,1);
  assert.throws(()=>buildChart([],'bad'),/Unknown chart/);
});
test('chart cache coalesces concurrent requests, invalidates on import, evicts, and retries failures',async()=>{
  const cache=makeChartCache({limit:2,ttl:1000});let calls=0;const load=async()=>{calls++;await new Promise(r=>setTimeout(r,5));return calls;};
  assert.deepEqual(await Promise.all([cache.get('a',load),cache.get('a',load)]),[1,1]);cache.clear();await cache.get('a',load);assert.equal(calls,2);
  await cache.get('b',load);await cache.get('c',load);await cache.get('a',load);assert.equal(calls,5);
  await assert.rejects(cache.get('bad',()=>{throw Error('transient');}));assert.equal(await cache.get('bad',()=>7),7);
});
