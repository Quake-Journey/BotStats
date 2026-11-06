import test from 'node:test';
import assert from 'node:assert/strict';
import {profileSummaryQuery,profileStanding} from '../public/profile-rating.js';

const bot=(name,points,extra={})=>({name,isBot:true,points,ratedMatches:10,wins:5,matches:10,...extra});
const human=(name,value,extra={})=>({name,isBot:false,normalWins:5,ratedMatches:10,performance:{value,provisional:false,games:10,...extra}});

test('profile comparison keeps gameplay filters but excludes the participant and match page',()=>{
  const params=new URLSearchParams('profile=pp&kind=human&map=q2duel5&period=custom&from=2026-10-01&to=2026-10-30&skill=200&style=default&modVersion=beta12&status=completed&overtime=1&profilePage=4&sort_matches=score&dir_matches=asc&q=pp&bot=Purri-X');
  const query=profileSummaryQuery(params);
  for(const key of ['map','period','from','to','skill','style','modVersion','status','overtime'])assert.equal(query.get(key),params.get(key));
  for(const key of ['identity','kind','page','sort_matches','dir_matches','q','bot'])assert.equal(query.has(key),false);
  assert.equal(params.get('profilePage'),'4');
});

test('rank uses the full matching kind and rating order, not one-row profile or victory points',()=>{
  const rows=[bot('same',70),human('same',30),human('top',50),human('lower',10)];
  rows[1].victoryPoints=999;
  assert.deepEqual(profileStanding(rows,'same','human'),{value:30,rank:2,provisional:false,games:10});
  assert.equal(profileStanding(rows,'same','bot').rank,1);
  assert.equal(rows[0].name,'same');
});

test('provisional and missing human ratings cannot claim a main leaderboard place',()=>{
  const rows=[human('pending',99,{provisional:true,games:2}),human('ae',null,{provisional:true,games:0}),human('established',40)];
  assert.equal(profileStanding(rows,'established','human').rank,1);
  assert.deepEqual(profileStanding(rows,'pending','human'),{value:99,rank:null,provisional:true,games:2});
  assert.equal(profileStanding(rows,'ae','human').value,null);
  assert.equal(profileStanding(rows,'missing','bot').rank,null);
});

test('rated zero and negative bot points are real ratings; unscored default zero is not',()=>{
  const rows=[bot('negative',-3),bot('zero',0),bot('unscored',0,{ratedMatches:0})];
  assert.equal(profileStanding(rows,'zero','bot').value,0);
  assert.equal(profileStanding(rows,'negative','bot').value,-3);
  assert.equal(profileStanding(rows,'unscored','bot').value,null);
  assert.equal(profileStanding(rows,'unscored','bot').rank,null);
});

test('equal scores use the same win count tie break as the displayed leaderboard',()=>{
  const rows=[bot('first',25,{wins:10}),bot('second',25,{wins:8})];
  assert.equal(profileStanding(rows,'second','bot').rank,2);
});
