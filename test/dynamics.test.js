import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDynamics} from '../src/dynamics.js';
import {game} from './support/achievement-fixtures.js';
const now=new Date('2026-10-23T12:00:00Z');
test('victory counts include forfeits and interruptions irrespective of score, genuine draws excluded',()=>{
  const rows=[game(1),game(2,{skill:50,hs:0,bs:1}),game(3,{status:'forfeit',winnerIndex:1,hs:40,bs:0}),game(4,{hs:2,bs:2}),game(5,{status:'interrupted'}),game(6,{ratingExcluded:'opponent_changed'})];
  const d=buildDynamics(rows,{},now);
  assert.equal(d.totals.botWins,3);assert.equal(d.totals.humanWins,1);assert.equal(d.totals.botForfeitWins,2);assert.equal(d.totals.matches,4);
  assert.equal(d.excluded.draws,1);assert.equal(d.excluded.unconfirmed,0);assert.equal(d.excluded.changedOpponent,1);
  rows[0].participants.reverse();rows[0].winnerIndex=1;assert.equal(buildDynamics(rows).totals.humanWins,1);
});
test('MSK date boundary, explicit periods include zero-activity days, null share is not a loss',()=>{
  const rows=[game(0,{startedAt:'2026-10-20T20:59:59Z'}),game(1,{startedAt:'2026-10-20T21:00:00Z',winnerIndex:1})];
  const d=buildDynamics(rows,{from:'2026-10-19',to:'2026-10-22'},now);
  assert.equal(d.unit,'day');assert.equal(d.points.length,4);
  assert.equal(d.points[1].humanWins,1);assert.equal(d.points[2].botWins,1);
  assert.equal(d.points[0].matches,0);assert.equal(d.points[0].botWinPercent,null);
  assert.equal(buildDynamics(rows,{from:'2026-10-21',to:'2026-10-21'}).totals.matches,1);
});
test('automatic scale uses selected range, clips partial weeks/months, preserves totals',()=>{
  const rows=[game(0,{startedAt:'2026-01-02T10:00:00Z'}),game(1,{startedAt:'2026-05-30T10:00:00Z'})];
  const week=buildDynamics(rows,{from:'2026-01-02',to:'2026-05-30'});assert.equal(week.unit,'week');assert.equal(week.points[0].from,'2026-01-02');assert.equal(week.points[0].to,'2026-01-04');assert.equal(week.points.at(-1).to,'2026-05-30');
  const month=buildDynamics(rows,{from:'2026-01-02',to:'2026-12-31'});assert.equal(month.unit,'month');assert.equal(month.points.length,12);assert.equal(month.totals.matches,2);
  const year=buildDynamics(rows,{from:'2020-01-01',to:'2026-12-31'});assert.equal(year.unit,'year');assert.equal(year.points.length,7);assert.equal(year.totals.matches,2);
});
test('missing dates are not fabricated, empty and reversed ranges remain explicit',()=>{
  assert.equal(buildDynamics([game(0,{startedAt:null})]).excluded.undated,1);
  assert.deepEqual(buildDynamics([]).points,[]);
  const empty=buildDynamics([],{from:'2026-10-01',to:'2026-10-07'},now);assert.equal(empty.points.length,7);assert.equal(empty.totals.matches,0);
  assert.equal(buildDynamics([],{from:'2026-10-07',to:'2026-10-01'},now).invalidRange,true);
  assert.equal(buildDynamics([],{from:'2026-10-22'},now).points.length,2);
});
