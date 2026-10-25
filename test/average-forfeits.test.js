import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateMatches} from '../src/store.js';
import {rankParticipants,matchPoints} from '../public/rating.js';
import {aboutPage} from '../public/about.js';
import {humanPerformance} from '../public/performance-rating.js';

function match(name,status='completed',winnerIndex=0,map='q2duel5'){
  return {map,status,winnerIndex,durationSeconds:600,startObserved:true,participants:[
    {name,isBot:false,score:5},
    {name:'David-X[200]',profile:'David-X',isBot:true,skill:200,score:2}
  ]};
}
const human=rows=>aggregateMatches(rows).players.find(p=>!p.isBot);

test('forfeits cannot change human mean, denominator, tie breaks or ordinary outcomes',()=>{
  const rows=[match('q'),match('q','completed',1),match('q','completed',null)];
  const before=human(rows),after=human([...rows,...Array.from({length:100},()=>match('q','forfeit',1))]);
  for(const key of ['points','pointsPerMatch','ratedMatches','unratedMatches','normalWins','normalLosses','normalMatches','completedWinRate'])assert.equal(after[key],before[key],key);
  assert.equal(after.pointsPerMatch,3);assert.equal(after.forfeitRate,100/103*100);
  assert.equal(after.finished,103);assert.equal(after.losses,101);
  assert.equal(matchPoints(match('q','forfeit',1),0),0);
});

test('Average separates provisional players and sorts performance, not reward totals',()=>{
  const rows=[...Array.from({length:10},()=>match('Many')),...Array.from({length:10},()=>match('Many','completed',1)),match('Once')];
  const r=aggregateMatches(rows).players.filter(p=>!p.isBot);
  assert.deepEqual(rankParticipants(r,'average').map(p=>p.name),['Many','Once']);
  const ff=human([match('Only forfeits','forfeit',1)]);
  assert.equal(ff.pointsPerMatch,null);assert.equal(ff.ratedMatches,0);assert.equal(ff.unratedMatches,0);
  assert.equal(rankParticipants([...r,ff],'average').at(-1).name,'Only forfeits');
});

test('anti-ranking counts only known results, sorts percentages then counts, and keeps map scopes',()=>{
  const rows=[match('A','forfeit',1),match('A'),match('A','interrupted',null),{...match('A'),ratingExcluded:'opponent_changed'},
    match('B','forfeit',1),match('B','forfeit',1),match('B'),match('B'),match('C','forfeit',1,'q3t2')];
  const s=aggregateMatches(rows),r=rankParticipants(s.players.filter(p=>!p.isBot),'forfeits');
  assert.deepEqual(r.map(p=>[p.name,p.forfeitRate,p.finished]),[['C',100,1],['B',50,4],['A',50,2]]);
  assert.equal(s.byMap.find(m=>m.map==='q3t2').players.find(p=>!p.isBot).forfeitRate,100);
  assert.equal(r.find(p=>p.name==='A').unratedMatches,0);
});

test('unknown skill cannot dilute average; zero-point short games and draws do count',()=>{
  const missing=match('q');missing.participants[1].name='David-X';delete missing.participants[1].skill;
  const short={...match('q'),durationSeconds:60};
  const r=human([match('q'),missing,short,match('q','completed',null),match('q','forfeit',1)]);
  assert.equal(r.pointsPerMatch,10/3);assert.equal(r.normalMatches,4);assert.equal(r.ratedMatches,3);assert.equal(r.unratedMatches,1);
});

test('pp regression: 23 wins, 30 losses and 66 forfeits remain separate',()=>{
  const wins=Array.from({length:23},()=>match('pp'));
  // 21 full wins + two 3.5-minute wins give the observed 215.375 points.
  for(const m of wins.slice(21))m.durationSeconds=210;
  const rows=[...wins,...Array.from({length:30},()=>match('pp','completed',1)),...Array.from({length:66},()=>match('pp','forfeit',1))];
  const r=human(rows);assert.equal(r.victoryPoints,215.375);assert.equal(r.points,185.375);
  assert.equal(r.pointsPerMatch,185.375/53);assert.equal(r.forfeitRate,66/119*100);
  assert.equal(r.normalWins,23);assert.equal(r.normalLosses,30);assert.equal(r.normalMatches,53);
});

test('RU and EN guides show the new average and anti-ranking with no old human forfeit penalty',()=>{
  for(const lang of ['ru','en']){
    const html=aboutPage(lang,'href="/botstats/"');
    assert.ok(html.includes(lang==='ru'?'Антирейтинг forfeit':'Forfeit anti-ranking'));
    assert.ok(html.includes(lang==='ru'?'Оценка силы игры':'Playing strength adjusted'));
    assert.ok(!html.includes('−5'));assert.ok(!html.includes('23 Average points'));
  }
});

