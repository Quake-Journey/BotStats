import test from 'node:test';
import assert from 'node:assert/strict';
import {buildHome,homeProjection} from '../src/home.js';
import {game} from './support/achievement-fixtures.js';
import {winLabel} from '../public/home-ui.js';

test('home victory captions agree with the number in Russian and English',()=>{
  for(const [n,label] of [[0,'побед'],[1,'победа'],[2,'победы'],[5,'побед'],[11,'побед'],[12,'побед'],[14,'побед'],[21,'победа'],[22,'победы'],[111,'побед'],[114,'побед'],[124,'победы']])assert.equal(winLabel(n,'ru'),label);
  assert.equal(winLabel(1,'en'),'win');assert.equal(winLabel(2,'en'),'wins');
});

test('home counts wins, not rating points; forfeits belong to bots and profiles group skills',()=>{
  const a=game(1,{human:'A'}),b=game(2,{human:'B',skill:50,hs:0,bs:10}),c=game(3,{human:'A',status:'interrupted',hs:99,bs:0}),d=game(4,{human:'C',ratingExcluded:'changed_opponent'});
  for(const m of [a,b,c,d])Object.defineProperty(m,'rating',{get(){throw Error('Rating must not be calculated');}});
  const s=buildHome([a,b,c,d],new Date('2026-11-03T00:00:00Z'));
  assert.equal(s.matches,4);assert.equal(s.humanWins,1);assert.equal(s.botWins,2);assert.equal(s.uniqueHumans,3);
  assert.equal(s.players.filter(p=>p.isBot).length,1);assert.equal(s.players[0].name,'David-X');assert.equal(s.players[0].wins,2);
  assert.equal(s.players.find(p=>p.name==='C').wins,0);assert.equal(s.lastHumanWinAt,a.startedAt);assert.equal(s.lastBotWinAt,c.startedAt);
  for(const key of ['rating','gameplay','recordedSettings','participants.stats','participants.skillTimeline'])assert.equal(homeProjection[key],undefined);
});
test('home empty history and unknown dates preserve unknowns',()=>{
  assert.equal(buildHome([]).players.length,0);assert.equal(buildHome([]).lastHumanWinAt,null);
  const s=buildHome([game(1,{startedAt:null,durationSeconds:null,recordedSeconds:60})]);assert.equal(s.minutes,1);assert.equal(s.lastHumanWinAt,null);
});
