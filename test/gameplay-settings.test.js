import test from 'node:test';
import assert from 'node:assert/strict';
import {settingsRecords,assembleSettings} from '../src/match-settings.js';
import {gameplayScene,inventory} from './support/gameplay-fixture.js';
import {summarize} from '../src/parser.js';
import {Collector} from '../src/parser.js';
import {gameplayDetail} from '../public/gameplay-ui.js';
const rec=(tag,p,extra={})=>settingsRecords({kind:'print',segment:0,time_ms:0,level:2,text:`OTX_MATCH_${tag} ${JSON.stringify({schema:1,snapshot:1,event:'start',...p})}\n`,...extra});
const text=(part,last,value='abc',source='effective')=>rec('PARAM_TEXT',{cvar:'long',source,part,last,value});
const assemble=rows=>assembleSettings(rows).snapshots[0];

test('extended records keep raw/unknown fields, exclude chat, reject duplicate JSON keys',()=>{
  const p={frame:1,id:'future_preset',modified:0,generation:1,pending:2,opponent:1,factory_sha256:'f'.repeat(64),future:{x:1}};
  const r=rec('GAMEPLAY',p);assert.deepEqual(assemble(r).gameplay.future,{x:1});assert.equal(assemble(r).gameplay.id,'future_preset');assert.equal(assemble(r).complete,false);
  assert.equal(rec('GAMEPLAY',p,{level:3}).length,0);assert.equal(rec('GAMEPLAY',p,{text:'q: OTX_MATCH_GAMEPLAY {}'}).length,0);
  for(const tag of ['GAMEPLAY','BASE_PARAMS','PARAM_TEXT'])assert.equal(settingsRecords({kind:'print',level:2,text:`OTX_MATCH_${tag} {"schema":1,"s\\u0063hema":1}`})[0].error,'duplicate_json_key');
  const future=rec('GAMEPLAY',{...p,schema:2});assert.equal(assembleSettings(future).unparsed[0].payload.schema,2);assert.equal(assemble(future).gameplay,null);
});
test('fragments join losslessly, independent sources/parts; identical repeats are harmless',()=>{
  const rows=[...text(1,1,'"\\\nя'),...text(0,0,'start'),...text(0,1,'base','configured'),...rec('PARAMS',{part:0,values:{other:'value'}}),...rec('BASE_PARAMS',{part:0,values:{other:'base'}})];
  const s=assemble([...rows,...rows]);assert.equal(s.params.long,'start"\\\nя');assert.equal(s.baseParams.long,'base');assert.equal(s.params.other,'value');assert.equal(s.baseParams.other,'base');assert.equal(s.errors.length,0);
});
test('missing, conflicting, over-limit and invalid final fragments never become values',()=>{
  for(const rows of [[...text(1,1)],[...text(0,0)],[...text(0,1),...text(1,1)],[...text(0,1),...text(1,0)],[...text(0,1,'a'),...text(0,1,'b')],[...text(0,1,'a'),...rec('PARAMS',{part:0,values:{long:'b'}})],[...text(0,0,'a'.repeat(40000)),...text(1,1,'b'.repeat(40000))],[...text(0,0),...text(256,1)]]){
    const s=assemble([...rows,...rec('PARAMS',{part:rows.some(r=>r.tag==='OTX_MATCH_PARAMS')?1:0,values:{safe:'kept'}})]);assert.equal(s.params.long,undefined);assert.equal(s.params.safe,'kept');assert.equal(s.complete,false);
  }
  assert.equal(assemble([...text(0,1,'a'),...rec('PARAMS',{part:0,values:{long:'a'}})]).params.long,'a');
});
test('known inventory proves all components; unknown future inventory and incomplete text cannot claim complete',()=>{
  const s=gameplayScene();s.snapshot(1,100,'start');let rows=s.collector.part(0).metadata;
  assert.equal(assemble(rows).complete,true);assert.equal(Object.keys(assemble(rows).params).length,228);
  const removed=structuredClone(rows);delete removed.find(r=>r.tag==='OTX_MATCH_PARAMS').payload.values.otx_bot3_style_maps;
  assert.equal(assemble(removed).complete,false);assert.ok(assemble(removed).missingParams.includes('otx_bot3_style_maps'));
  const future=structuredClone(rows);future.find(r=>r.tag==='OTX_MATCH_GAMEPLAY').payload.factory_sha256='e'.repeat(64);
  assert.equal(assemble(future).completeness.effective.status,'unknown_inventory');assert.equal(assemble(future).complete,false);
  assert.equal(assemble([...rows,...rec('PARAMS',{part:1,values:{future_parameter:'kept'}})]).complete,false);
  const gap=structuredClone(rows);gap.find(r=>r.tag==='OTX_MATCH_BASE_PARAMS').payload.part=2;
  assert.equal(assemble(gap).complete,false);assert.equal(assemble(gap).completeness.effective.status,'complete');
});
test('conflicting event/frame invalidate interpretation, corrupt independent components do not',()=>{
  const s=gameplayScene();s.snapshot(1,100,'start');const rows=s.collector.part(0).metadata;
  for(const field of ['event','frame']){
    const copy=structuredClone(rows);copy[0].payload[field]=field==='frame'?4:'end';const a=assemble(copy);
    assert.equal(a.gameplay,null);assert.equal(a.settings,null);assert.deepEqual(a.params,{});assert.ok(a.records.length);
  }
  const bad=structuredClone(rows);bad.find(r=>r.tag==='OTX_MATCH_BASE_PARAMS').error='invalid_params';
  const a=assemble(bad);assert.equal(a.gameplay.id,'regular');assert.equal(a.settings.hardcore,0);assert.equal(a.complete,false);
});
test('history separates preset, modified, base-only edits and pending; A-B-A remains variable',()=>{
  const s=gameplayScene();s.snapshot(1,100,'start');
  s.snapshot(2,60000,'change',{header:{id:'max_aggression',pending:4},effective:{otx_bot1_aggression:'100'}});
  s.snapshot(3,90000,'change',{header:{id:'max_aggression',pending:4},effective:{otx_bot1_aggression:'100'},configured:{otx_bot1_aggression:'37'}});
  s.snapshot(4,120000,'change',{header:{id:'regular',modified:1},configured:{otx_bot1_aggression:'37'},bot:{skill:150}});
  s.snapshot(5,600100,'end',{header:{id:'regular',modified:1},configured:{otx_bot1_aggression:'37'},bot:{skill:150}});
  const m=s.finish();assert.equal(m.gameplay.preset.initial,'regular');assert.equal(m.gameplay.preset.final,'regular');assert.equal(m.gameplay.preset.variable,true);
  assert.equal(m.gameplay.history.length,3);assert.ok(m.gameplay.history[1].changes.every(c=>c.scope==='configured'));
  assert.equal(m.gameplay.modified.final,true);assert.equal(m.gameplay.pending.timeline[1].value,4);assert.equal(m.timelineDurationMs,600000);
  assert.equal(m.recordedSettings.snapshots.at(-1).matchMs,600000);assert.equal(m.gameplay.history[0].frame,926);
});
test('late start stays unknown, paused clock is used, server id is not regular; 1 aggression means 1%',()=>{
  const late=gameplayScene({fight:false});late.snapshot(1,100,'start');late.snapshot(2,10000,'change',{header:{id:'server'},effective:{otx_bot1_aggression:'1'}});
  const l=late.finish();assert.equal(l.gameplay.preset.initial,null);assert.equal(l.gameplay.preset.final,'server');assert.equal(l.gameplay.preset.variable,true);assert.equal(l.gameplay.aggression.final,1);
  const s=gameplayScene();s.snapshot(1,100,'start');s.emit('print',{time_ms:10000,level:2,text:'Game paused\n'});s.emit('print',{time_ms:20000,level:2,text:'Fight!\n'});s.snapshot(2,30000,'change',{header:{id:'hardcore'}});
  assert.equal(s.finish().gameplay.history[0].at,20000);
});
test('roster is not slot; spectators and reused same-name slots cannot supply opponent model',()=>{
  const s=gameplayScene();s.snapshot(1,100,'start',{bot:{bot:3},header:{opponent:3},effective:{otx_bot1_model:'camper',otx_bot3_model:'regular',otx_bot3_aggression:'37'}});
  s.emit('configstring',{time_ms:10000,index:1312,text:''});s.emit('configstring',{time_ms:11000,index:1312,text:'David-X[200]\\male/grunt'});
  s.snapshot(2,12000,'change',{effective:{otx_bot1_model:'camper'},bot:{skill:50}});
  const m=s.finish();assert.equal(m.gameplay.model.initial,'regular');assert.equal(m.gameplay.aggression.initial,37);assert.equal(m.gameplay.model.final,null);assert.equal(m.gameplay.aggression.final,null);assert.equal(m.participants[0].skill,200);
  const t=gameplayScene();t.snapshot(1,100,'start',{bot:{team:0}});assert.equal(t.finish().gameplay.model.initial,null);
});
test('snapshot identity stays isolated across segments and consecutive matches',()=>{
  const s=gameplayScene();s.snapshot(1,100,'start');s.frame(1000,[1,0]);s.emit('print',{time_ms:1000,level:2,text:'David-X[200] wins, 1 to 0.\n'});
  s.emit('print',{time_ms:2000,level:2,text:'Fight!\n'});s.frame(2000,[0,0]);s.snapshot(1,2100,'start',{header:{id:'training'}});s.frame(3000,[0,1]);s.emit('print',{time_ms:3000,level:2,text:'Пример Пресеты wins, 1 to 0.\n'});
  const ms=summarize(s.collector,s.meta).matches;assert.equal(ms.length,2);assert.equal(ms[0].gameplay.preset.initial,'regular');assert.equal(ms[1].gameplay.preset.initial,'training');
  const records=s.collector.part(0).metadata.filter(r=>r.timeMs===100);assert.equal(assembleSettings([...records,...records.map(r=>({...r,segment:1}))]).snapshots.length,2);
});

test('unknown fields remain inert data, resource limits fail explicitly instead of truncating a manifest',()=>{
  const s=gameplayScene();s.snapshot(1,100,'start',{header:{id:'<img src=x onerror=alert(1)>'}});
  s.snapshot(2,10000,'change',{effective:JSON.parse('{"__proto__":"future value","otx_bot1_model":"<script>test</script>"}')});
  const m=s.finish(),change=m.gameplay.history[0].changes.find(c=>c.key==='__proto__');assert.equal(change.before,null);assert.equal(change.after,'future value');
  const html=gameplayDetail(m,'en');assert.equal(html.includes('<script>test</script>'),false);assert.ok(html.includes('&lt;script&gt;test&lt;/script&gt;'));
  const c=new Collector(),message='OTX_MATCH_PARAM_TEXT '+JSON.stringify({schema:1,snapshot:1,event:'start',source:'effective',cvar:'huge',part:0,last:1,value:'x'.repeat(65536)});
  assert.throws(()=>{for(let i=0;i<40;i++)c.accept({kind:'print',level:2,text:message,time_ms:i});},e=>e.code==='MVD_METADATA_LIMIT');
});