test('performance rewards equivalent outcomes against stronger bots and larger winning margins',()=>{
  const rows=Array.from({length:12},()=>match('Player'));
  const weak=structuredClone(rows);for(const m of weak){m.participants[1].skill=50;m.participants[1].name='David-X[50]';}
  assert.ok(humanPerformance(rows).value>humanPerformance(weak).value);
  const bigger=structuredClone(rows);for(const m of bigger){m.participants[0].score=20;m.participants[1].score=0;}
  assert.ok(humanPerformance(bigger).value>humanPerformance(rows).value);
  const narrowLoss=structuredClone(rows);for(const m of narrowLoss){m.winnerIndex=1;m.participants[0].score=19;m.participants[1].score=20;}
  assert.ok(humanPerformance(rows).value>humanPerformance(narrowLoss).value,'Winning is more important than a narrow loss');
});

test('more consistent full games reduce uncertainty; short wins and one game cannot dominate',()=>{
  const one=humanPerformance([match('X')]),ten=humanPerformance(Array.from({length:10},()=>match('X'))),twenty=humanPerformance(Array.from({length:20},()=>match('X')));
  assert.ok(twenty.value>ten.value&&ten.value>one.value);assert.equal(one.provisional,true);assert.equal(ten.provisional,false);
  const short=humanPerformance(Array.from({length:10},()=>({...match('X'),durationSeconds:120})));
  assert.ok(ten.value>short.value);assert.equal(humanPerformance([{...match('X'),durationSeconds:119.9}]).value,null);
});

test('performance uses duration-weighted skill; has no nickname, upload order or forfeit dependency',()=>{
  const rows=Array.from({length:12},(_,i)=>match('pp','completed',i%2));
  const result=humanPerformance(rows);
  assert.deepEqual(humanPerformance([...rows,...Array.from({length:60},()=>match('pp','forfeit',1))]),result);
  const changed=structuredClone(rows).reverse();for(const m of changed)m.participants[0].name='Any other name';
  assert.equal(humanPerformance(changed).value,result.value);
  const mixed=match('X');mixed.timelineDurationMs=600000;mixed.participants[1].skillTimeline=[{fromMs:0,toMs:300000,value:50},{fromMs:300000,toMs:600000,value:200}];
  const constant=match('X');constant.participants[1].skill=125;
  assert.equal(humanPerformance([mixed]).value,humanPerformance([constant]).value);
  const humanBot=match('X');Object.assign(humanBot.participants[1],{profile:'Human-X',name:'Human-X[100]',skill:100});
  assert.equal(humanPerformance([humanBot]).value,humanPerformance([match('X')]).value);
});

test('performance is a bounded strength index, independent of win percentage and cumulative rewards',()=>{
  for(const count of [1,10,100])for(const skill of [1,50,200])for(const won of [true,false]){
    const rows=Array.from({length:count},()=>{
      const m=match('Player','completed',won?0:1);
      Object.assign(m.participants[1],{name:`David-X[${skill}]`,skill,score:won?0:50});
      m.participants[0].score=won?50:0;return m;
    });
    const p=humanPerformance(rows);
    assert.ok(p.value>0&&p.value<100);assert.ok(p.estimate>0&&p.estimate<100);
    assert.ok(p.value<p.estimate,'Conservative estimate stays below central estimate');
    assert.notEqual(p.value,p.winRate,'Index is not an observed win percentage');
    assert.equal(p.provisional,count<10);
  }
  const wins=human(Array.from({length:20},()=>match('Player')));
  assert.equal(wins.victoryPoints,200);assert.ok(wins.performance.value<100);
});

test('balanced identical draws keep the central index at 50; missing evidence remains unknown',()=>{
  const draws=Array.from({length:20},()=>{const m=match('Player','completed',null);m.participants[1].score=5;return m;});
  const p=humanPerformance(draws);assert.equal(p.estimate,50);assert.ok(p.value>0&&p.value<50);
  for(const rows of [[],[match('Player','forfeit',1)],[{...match('Player'),durationSeconds:119}]]){
    const p=humanPerformance(rows);assert.equal(p.value,null);assert.equal(p.estimate,null);
  }
});

test('rating guides explain the 0–100 index rather than a win percentage or reward average',()=>{
  for(const lang of ['ru','en']){
    const html=aboutPage(lang,'href="/botstats/"');
    assert.ok(html.includes(lang==='ru'?'индекс силы игры от 0 до 100':'playing-strength index from 0 to 100'));
    assert.ok(html.includes(lang==='ru'?'Это не процент побед':'It is not a win percentage'));
    assert.ok(html.includes('100 × sigmoid('));assert.ok(!html.includes('max(0, 1000 +'));
  }
});
