import test from 'node:test';
import assert from 'node:assert/strict';
import {completeScoreHistory,scoreAxis} from '../public/score-history.js';

// Public match e374c1ea...faf5d9: player 1:2 OptiMus-X[200], sudden death.
const saved={scoreSource:'server_stats',timelineDurationMs:171100,
  participants:[{name:'player',score:1},{name:'OptiMus-X[200]',score:2}],
  scoreHistory:[{timeMs:0,scores:[0,0]},{timeMs:21600,scores:[1,0]},{timeMs:43700,scores:[1,1]}]};
test('old imported match gets final 1:2 at the end, preserving observed history',()=>{
  const history=completeScoreHistory(saved);
  assert.deepEqual(history.slice(0,-1),saved.scoreHistory);
  assert.deepEqual(history.at(-1),{timeMs:171100,scores:[1,2]});
  assert.equal(saved.scoreHistory.length,3,'No database object mutation');
  assert.deepEqual(completeScoreHistory({...saved,scoreHistory:history}),history);
});
test('forfeit keeps actual score even if the human led; interrupted history stays observed',()=>{
  const match={...saved,status:'forfeit',winnerIndex:1,participants:[{score:10},{score:3}]};
  assert.deepEqual(completeScoreHistory(match).at(-1).scores,[10,3]);
  assert.equal(completeScoreHistory({...match,status:'interrupted',scoreSource:'hud_before_reset'}),saved.scoreHistory);
});
test('a missing history does not fabricate an opening score or time of a frag',()=>{
  assert.deepEqual(completeScoreHistory({...saved,scoreHistory:[]}),[{timeMs:171100,scores:[1,2]}]);
  assert.deepEqual(completeScoreHistory({...saved,scoreHistory:[],scoreSource:'hud_before_reset'}),[]);
});
test('score scales have distinct integer ticks for small, negative and large scores',()=>{
  for(const scores of [[0,0],[1,1],[1,2],[-1,0],[-5,-2],[-17,43],[180,230]]){
    const {min,max,ticks}=scoreAxis([{scores}]);
    assert.ok(min<=Math.min(...scores)&&max>=Math.max(...scores));
    assert.ok(ticks.length>=2&&ticks.length<=6);
    assert.ok(ticks.every(Number.isInteger));assert.equal(new Set(ticks).size,ticks.length);
  }
  assert.deepEqual(scoreAxis(completeScoreHistory(saved)).ticks,[0,1,2]);
});
