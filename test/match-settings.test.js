import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {settingsRecords,assembleSettings} from '../src/match-settings.js';
import {Collector,summarize} from '../src/parser.js';
import {modeDifficulty,modeLabel} from '../public/match-modes.js';
import {matchPoints,victoryPoints,botDifficulty} from '../public/rating.js';
import {humanPerformance} from '../public/performance-rating.js';

const rec=(tag,p,time=0,extra={})=>settingsRecords({kind:'print',segment:0,time_ms:time,level:2,text:`OTX_MATCH_${tag} ${JSON.stringify(p)}\n`,...extra});
const settings=(n=1,event='start',hardcore=0)=>({schema:1,snapshot:n,event,frame:n,map:'q2duel5',duration_seconds:600,hardcore,hardcore_server:0,training_server:0,training_override:-1});
const bot=(n=1,event='start',training=0)=>({schema:1,snapshot:n,event,frame:n,bot:1,slot:0,team:1,name:'David-X[200]',profile:'david',skill:200,skill_cap:200,style:'default',training});
const meta={sha256:'b'.repeat(64),originalName:'2026-10-28_10-00-00_q2duel5_David-X[200]-vs-q-default_1-0_001.mvd2',recordedAt:'2026-10-28T10:00:00+03:00'};
function scene({fight=true}={}){
  const c=new Collector(),event=(kind,body)=>c.accept({kind,segment:0,time_ms:0,...body});
  for(const [index,text]of [[1312,'David-X[200]\\male/grunt'],[1313,'q\\male/grunt'],[1568,'David-X[200]'],[1569,'q'],[1572,fight?'10:00':'8:00'],[1574,'Match']])event('configstring',{index,text});
  if(fight)event('print',{level:2,text:'Fight!\n'});
  const frame=(time_ms,scores)=>{const stats=Array(32).fill(0);stats[18]=1568;stats[19]=1569;stats[22]=1572;stats[23]=scores[0];stats[24]=scores[1];stats[26]=1574;event('player_state',{time_ms,slot:0,stats});};
  frame(0,[0,0]);
  const snapshot=(n,time,eventName,hc,tr,overrides={})=>{
    for(const [tag,p]of [['SETTINGS',{...settings(n,eventName,hc),...overrides.settings}],['BOT',{...bot(n,eventName,tr),...overrides.bot}]])event('print',{time_ms:time,level:2,text:`OTX_MATCH_${tag} ${JSON.stringify(p)}\n`});
  };
  const finish=()=>{frame(600000,[2,1]);event('print',{time_ms:600000,level:2,text:'David-X[200] wins, 2 to 1.\n'});return summarize(c,meta).matches[0];};
  return {c,event,frame,snapshot,finish};
}

test('metadata is anchored, level-checked, multi-line and raw JSON, not chat or munged bytes',()=>{
  assert.equal(rec('SETTINGS',settings(),0,{level:3}).length,0);
  assert.equal(rec('SETTINGS',settings(),0,{text:'q: OTX_MATCH_SETTINGS {}'}).length,0);
  const text=`OTX_MATCH_BOT ${JSON.stringify({...bot(),name:'\u00e1'})}\nOTX_MATCH_SETTINGS ${JSON.stringify(settings())}\n`;
  const rows=settingsRecords({kind:'print',level:2,text});assert.equal(rows.length,2);assert.equal(rows[0].payload.name,'\u00e1');
  assert.equal(rec('SETTINGS',settings(),0,{text:'OTX_MATCH_SETTINGS {"schema":1,"schema":1}'} )[0].error,'duplicate_json_key');
  assert.equal(rec('SETTINGS',{...settings(),hardcore:'1'})[0].error,'invalid_settings');
  assert.equal(rec('SETTINGS',{...settings(),schema:2})[0].error,'unsupported_schema');
});

