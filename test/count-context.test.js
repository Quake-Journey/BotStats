import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateMatches} from '../src/store.js';
import {winCount,winConditions,winConditionsColumn,completedWithDuration} from '../public/count-context.js';
import {renderTable} from '../public/tables.js';

const match=(skill=200,seconds=600,winnerIndex=0,extra={})=>({
  map:'q2duel5',status:'completed',winnerIndex,startObserved:true,durationSeconds:seconds,timelineDurationMs:seconds*1000,
  participants:[{name:'Player',isBot:false,score:winnerIndex===0?10:2},{name:`David-X[${skill}]`,profile:'David-X',isBot:true,skill,score:winnerIndex===0?2:10}],...extra
});
const human=s=>s.players.find(p=>!p.isBot);

test('win skill describes only ordinary wins, weights skill changes within each game, not games by length',()=>{
  const variable=match(150,120);variable.participants[1].skillVariable=true;
  variable.participants[1].skillTimeline=[{fromMs:0,toMs:30000,value:50},{fromMs:30000,toMs:120000,value:150}];
  const unknown=match(200,300);unknown.participants[1].skillVariable=true;
  const draw=match(100,780,null);draw.participants.forEach(p=>p.score=5);
  const rows=[match(),variable,match(50,600,1),match(1,5,1,{status:'forfeit'}),draw,unknown,match(200,600,0,{startObserved:false})];
  const summary=aggregateMatches(rows),p=human(summary);
  assert.equal(p.normalWins,4);assert.equal(p.winBotSkillMatches,2);assert.equal(p.averageWinBotSkill,162.5);
  assert.equal(p.completedMatches,6);assert.equal(p.completedDurationMatches,5);assert.equal(p.averageCompletedDurationSeconds,480);
  assert.equal(summary.averageCompletedDurationSeconds,480);assert.equal(summary.completedDurationMatches,5);
  assert.equal(summary.byMap[0].players.find(p=>!p.isBot).averageWinBotSkill,162.5);
});

test('raw skill uses each profile scale, per-map subsets and either participant order; absent values remain unknown',()=>{
  const god=match(250);Object.assign(god.participants[1],{profile:'GOD-X',name:'GOD-X[250]'});
  const h=match(100,120,0,{map:'q3t2'});Object.assign(h.participants[1],{profile:'Human',name:'Human[100]'});h.participants.reverse();h.winnerIndex=1;
  const summary=aggregateMatches([god,h]);assert.equal(human(summary).averageWinBotSkill,175);
  assert.equal(human(summary.byMap.find(m=>m.map==='q3t2')).averageWinBotSkill,100);
  const loss=human(aggregateMatches([match(200,600,1)]));assert.equal(loss.averageWinBotSkill,null);assert.equal(loss.winBotSkillMatches,0);
  const ff=human(aggregateMatches([match(200,25,1,{status:'forfeit'})]));assert.equal(ff.averageCompletedDurationSeconds,null);assert.equal(ff.completedDurationMatches,0);
});

test('context is labelled and rounding uses a valid min:sec representation',()=>{
  assert.match(winConditions({normalWins:2,averageWinBotSkill:162.5,winBotSkillMatches:2},{lang:'ru'}),/>162,5</);
  assert.match(winConditions({normalWins:0},{lang:'en'}),/Bot skill:/);
  assert.match(completedWithDuration({completedMatches:3,averageCompletedDurationSeconds:599.9,completedDurationMatches:3}),/>10:00</);
  assert.match(completedWithDuration({completedMatches:1},{lang:'en'}),/>—</);
});

test('skill and duration context cannot alter count sorting',()=>{
  const rows=[{name:'Two',normalWins:2,completedMatches:2,averageWinBotSkill:250,averageCompletedDurationSeconds:3600},
    {name:'Ten',normalWins:10,completedMatches:10,averageWinBotSkill:1,averageCompletedDurationSeconds:120}];
  for(const [key,render]of [['normalWins',winCount],['completedMatches',completedWithDuration]]){
    const columns=[{key:'name',label:'Name',value:r=>r.name},{key,label:key,value:r=>r[key],render}];
    const html=renderTable('context',columns,rows,{params:new URLSearchParams('dir_context=desc'),lang:'en',defaultKey:key});
    assert.ok(html.indexOf('>Ten<')<html.indexOf('>Two<'));
  }
});


test('bot ping in wins uses observed bot means, independent of skill, excludes losses/forfeits and distinguishes zero from missing',()=>{
  const withPing=(value,winner=0,status='completed',map='q2duel5')=>{
    const m=match(200,600,winner,{status,map});
    m.participants[0].ping={averageMs:999,samples:10};
    m.participants[1].ping={averageMs:value,samples:2,observedSeconds:6};return m;
  };
  const unknownSkill=withPing(20);unknownSkill.participants[1].skillVariable=true;
  const noSamples=withPing(500);noSamples.participants[1].ping.samples=0;
  const rows=[withPing(100),unknownSkill,withPing(0,0,'completed','q3t2'),withPing(500,1),withPing(1000,1,'forfeit'),match(),noSamples,withPing(-1)];
  const summary=aggregateMatches(rows),p=human(summary);
  assert.equal(p.winBotPingMatches,3);assert.equal(p.averageWinBotPingMs,40);
  assert.equal(human(summary.byMap.find(m=>m.map==='q2duel5')).averageWinBotPingMs,60);
  const zero=human(summary.byMap.find(m=>m.map==='q3t2'));assert.equal(zero.averageWinBotPingMs,0);
  assert.match(winConditions(zero,{lang:'ru'}),/0 мс/);
  const missing=human(aggregateMatches([match()]));assert.equal(missing.averageWinBotPingMs,null);
  assert.match(winConditions(missing,{lang:'en'}),/Bot ping:<\/span> <strong class="win-condition-value">—/);
});


test('human ping follows the human participant in winning games, including a true zero, independently of bot ping',()=>{
  const a=match(),b=match(),loss=match(200,600,1),ff=match(200,600,1,{status:'forfeit'});
  a.participants[0].ping={averageMs:0,samples:1};a.participants[1].ping={averageMs:100,samples:1};
  b.participants[0].ping={averageMs:40,samples:1};b.participants[1].ping={averageMs:200,samples:1};
  b.participants.reverse();b.winnerIndex=1;
  loss.participants[0].ping={averageMs:1000,samples:1};ff.participants[0].ping={averageMs:800,samples:1};
  const p=human(aggregateMatches([a,b,loss,ff,match()]));
  assert.equal(p.averageWinHumanPingMs,20);assert.equal(p.winHumanPingMatches,2);assert.equal(p.averageWinBotPingMs,150);
  assert.equal(human(aggregateMatches([match()])).averageWinHumanPingMs,null);
  const html=winConditions(p,{lang:'ru'});
  for(const label of ['Скилл бота:','Пинг бота:','Пинг игрока:'])assert.ok(html.includes(label));
  const column=winConditionsColumn('ru');assert.equal(column.value(p),p.averageWinBotSkill);assert.equal(column.cellClass,'win-conditions-cell');
  assert.ok(!winCount(p).includes('мс'),'The win count is clear of context');
});
