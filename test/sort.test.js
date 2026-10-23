import test from 'node:test';
import assert from 'node:assert/strict';
import {sortRows} from '../public/sort.js';
test('sorting uses raw signed numbers, numeric names and stable missing-last order',()=>{
  const rows=[{v:null,id:0},{v:10,id:1},{v:-2,id:2},{v:100,id:3},{v:10,id:4}];
  assert.deepEqual(sortRows(rows,r=>r.v).map(r=>r.id),[2,1,4,3,0]);
  assert.deepEqual(sortRows(rows,r=>r.v,'desc').map(r=>r.id),[3,1,4,2,0]);
  assert.deepEqual(sortRows(['map10','map2','map1'],x=>x),['map1','map2','map10']);
  assert.deepEqual(sortRows([[10,2],[2,20],[10,1]],x=>x),[[2,20],[10,1],[10,2]]);
});
