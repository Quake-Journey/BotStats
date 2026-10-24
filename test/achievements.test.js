import test from 'node:test';
import assert from 'node:assert/strict';
import {computeAchievements,publicAchievements,achievementDetail,regulationSeconds,DEFINITIONS} from '../src/achievements.js';
import {game,collection,newAwards} from './support/achievement-fixtures.js';
const awards=rows=>computeAchievements(rows).players.get('Tester')?.awards||new Map();
const has=(rows,id)=>awards(rows).has(id);
const series=(n,options={})=>Array.from({length:n},(_,i)=>game(i,options));

test('all 24 independent award definitions can be earned, locked metadata stays hidden',()=>{
  const catalog=publicAchievements(computeAchievements(collection()));
  assert.equal(catalog.items.length,24);assert.equal(new Set(DEFINITIONS.map(x=>x.id)).size,24);
  assert.deepEqual(publicAchievements(computeAchievements([])).items,[]);
  assert.equal(achievementDetail(computeAchievements([]),'death-breath'),null);
});

const newIds=['negative-intelligence','god-slayer','old-school','surgeon','rail-monopoly','personal-space','last-minute'];
test('new awards require a confirmed full win, ten minutes and constant skill; old rules unchanged',()=>{
  for(const [i,m] of newAwards().entries()){
    assert.equal(has([m],newIds[i]),true,newIds[i]);
    for(const patch of [{status:'forfeit'},{status:'interrupted'},{winnerIndex:1},{startObserved:false},{durationSeconds:599},{ratingExcluded:'opponent_changed'},{statsComplete:false}]){
      if(patch.statsComplete===false&&[0,1,6].includes(i))continue;
      assert.equal(has([{...m,...patch}],newIds[i]),false,newIds[i]+JSON.stringify(patch));
    }
    const changed=structuredClone(m),b=changed.participants[1];
    b.skillTimeline=[{fromMs:0,toMs:100000,value:200},{fromMs:100000,toMs:200000,value:100},{fromMs:200000,toMs:600000,value:b.skill}];
    assert.equal(has([changed],newIds[i]),false,'skill changed and returned: '+newIds[i]);
    delete b.skillTimeline;b.skillVariable=true;
    assert.equal(has([changed],newIds[i]),false,'variable flag: '+newIds[i]);
    const reverse=structuredClone(m);reverse.participants.reverse();reverse.winnerIndex=1;reverse.scoreHistory.forEach(x=>x.scores.reverse());
    assert.equal(has([reverse],newIds[i]),true,'participant order: '+newIds[i]);
  }
  assert.equal(has([game(0,{bot:'GOD-X',skill:250,skillVariable:true})],'death-breath'),true,'Existing 200+ shutout is not made constant-skill-only');
});
test('negative intelligence is exactly skill 200, ten minutes, 10+ versus a negative final score',()=>{
  for(const [patch,expected]of [[{hs:9,bs:-1},false],[{hs:10,bs:0},false],[{hs:10,bs:-1},true],[{hs:20,bs:-5},true],[{hs:10,bs:-1,seconds:900},false],[{hs:10,bs:-1,bot:'GOD-X',skill:250},false],[{hs:10,bs:-1,overtime:true},false]])assert.equal(has([game(0,patch)],'negative-intelligence'),expected);
});
test('god slayer requires GOD-X 250 and a 15-frag margin',()=>{
  for(const [options,expected]of [[{hs:24,bs:10},false],[{hs:25,bs:10},true],[{hs:30,bs:10,skill:200},false],[{hs:25,bs:10,bot:'David-X'},false]])assert.equal(has([game(0,{bot:'GOD-X',skill:250,...options})],'god-slayer'),expected);
});
test('old school requires an explicit zero rail-shot count, never missing or legacy data',()=>{
  const m=newAwards()[2];
  for(const shots of [1,null,undefined]){const x=structuredClone(m);x.participants[0].stats.weapons[0].shots=shots;assert.equal(has([x],'old-school'),false);}
  m.participants[0].stats.weapons=[];assert.equal(has([m],'old-school'),false);
});
test('surgeon uses unrounded hits/shots and at least 15 shots',()=>{
  for(const [hits,shots,expected]of [[7,14,false],[7,15,false],[8,15,true],[8,16,true],[99,199,false],[null,20,false]]){
    const m=newAwards()[3];Object.assign(m.participants[0].stats.weapons[0],{hits,shots,accuracyPercent:50});assert.equal(has([m],'surgeon'),expected);
  }
});
test('rail monopoly includes dropped pickups, requires explicit bot zero and q2duel5',()=>{
  const m=newAwards()[4];m.participants[0].stats.weapons=[{name:'Railgun',pickups:9}];assert.equal(has([m],'rail-monopoly'),true,'All pickups take priority over map control');
  m.participants[1].stats.pickups=[{name:'Railgun',count:1}];assert.equal(has([m],'rail-monopoly'),false,'Dropped rail is still a bot pickup');
  delete m.participants[1].stats.pickups;m.participants[1].stats.weapons=[];assert.equal(has([m],'rail-monopoly'),false,'Missing is not zero');
  const x=newAwards()[4];x.map='ztn2dm3';assert.equal(has([x],'rail-monopoly'),false);
});
test('personal space counts actual telefrags; last minute uses score at the cutoff, no overtime',()=>{
  const m=newAwards()[5];m.participants[0].stats.telefrags=2;assert.equal(has([m],'personal-space'),false);
  const minute=newAwards()[6];assert.equal(has([minute],'last-minute'),true);
  minute.scoreHistory[2].timeMs=539000;assert.equal(has([minute],'last-minute'),false,'Five behind earlier, only four at the cutoff');
  minute.scoreHistory=[];assert.equal(has([minute],'last-minute'),false);
  const ot=newAwards()[6];ot.overtime=true;assert.equal(has([ot],'last-minute'),false);
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