test('assembly preserves unknown fields, detects partial and conflicting groups, does not guess params',async()=>{
  const keys=JSON.parse(await readFile(new URL('../src/mvd-settings-schema1.json',import.meta.url),'utf8'));
  const rows=[...rec('SETTINGS',{...settings(),future:'kept'}),...rec('BOT',bot()),...rec('PARAMS',{schema:1,snapshot:1,event:'start',part:0,values:Object.fromEntries(keys.map(k=>[k,'0']))})];
  let s=assembleSettings([...rows,...rows]).snapshots[0];assert.equal(s.complete,true);assert.equal(s.settings.future,'kept');assert.equal(Object.keys(s.params).length,108);
  s=assembleSettings(rows.slice(0,2)).snapshots[0];assert.equal(s.complete,false);assert.equal(s.missingParams.length,108);assert.equal(s.settings.hardcore,0);
  s=assembleSettings([...rows,...rec('SETTINGS',settings(1,'start',1))]).snapshots[0];assert.equal(s.settings,null);assert.equal(s.complete,false);assert.ok(s.errors.includes('conflicting_settings'));
});

test('effective BOT data wins over nick/server; snapshots switching back still count as changed',()=>{
  const {snapshot,finish}=scene();
  snapshot(1,100,'start',0,0,{bot:{skill:180.5,skill_server:200},settings:{duration_seconds:75}});
  snapshot(2,300000,'change',1,1,{bot:{skill:150}});
  snapshot(3,600000,'end',0,0,{bot:{skill:150}});
  const m=finish();assert.equal(m.modes.hardcore.changed,true);assert.equal(m.modes.training.changed,true);assert.equal(modeDifficulty(m).factor,1);
  assert.equal(m.durationSeconds,600);assert.equal(m.configuredDurationSeconds,75);
  assert.equal(m.participants[0].skill,150);assert.equal(botDifficulty(m).averageSkill,165.25);
  assert.equal(m.participants[0].ping,null);
});

test('late autorecord/start or end alone cannot invent initial modes, full duration or completion',()=>{
  const {snapshot,c,frame}=scene({fight:false});snapshot(1,100,'start',1,1);snapshot(2,600000,'end',0,0);frame(600000,[1,0]);
  const m=summarize(c,meta).matches[0];assert.equal(m.startObserved,false);assert.equal(m.durationSeconds,null);
  assert.equal(m.modes.hardcore.initial,null);assert.equal(modeDifficulty(m).factor,1);assert.notEqual(m.status,'completed');
});

test('spectator BOT records and reused disconnected slots do not override a duel participant',()=>{
  const {snapshot,event,finish}=scene();snapshot(1,100,'start',1,0,{bot:{team:0,training:1}});
  event('configstring',{time_ms:100000,index:1312,text:''});event('configstring',{time_ms:100100,index:1312,text:'SomeoneElse\\male/grunt'});
  snapshot(2,100200,'change',1,1,{bot:{name:'SomeoneElse',profile:'different',skill:50}});
  const m=finish();assert.equal(m.modes.training.initial,null);assert.equal(m.participants[0].skill,200);
});

test('metadata from different segments and match bounds never merges identical snapshot ids',()=>{
  const a=rec('SETTINGS',settings());const b=rec('SETTINGS',settings(1,'start',1),0,{segment:1});
  assert.equal(assembleSettings([...a,...b]).snapshots.length,2);
  const {snapshot,event,frame,c}=scene();snapshot(1,100,'start',1,0);frame(1000,[1,0]);event('print',{time_ms:1000,level:2,text:'David-X[200] wins, 1 to 0.\n'});
  event('print',{time_ms:2000,level:2,text:'Fight!\n'});frame(2000,[0,0]);snapshot(1,2100,'start',0,1);frame(3000,[0,1]);event('print',{time_ms:3000,level:2,text:'q wins, 1 to 0.\n'});
  const ms=summarize(c,meta).matches;assert.equal(ms.length,2);assert.equal(ms[0].modes.hardcore.initial,true);assert.equal(ms[1].modes.hardcore.initial,false);
});

