import test from 'node:test';
import assert from 'node:assert/strict';
import {matchPoints,botWinAward} from '../public/rating.js';
import {aggregateMatches} from '../src/store.js';
const match=(seconds=600,skill=200,profile='David-X',status='completed')=>({status,winnerIndex:1,startObserved:true,durationSeconds:seconds,timelineDurationMs:seconds*1000,
 participants:[{name:'Human',isBot:false,score:50},{name:`${profile}[${skill}]`,profile,skill,isBot:true,score:status==='forfeit'?0:60}]});
test('bot normal/forfeit duration boundaries, positive short rewards and exact half discount',()=>{
 for(const [seconds,expected]of [[0,.1],[1,.1],[119.999,.1],[120,.1],[120.001,.100020625],[300,3.8125],[360,5.05],[600,10],[900,10]]){
  const m=match(seconds);assert.ok(Math.abs(matchPoints(m,1)-expected)<1e-10,String(seconds));
  m.status='forfeit';assert.ok(Math.abs(matchPoints(m,1)-expected/2)<1e-10);
  m.participants[1].score=100;assert.ok(Math.abs(matchPoints(m,1)-expected/2)<1e-10,'Score does not change technical win');
 }
});
test('own profile maxima, active-time variable skill, unknown required fields and participant order',()=>{
 for(const [profile,max]of [['David-X',200],['GOD-X',250],['Human-X',100]]){
  assert.equal(matchPoints(match(600,max,profile),1),10);assert.equal(matchPoints(match(600,max/2,profile),1),5);
  assert.ok(matchPoints(match(1,1,profile,'forfeit'),1)>0);
 }
 const m=match();m.participants[1].skillTimeline=[{fromMs:0,toMs:300000,value:50},{fromMs:300000,toMs:600000,value:200}];
 assert.equal(matchPoints(m,1),6.25);m.participants.reverse();m.winnerIndex=0;assert.equal(matchPoints(m,0),6.25);
 m.participants[0].skillTimeline[0].fromMs=1;assert.equal(matchPoints(m,0),null);
 for(const patch of [{startObserved:false},{durationSeconds:null,timelineDurationMs:null},{durationSeconds:-1},{ratingExcluded:'opponent_changed'},{status:'interrupted'}])assert.equal(matchPoints({...match(),...patch},1),null);
 assert.equal(botWinAward({...match(),startObserved:false}).known,false);
 const tied=match();tied.winnerIndex=null;assert.equal(matchPoints(tied,1),0);
});
test('aggregation keeps tiny positive awards and fractions; loss policy remains intact',()=>{
 const normal=match(300,100),technical=match(1,1,'GOD-X','forfeit');
 const s=aggregateMatches([normal,normal,technical]);
 assert.ok(Math.abs(s.players.find(p=>p.name==='David-X').points-3.8125)<1e-12);
 assert.equal(s.players.find(p=>p.name==='GOD-X').points,.0002);
 const loss=match();loss.winnerIndex=0;assert.equal(matchPoints(loss,1),-1);
});
