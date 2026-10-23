import test from 'node:test';
import assert from 'node:assert/strict';
import {computeAchievements,publicAchievements,achievementDetail,regulationSeconds,DEFINITIONS} from '../src/achievements.js';
import {game,collection} from './support/achievement-fixtures.js';
const awards=rows=>computeAchievements(rows).players.get('Tester')?.awards||new Map();
const has=(rows,id)=>awards(rows).has(id);
const series=(n,options={})=>Array.from({length:n},(_,i)=>game(i,options));

test('all 17 independent award definitions can be earned, locked metadata stays hidden',()=>{
  const catalog=publicAchievements(computeAchievements(collection()));
  assert.equal(catalog.items.length,17);assert.equal(new Set(DEFINITIONS.map(x=>x.id)).size,17);
  assert.deepEqual(publicAchievements(computeAchievements([])).items,[]);
  assert.equal(achievementDetail(computeAchievements([]),'death-breath'),null);
});
test('shutouts: 20+ and 10..19, exactly zero for bot, strong throughout',()=>{
  for(const [score,death,immortal] of [[9,false,false],[10,false,true],[19,false,true],[20,true,false],[40,true,false]]){
    assert.equal(has([game(0,{hs:score})],'death-breath'),death);
    assert.equal(has([game(0,{hs:score})],'immortal'),immortal);
  }
  for(const options of [{bs:-1},{bs:1},{skill:199},{status:'forfeit'},{startObserved:false},{ratingExcluded:'opponent_changed'}])assert.equal(has([game(0,options)],'death-breath'),false);
  assert.equal(has([game(0,{bot:'GOD-X',skill:250})],'death-breath'),true);
  assert.equal(has([game(0,{bot:'Human-X',skill:100})],'death-breath'),false);
  const m=game(0);m.participants[1].skillTimeline=[{fromMs:0,toMs:1,value:100},{fromMs:1,toMs:600000,value:200}];
  assert.equal(has([m],'death-breath'),false);
  m.participants[1].skillTimeline=[{fromMs:1,toMs:600000,value:200}];assert.equal(has([m],'death-breath'),false);
});
test('OT requires ten minutes of regulation, not combined OT length',()=>{
  const options={seconds:650,overtime:true,overtimePlayed:true,overtimePeriods:[{fromMs:600000,toMs:650000}]};
  assert.equal(has(series(4,options),'strategist'),false);assert.equal(has(series(5,options),'strategist'),true);
  options.overtimePeriods=[{fromMs:120000,toMs:600000},{fromMs:600000,toMs:650000}];
  assert.equal(has(series(5,options),'strategist'),false);assert.equal(has(series(5,options),'cowboy'),false);
  assert.equal(regulationSeconds(game(0,{...options,startObserved:false})),null);
  assert.equal(regulationSeconds(game(0,{overtime:true})),null);
});
test('explorer counts human forfeit losses, not bot losses or interrupted matches',()=>{
  assert.equal(has(series(9,{status:'forfeit',winnerIndex:1}),'explorer'),false);
  assert.equal(has(series(10,{status:'forfeit',winnerIndex:1}),'explorer'),true);
  assert.equal(has(series(10,{status:'forfeit',winnerIndex:0}),'explorer'),false);
  assert.equal(has(series(10,{status:'interrupted',winnerIndex:1}),'explorer'),false);
});
test('map pool requires ten matches on EACH map; duplicates and forfeits do not count',()=>{
  const rows=series(10).concat(series(10,{map:'ztn2dm3'}).map((m,i)=>({...m,id:'z'+i})),series(9,{map:'q3t2'}).map((m,i)=>({...m,id:'q'+i})));
  assert.equal(has(rows,'universal-soldier'),false);
  assert.equal(has([...rows,...rows],'universal-soldier'),false);
  assert.equal(has([...rows,game(40,{map:'q3t2',status:'forfeit'})],'universal-soldier'),false);
  assert.equal(has([...rows,game(40,{map:'q3t2'})],'universal-soldier'),true);
});
test('revocable loss balance: earned, revoked, restored; only exact ten-minute regulation',()=>{
  const rows=series(14,{hs:0,bs:1}).concat(series(4).map((m,i)=>game(14+i)));
  assert.equal(has(rows,'punching-bag'),true);assert.equal(awards(rows).get('punching-bag').metric,10);
  rows.push(game(18));assert.equal(has(rows,'punching-bag'),false);
  rows.push(game(19,{hs:0,bs:1}));assert.equal(has(rows,'punching-bag'),true);
  assert.equal(has(series(10,{hs:0,bs:1,seconds:601}),'punching-bag'),false);
  assert.equal(has(series(10,{hs:0,bs:1,seconds:610,overtime:true,overtimePeriods:[{fromMs:600000}]}),'punching-bag'),true);
  assert.equal(has([...series(10,{hs:0,bs:1}),game(15,{status:'forfeit'})],'punching-bag'),true);
});
test('diplomacy accepts either winner; cannon uses actual kills not net score',()=>{
  assert.equal(has(series(10,{hs:2,bs:3}),'diplomacy'),true);
  const rows=series(15,{hs:14});rows.forEach(m=>m.participants[0].stats.kills=15);
  assert.equal(has(rows,'human-cannon'),true);
  rows[14].participants[0].stats.kills=14;assert.equal(has(rows,'human-cannon'),false);
  rows[14]=game(14);delete rows[14].participants[0].stats;assert.equal(has(rows,'human-cannon'),false);
});
test('I can win: <100 entire match and duration >=600',()=>{
  assert.equal(has(series(15,{skill:99}),'i-can-win'),true);
  for(const o of [{skill:100},{skill:99,seconds:599},{skill:99,status:'forfeit'}])assert.equal(has(series(15,o),'i-can-win'),false);
  const rows=series(15,{skill:50});rows[0].participants[1].skillTimeline=[{fromMs:0,toMs:1,value:100},{fromMs:1,toMs:600000,value:50}];
  assert.equal(has(rows,'i-can-win'),false);
});
test('100 completed games, no forfeits; streak skips FF and breaks on other results',()=>{
  assert.equal(has(series(99),'farm-owner'),false);assert.equal(has(series(100),'farm-owner'),true);
  assert.equal(has([...series(99),game(100,{status:'forfeit'})],'farm-owner'),false);
  assert.equal(has([...series(4),game(4,{status:'forfeit'}),game(5)],'cowboy'),true);
  for(const o of [{hs:0,bs:1},{hs:1,bs:1},{skill:100},{seconds:120},{status:'interrupted'}])assert.equal(has([...series(4),game(4,o),game(5)],'cowboy'),false);
  assert.equal(has([...series(5),game(5,{hs:0,bs:1})],'cowboy'),true,'earned streak persists');
});
test('comeback works in either participant order; never use final margin alone',()=>{
  const m=game(0,{hs:21,bs:20,scoreHistory:[{timeMs:0,scores:[0,10]}]});assert.equal(has([m],'comeback'),true);
  m.participants.reverse();m.winnerIndex=1;m.scoreHistory[0].scores.reverse();assert.equal(has([m],'comeback'),true);
  m.scoreHistory=[];assert.equal(has([m],'comeback'),false);
});
test('revenge needs next completed match, same bot/map, no lower skill',()=>{
  const loss=game(0,{hs:0,bs:20});assert.equal(has([loss,game(1)],'revenge'),true);
  assert.equal(has([loss,game(1,{status:'forfeit'}),game(2)],'revenge'),true);
  for(const o of [{map:'q3t2'},{bot:'Pacifist-X'},{skill:199},{seconds:599},{hs:0,bs:1}])assert.equal(has([loss,game(1,o)],'revenge'),false);
  assert.equal(has([loss,game(1,{status:'interrupted'}),game(2)],'revenge'),false);
});
test('head hunter counts characters, crowns count distinct map pool',()=>{
  const rows=['David-X','Pacifist-X','OptiMus-X','GOD-X','Polosatiy-X'].map((bot,i)=>game(i,{bot}));
  assert.equal(has(rows,'head-hunter'),true);assert.equal(has(series(5),'head-hunter'),false);
  assert.equal(has(['q2duel5','ztn2dm3','q3t2'].map((map,i)=>game(i,{map})),'three-crowns'),true);
});
test('one-shot requires sudden death after 0:0 regulation; resort requires known pickup stats',()=>{
  const m=game(0,{hs:1,seconds:610,overtime:true,overtimeKind:'sudden_death',overtimePeriods:[{fromMs:600000}],scoreHistory:[{timeMs:599900,scores:[0,0]},{timeMs:610000,scores:[1,0]}]});
  assert.equal(has([m],'one-shot'),true);m.scoreHistory[0].scores=[1,1];assert.equal(has([m],'one-shot'),false);
  const r=game(1,{map:'ztn2dm3'});r.participants[0].stats.control=[{name:'Mega Health',pickups:3}];
  assert.equal(has([r],'resort-closed'),true);r.statsComplete=false;assert.equal(has([r],'resort-closed'),false);
  r.statsComplete=true;r.participants[1].stats.control=[{name:'Mega Health',pickups:1}];assert.equal(has([r],'resort-closed'),false);
});
test('evidence pagination, separate nicknames, source correction and deleted records',()=>{
  const rows=series(100);const index=computeAchievements(rows);
  const detail=achievementDetail(index,'farm-owner',{player:'Tester',page:5});assert.equal(detail.evidence.total,100);assert.equal(detail.evidence.matches.length,20);
  assert.equal(achievementDetail(index,'farm-owner',{player:'another'}).evidence,null);
  assert.equal(achievementDetail(computeAchievements(rows.slice(1)),'farm-owner'),null);
  const other=game(100,{human:'Another'});assert.equal(publicAchievements(computeAchievements([other])).items[0].holders[0].name,'Another');
});