const mode=(initial=false,changed=false)=>({initial,changed});
function match(winner=0,hc=mode(),tr=mode()){
  return {status:'completed',winnerIndex:winner,startObserved:true,durationSeconds:600,timelineDurationMs:600000,modes:{hardcore:hc,training:tr},participants:[{name:'q',isBot:false,score:winner===0?20:10},{name:'David-X[200]',profile:'David-X',isBot:true,skill:200,score:winner===1?20:10}]};
}
test('mode matrix: human rewards and bot penalties use K; human penalties and bot rewards use inverse K',()=>{
  for(const [hc,tr,k]of [[mode(),mode(),1],[mode(true),mode(),1.2],[mode(),mode(true),1/1.2],[mode(false,true),mode(),1.1],[mode(),mode(true,true),1/1.1],[mode(true),mode(true),1],[mode(true,true),mode(false,true),1],[mode(true),mode(false,true),1.2/1.1],[mode(null),mode(null),1]]){
    const humanWin=match(0,hc,tr),botWin=match(1,hc,tr);
    assert.ok(Math.abs(matchPoints(humanWin,0)-10*k)<1e-9);assert.ok(Math.abs(matchPoints(humanWin,1)+k)<1e-9);
    assert.ok(Math.abs(matchPoints(botWin,0)+1/k)<1e-9);assert.ok(Math.abs(matchPoints(botWin,1)-10/k)<1e-9);
    assert.equal(victoryPoints(humanWin,0),matchPoints(humanWin,0));
    botWin.status='forfeit';assert.equal(matchPoints(botWin,0),0);assert.ok(Math.abs(matchPoints(botWin,1)-5/k)<1e-9);
  }
});
test('both enabled throughout cancel exactly, old unknown records retain exact points and average rating',()=>{
  for(const winner of [0,1]){
    const old=match(winner);delete old.modes;
    const both=match(winner,mode(true),mode(true));assert.deepEqual([0,1].map(i=>matchPoints(old,i)),[0,1].map(i=>matchPoints(both,i)));
    assert.deepEqual(humanPerformance([old]),humanPerformance([both]));
    const hc=match(winner,mode(true)),tr=match(winner,mode(),mode(true));
    assert.ok(humanPerformance([hc]).value>humanPerformance([old]).value);
    assert.ok(humanPerformance([tr]).value<humanPerformance([old]).value);
  }
});

test('Variable is localized and includes observed changes when an early part of the match is missing',()=>{
  assert.equal(modeLabel({initial:false,changed:true},'en'),'Variable');
  assert.equal(modeLabel({initial:true,changed:true},'ru'),'Переменный');
  const {snapshot,frame,c}=scene({fight:false});snapshot(1,100,'start',0,0);snapshot(2,20000,'change',1,1);frame(60000,[1,0]);
  const m=summarize(c,meta).matches[0];assert.equal(modeLabel(m.modes.hardcore,'en'),'Variable');assert.equal(modeLabel(m.modes.training,'en'),'Variable');
  assert.equal(modeDifficulty(m).factor,1,'Without initial state the observed variation has no scoring adjustment');
});

test('native reference: all 8 snapshots, 108 params, effective training and skill, no invented version',{
  skip:!process.env.BOTSTATS_SETTINGS_REFERENCE
},async()=>{
  const child=spawn(fileURLToPath(new URL('../bin/mvd-decoder.exe',import.meta.url)),[process.env.BOTSTATS_SETTINGS_REFERENCE],{windowsHide:true});
  const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});
  const records=[],collector=new Collector();for await(const line of createInterface({input:child.stdout})){const e=JSON.parse(line);collector.accept(e);records.push(...settingsRecords(e));}
  assert.equal(await done,0);const data=assembleSettings(records);assert.equal(data.unparsed.length,0);assert.equal(data.snapshots.length,8);
  assert.ok(data.snapshots.every(s=>s.complete&&Object.keys(s.params).length===108));
  assert.deepEqual(data.snapshots.map(s=>s.settings.hardcore),[0,0,0,0,1,1,1,1]);
  assert.deepEqual(data.snapshots.map(s=>s.bots.find(b=>b.slot===0).training),[0,1,1,1,1,1,0,0]);
  assert.deepEqual(data.snapshots.map(s=>s.bots.find(b=>b.slot===0).skill),[250,250,225,225,225,225,225,225]);
  assert.ok(data.snapshots.every(s=>s.settings.mod_version===undefined));
  assert.equal(collector.part(0).version,'12');
  assert.equal(summarize(collector,meta).matches.length,0,'Two BOT rows in the control recording must not become a real human rating');
});
