import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateMatches} from '../src/store.js';
import {compactMatchDate,timeWithoutWin,winsWithHistory,overviewHistory} from '../public/win-history.js';
import {renderTable} from '../public/tables.js';

const game=(startedAt,status,winnerIndex,map='q2duel5',extra={})=>({
  startedAt,status,winnerIndex,map,durationSeconds:600,statsComplete:false,...extra,
  participants:[{name:'Alice',score:10,isBot:false,stats:null},{name:'David-X[200]',profile:'David-X',score:2,isBot:true,skill:200,stats:null}]
});

test('overview recency follows its win counters including bot technical wins and unique human identities',()=>{
  const rows=[game('2026-10-20T09:00:00Z','completed',0),game('2026-10-23T10:00:00Z','completed',0,'ztn2dm3'),
    game('2026-10-24T09:00:00Z','forfeit',0),game('2026-10-25T10:00:00Z','interrupted',null),
    game('2026-10-26T10:00:00Z','completed',0,'q3t2',{ratingExcluded:'opponent_changed'}),
    game(null,'completed',0),game('invalid','completed',1)];
  const newcomer=game('2026-10-27T10:00:00Z','completed',1,'q3t2');
  newcomer.participants[0].name='David-X';rows.push(newcomer);
  const result=aggregateMatches(rows,true,new Date('2026-10-31T10:00:00Z'));
  assert.equal(result.uniqueHumans,2,'Count humans by name even when a name equals a bot profile');
  assert.equal(result.humanWins,3);assert.equal(result.lastHumanWinAt,'2026-10-23T10:00:00.000Z');
  assert.equal(result.botWins,4);assert.equal(result.lastBotWinAt,'2026-10-27T10:00:00.000Z');
  const duel=result.byMap.find(r=>r.map==='q2duel5');
  assert.equal(duel.uniqueHumans,1);assert.equal(duel.lastBotWinAt,'2026-10-25T10:00:00.000Z');
  assert.equal(duel.lastHumanWinAt,'2026-10-20T09:00:00.000Z');
  for(const field of ['uniqueHumans','lastHumanWinAt','lastBotWinAt'])assert.equal(aggregateMatches([...rows].reverse())[field],result[field]);
  const empty=aggregateMatches([]);assert.equal(empty.uniqueHumans,0);assert.equal(empty.lastHumanWinAt,null);assert.equal(empty.lastBotWinAt,null);
  const undated=aggregateMatches([game(null,'completed',0)]);assert.equal(undated.humanWins,1);assert.equal(undated.lastHumanWinAt,null);
});

test('overview details format dates and elapsed days like the rating table without inventing missing values',()=>{
  const summary={uniqueHumans:12,lastHumanWinAt:'2026-10-25T18:20:00Z',lastBotWinAt:'2026-10-31T10:00:00Z',asOf:'2026-10-31T14:20:00Z'};
  const human=overviewHistory(summary,'humanWins');assert.match(human,/25\.10\.26 21:20/);assert.match(human,/5 д 20 ч/);
  const bot=overviewHistory(summary,'botWins','en');assert.match(bot,/Last win:/);assert.match(bot,/31\.10\.26 13:00/);assert.ok(!bot.includes('Without a win'));
  assert.match(overviewHistory(summary,'allMatches'),/Уникальных игроков:/);assert.match(overviewHistory(summary,'allMatches'),/>12</);
  assert.equal(overviewHistory(summary,'gameTime'),'');
  const missing=overviewHistory({lastHumanWinAt:'<script>',asOf:summary.asOf},'humanWins');
  assert.ok(!missing.includes('<script>'));assert.equal((missing.match(/>—</g)||[]).length,2);
});

test('win recency uses dated completed wins; last game also includes interrupted and forfeit games',()=>{
  const now=new Date('2026-10-24T10:00:00Z');
  const rows=[game('2026-10-23T14:00:00Z','completed',0,'ztn2dm3'),game('2026-10-20T09:00:00Z','completed',0),
    game('2026-10-24T06:00:00Z','forfeit',1),game('2026-10-24T07:00:00Z','interrupted',null),
    game('2026-10-24T08:00:00Z','completed',0,'q2duel5',{ratingExcluded:'opponent_changed'}),
    game('2026-10-23T18:00:00Z','completed',1),game(null,'completed',0),game('invalid','completed',0)];
  const result=aggregateMatches(rows,true,now),human=result.players.find(p=>!p.isBot),bot=result.players.find(p=>p.isBot);
  assert.equal(human.lastWinAt,'2026-10-23T14:00:00.000Z');assert.equal(human.lastGameAt,'2026-10-24T08:00:00.000Z');
  assert.equal(bot.lastWinAt,'2026-10-23T18:00:00.000Z','A later technical win does not replace the ordinary-win date');
  assert.equal(result.byMap.find(m=>m.map==='q2duel5').players.find(p=>!p.isBot).lastWinAt,'2026-10-20T09:00:00.000Z');
  assert.equal(result.byMap[0].asOf,result.asOf);assert.equal(result.asOf,now.toISOString());
  assert.deepEqual(aggregateMatches([...rows].reverse(),true,now).players,result.players,'Input order cannot change recency');
  const missing=aggregateMatches([game(null,'completed',1)]).players.find(p=>!p.isBot);
  assert.equal(missing.lastWinAt,null);assert.equal(missing.lastGameAt,null);
});

test('compact dates use Moscow time; elapsed time uses whole days and remaining hours',()=>{
  assert.equal(compactMatchDate('2026-10-23T21:05:00Z'),'24.10.26 00:05');
  assert.equal(compactMatchDate('2026-12-31T21:59:00Z'),'01.01.27 00:59');
  assert.equal(compactMatchDate(null),'—');assert.equal(compactMatchDate('invalid'),'—');
  assert.deepEqual(timeWithoutWin('2026-10-20T10:00:00Z','2026-10-24T13:59:59Z'),{days:4,hours:3});
  assert.deepEqual(timeWithoutWin('2026-10-24T10:00:00Z','2026-10-24T10:59:59Z'),{days:0,hours:0});
  assert.equal(timeWithoutWin(null,'2026-10-24T10:00:00Z'),null);
  assert.equal(timeWithoutWin('2026-10-25T10:00:00Z','2026-10-24T10:00:00Z'),null);
});

test('display-only date details cannot affect numeric win sorting or become markup',()=>{
  const rows=[{name:'Ten',normalWins:10,lastWinAt:'2026-10-23T10:00:00Z',lastGameAt:'2026-10-24T09:00:00Z'},
    {name:'Two',normalWins:2,lastWinAt:'2026-10-20T10:00:00Z',lastGameAt:'2026-10-24T09:30:00Z'}];
  const asOf='2026-10-24T10:00:00Z',columns=[{key:'name',label:'Name',value:r=>r.name},{key:'normalWins',label:'Wins',value:r=>r.normalWins,render:r=>winsWithHistory(r,{lang:'en',asOf})}];
  const html=renderTable('history',columns,rows,{params:new URLSearchParams('dir_history=asc'),lang:'en',defaultKey:'normalWins'});
  assert.ok(html.indexOf('>Two<')<html.indexOf('>Ten<'));
  assert.match(html,/Last win:/);assert.match(html,/Without a win:/);
  const unknown=winsWithHistory({normalWins:0,lastWinAt:'<script>alert(1)</script>',lastGameAt:null},{lang:'ru',asOf});
  assert.ok(!unknown.includes('<script>'));assert.match(unknown,/Последняя игра:/);assert.match(unknown,/—/);
});
