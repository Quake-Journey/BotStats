import test from 'node:test';
import assert from 'node:assert/strict';
import {matchPoints} from '../public/rating.js';
test('instant forfeit uses a confirmed zero-length skill observation without inventing a mixed average',()=>{
 const m={status:'forfeit',winnerIndex:1,startObserved:true,durationSeconds:0,timelineDurationMs:0,
  participants:[{name:'Tester',isBot:false,score:0},{name:'GOD-X[1]',profile:'GOD-X',isBot:true,skill:1,score:0,skillTimeline:[{fromMs:0,toMs:0,value:1}]}]};
 assert.equal(matchPoints(m,1),.0002);
 m.participants[1].skillVariable=true;assert.equal(matchPoints(m,1),null);
 m.participants[1].skillVariable=false;m.participants[1].skillTimeline.push({fromMs:0,toMs:0,value:250});assert.equal(matchPoints(m,1),null);
});
