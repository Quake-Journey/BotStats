import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {computeProgressAchievements as calculate,PROGRESS_DEFINITIONS as defs,activateProgressSet,PROGRESS_SET_ID} from '../src/progress-achievements.js';
import {computeAchievements,publicAchievements,achievementDetail} from '../src/achievements.js';
import {activation,progressSeries} from './support/progress-fixtures.js';
const owner=d=>d.audience==='bot'?'Purri-X':'Пример игрока';
const award=(rows,d,at=activation)=>calculate(rows,at)[d.audience].get(owner(d))?.awards.get(d.id);
test('40 distinct conditions: exact boundary, evidence and post-activation date',()=>{
  assert.equal(defs.length,40);assert.equal(new Set(defs.map(x=>x.id)).size,40);
  for(const d of defs){
    const rows=progressSeries(d),last=rows.at(-1);
    assert.equal(award(rows.slice(0,-1),d),undefined,d.id+' below threshold');
    const a=award(rows,d);assert.ok(a,d.id);assert.equal(a.evidence.length,rows.length,d.id);
    assert.equal(a.earnedAt,new Date(Date.parse(last.startedAt)+last.durationSeconds*1000).toISOString());
    assert.equal(award(rows,d,a.earnedAt),undefined,'Historical or exact activation boundary: '+d.id);
    assert.equal(award(rows,d,null),undefined,'Activation required: '+d.id);
    assert.equal(award([...rows,...rows],d).metric,a.metric,'Duplicates: '+d.id);
    const reverse=rows.map(m=>({...m,participants:[...m.participants].reverse(),winnerIndex:1-m.winnerIndex}));
    assert.ok(award(reverse,d),'Participant order: '+d.id);
    for(const patch of [{status:'forfeit'},{status:'interrupted'},{ratingExcluded:'opponent_changed'},{startObserved:false},{durationSeconds:d.metric.startsWith('wins2min:')?119:599},{startedAt:null}]){
      assert.equal(award(rows.map(m=>({...m,...patch})),d),undefined,d.id+JSON.stringify(patch));
    }
  }
});
test('activation keeps historical progress but never backdates awards or grants to historical qualifiers',()=>{
  const d=defs.find(d=>d.metric==='longGames'&&d.audience==='human'),rows=progressSeries(d);
  const at=rows.at(-1).startedAt;
  assert.ok(award(rows,d,at));
  assert.equal(award(rows,d,new Date(Date.parse(at)+601000).toISOString()),undefined);
  // Late historical imports sorted by completion cannot become a fresh crossing.
  const later={...rows.at(-1),id:'later',startedAt:'2027-01-01T00:00:00Z'};
  assert.equal(award([later,...rows],d,'2026-12-01T00:00:00Z'),undefined);
});
test('maximum skill uses full covered timeline and each bot scale',()=>{
  const d=defs.find(d=>d.metric==='maxSkillWins'),rows=progressSeries(d);
  for(const [profile,skill]of [['Human-X',100],['GOD-X',250],['Purri-X',200]]){
    const games=structuredClone(rows);games.forEach(m=>Object.assign(m.participants[1],{profile,skill,name:profile+'['+skill+']'}));assert.ok(award(games,d),profile);
    games.at(-1).participants[1].skillTimeline=[{fromMs:0,toMs:300000,value:skill},{fromMs:300000,toMs:600000,value:skill-1}];
    assert.equal(award(games,d),undefined,profile+' changed');
  }
});
test('unknown and variable modes cannot earn constant-hardcore award',()=>{
  const d=defs.find(d=>d.metric==='hardcoreNoTrainingWins'),rows=progressSeries(d);
  for(const modes of [{},{hardcore:{initial:true,changed:true},training:{initial:false}},{hardcore:{initial:true},training:{initial:true}},{hardcore:{initial:true},training:{initial:false,variable:true}}]){
    rows.at(-1).modes=modes;assert.equal(award(rows,d),undefined);
  }
});
test('stats criteria require explicit counters, valid precision and no duplicate pickup/weapon credit',()=>{
  for(const d of defs.filter(d=>/kills|pickups:|rail50|wins3weapons|winsClean/.test(d.metric))){
    const rows=progressSeries(d);rows.at(-1).statsComplete=false;assert.equal(award(rows,d),undefined,d.id);
  }
  const rail=defs.find(d=>d.metric==='rail50Wins'),shots=progressSeries(rail);
  for(const counters of [{shots:15,hits:7},{shots:14,hits:7},{shots:16,hits:null},{shots:16,hits:17}]){
    shots.at(-1).participants[0].stats.weapons=[{name:'Railgun',...counters}];assert.equal(award(shots,rail),undefined);
  }
  const red=defs.find(d=>d.metric==='pickups:Body Armor'),rows=progressSeries(red,red.threshold-1);
  rows.forEach(m=>m.participants[0].stats.control=[{name:'Body Armor',pickups:1}]);assert.equal(award(rows,red),undefined);
  const tri=defs.find(d=>d.metric==='wins3weapons'),three=progressSeries(tri);
  three.at(-1).participants[0].stats.weapons=[{name:'C.Gun',kills:3},{name:'Chaingun',kills:3},{name:'Railgun',kills:3}];assert.equal(award(three,tri),undefined);
});
test('map/day uniqueness, MSK date and short-map exceptions',()=>{
  for(const metric of ['mapsWon','days']){
    const d=defs.find(d=>d.metric===metric),rows=progressSeries(d);
    if(metric==='mapsWon')rows.at(-1).map=rows[0].map;
    else rows.at(-1).startedAt=rows.at(-2).startedAt;
    assert.equal(award(rows,d),undefined,metric);
  }
  const day=defs.find(d=>d.metric==='days'),rows=progressSeries(day,2);
  rows[0].startedAt='2026-11-01T20:59:00Z';rows[1].startedAt='2026-11-01T21:01:00Z';
  assert.equal(calculate(rows)[day.audience].get(owner(day)).metrics.get('days'),2);
  assert.equal(defs.filter(d=>d.metric.startsWith('wins2min:')).length,5);
});
test('activation record is set once, validates storage and handles a simultaneous first start',async()=>{
  let saved=null;
  const collection={async updateOne(query,update){assert.equal(query._id,PROGRESS_SET_ID);saved??=update.$setOnInsert;},async findOne(){return saved;}};
  assert.equal(await activateProgressSet(collection,new Date(activation)),activation);
  assert.equal(await activateProgressSet(collection,new Date('2027-01-01')),activation);
  collection.updateOne=async()=>{throw Object.assign(Error('duplicate'),{code:11000});};assert.equal(await activateProgressSet(collection),activation);
  saved={activatedAt:'broken'};await assert.rejects(()=>activateProgressSet(collection),/activation timestamp/);
});
test('new catalog/proof integration and every icon exists; old awards still work with no activation',async()=>{
  const d=defs[0],rows=progressSeries(d),index=computeAchievements(rows,{progressActivatedAt:activation});
  const catalog=publicAchievements(index);assert.ok(catalog.items.some(a=>a.id===d.id));
  assert.ok(!('threshold' in catalog.items.find(a=>a.id===d.id)));
  const proof=achievementDetail(index,d.id,{player:owner(d)});assert.equal(proof.evidence.total,100);assert.ok(proof.evidence.matches.every(Boolean));
  assert.equal(publicAchievements(computeAchievements(rows)).items.some(a=>a.id.startsWith('progress-')),false);
  const icons=await Promise.all(defs.map(d=>readFile(new URL('../public/'+d.icon,import.meta.url),'utf8')));
  assert.equal(new Set(icons).size,40);
});
