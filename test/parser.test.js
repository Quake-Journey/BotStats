import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertClosedMvd, Collector, summarize, parseTable, parseLegacyStats, settingChange, recordingDateFromName } from '../src/parser.js';
import { gzipSync } from 'node:zlib';
import {botDifficulty} from '../public/rating.js';

test('only a complete MVD, including gzip, is ready for ingestion',()=>{
  const b=Buffer.from('4d56443203000102030000','hex');assertClosedMvd(b);assertClosedMvd(gzipSync(b));
  assert.throws(()=>assertClosedMvd(b.subarray(0,-1)));assert.throws(()=>assertClosedMvd(Buffer.concat([b,Buffer.from([1])])));
});
function scene(){
  const c=new Collector(),event=(kind,body)=>c.accept({kind,segment:0,time_ms:0,...body});
  for(const [index,text]of [[1312,'David-X[200]\\male/grunt'],[1313,'q\\male/grunt'],[1568,'David-X[200]'],[1569,'q'],[1572,'5:00'],[1574,'Match']])event('configstring',{index,text});
  event('segment_facts',{map:'q2duel5',end_ms:300000});event('print',{level:2,text:'Fight!\n'});
  const frame=(time_ms,name,score=[0,0])=>{event('configstring',{time_ms,index:1312,text:name+'\\male/grunt'});event('configstring',{time_ms,index:1568,text:name});const stats=Array(32).fill(0);stats[1]=100;stats[14]=score[0];stats[18]=1568;stats[19]=1569;stats[22]=1572;stats[23]=score[0];stats[24]=score[1];stats[26]=1574;event('player_state',{time_ms,slot:0,stats});};
  frame(0,'David-X[200]');return {c,event,frame};
}
const meta={sha256:'a'.repeat(64),originalName:'2026-10-22_10-00-00_q2duel5_David-X[200]-vs-q-default.mvd2',recordedAt:'2026-10-22T10:00:00+03:00'};
test('current and legacy recording names supply calendar dates for filters',()=>{
  assert.equal(recordingDateFromName(meta.originalName),'2026-10-22T10:00:00+03:00');
  assert.equal(recordingDateFromName('2026-10-03-23.23-q2duel5.mvd2'),'2026-10-03T23:23:00+03:00');
  assert.equal(recordingDateFromName('2026-10-03-10.19-q2duel5.mvd2','+00:00'),'2026-10-03T10:19:00+00:00');
  assert.equal(recordingDateFromName('2026-10-03-23.23.42-q2duel5.mvd2'),'2026-10-03T23:23:42+03:00');
  for(const name of ['demo.mvd2','2026-02-30-10.19-q2duel5.mvd2','2026-10-03-25.19-q2duel5.mvd2'])assert.equal(recordingDateFromName(name),null);
});
test('old winner announcement supplies final frag absent from HUD, in either player order',()=>{
  for(const [winner,expected] of [['David-X[200]',[3,2]],['q',[2,3]]]){
    const {c,event,frame}=scene();frame(300000,'David-X[200]',[2,2]);
    event('print',{time_ms:300100,level:2,text:`${winner} wins, 3 to 2.\n`});
    const m=summarize(c,meta).matches[0];
    assert.deepEqual(m.participants.map(p=>p.score),expected);assert.equal(m.scoreSource,'server_result');
    assert.deepEqual(m.scoreHistory.at(-1).scores,expected);
  }
});
test('chat cannot forge final score and final detailed table retains precedence',async()=>{
  const {c,event,frame}=scene();frame(300000,'David-X[200]',[2,2]);
  event('print',{time_ms:300100,level:3,text:'q: David-X[200] wins, 99 to 0.\n'});
  assert.deepEqual(summarize(c,meta).matches[0].participants.map(p=>p.score),[2,2]);
  event('print',{time_ms:300100,level:2,text:'David-X[200] wins, 99 to 0.\n'});
  event('print',{time_ms:300200,level:2,text:await readFile(new URL('./fixtures/stats.txt',import.meta.url),'utf8')});
  const m=summarize(c,meta).matches[0];assert.deepEqual(m.participants.map(p=>p.score),[13,4]);assert.equal(m.scoreSource,'server_stats');
  assert.deepEqual(m.scoreHistory.at(-1),{timeMs:m.timelineDurationMs,scores:[13,4]});
});

test('sudden death final table supplies the winning frag missing from the last HUD',()=>{
  const {c,event,frame}=scene();
  frame(21600,'David-X[200]',[0,1]);frame(43700,'David-X[200]',[1,1]);
  event('print',{time_ms:120000,level:2,text:'Scores are tied. Sudden Death!\n'});
  event('print',{time_ms:171100,level:2,text:'David-X[200] wins, 2 to 1.\n'});
  // The printed table orders participants differently from the HUD.
  event('print',{time_ms:171100,level:2,text:'MATCH STATS\nMap q2duel5: q 1 - 2 David-X[200]\n==========\n'});
  const m=summarize(c,meta).matches[0];
  assert.equal(m.scoreSource,'server_stats');assert.equal(m.status,'completed');
  assert.deepEqual(m.scoreHistory,[{timeMs:0,scores:[0,0]},{timeMs:21600,scores:[1,0]},{timeMs:43700,scores:[1,1]},{timeMs:171100,scores:[1,2]}]);
});
test('skill comes from name changes, has complete intervals, and ignores repeated names',()=>{
  const {c,event,frame}=scene();frame(135000,'David-X[150]',[3,1]);frame(200000,'David-X[150]',[4,1]);frame(300000,'David-X[200]',[5,1]);event('print',{time_ms:300000,level:2,text:'David-X[200] wins, 5 to 1.\n'});
  const p=summarize(c,meta).matches[0].participants[0];assert.equal(p.skillVariable,true);assert.deepEqual(p.skillTimeline,[{fromMs:0,toMs:135000,value:200},{fromMs:135000,toMs:300000,value:150}]);
});
test('restart forfeits the human and keeps the pre-reset score',()=>{
  const {c,event,frame}=scene();frame(30000,'David-X[200]',[4,0]);event('print',{time_ms:45000,level:3,text:'Restarting the match...\n'});event('configstring',{time_ms:45000,index:1574,text:'Countdown'});frame(45001,'David-X[200]',[0,0]);
  const m=summarize(c,meta).matches[0];assert.deepEqual(m.participants.map(p=>p.score),[4,0]);assert.equal(m.status,'forfeit');assert.equal(m.winnerIndex,0);assert.equal(m.forfeitBy,'q');assert.equal(m.endReason,'restart');
});
test('forfeit counts as losing even when the departing player led on score',()=>{
  const {c,event,frame}=scene();frame(290000,'David-X[200]',[3,10]);event('print',{time_ms:300000,level:2,text:'David-X[200] wins by forfeit!\n'});
  const m=summarize(c,meta).matches[0];assert.equal(m.status,'forfeit');assert.equal(m.winnerIndex,0);assert.equal(m.forfeitBy,'q');assert.deepEqual(m.participants.map(p=>p.score),[3,10]);
});
test('instructions mentioning forfeit and player chat never become a result',()=>{
  const {c,event,frame}=scene();frame(290000,'David-X[200]',[3,10]);event('print',{time_ms:295000,level:2,text:"You can force a forfeit by typing 'win'.\n"});event('print',{time_ms:300000,level:3,text:'q: David-X[200] wins by forfeit!\n'});
  const m=summarize(c,meta).matches[0];assert.equal(m.status,'interrupted');assert.equal(m.winnerIndex,null);
});
test('ping is deduplicated by timestamp, does not assume continuous observation',()=>{
  const {c,event,frame}=scene();frame(10000,'David-X[200]',[1,0]);for(const t of [1000,2000,2000])event('layout',{time_ms:t,text:`string "q:${t===1000?20:10}(female/athena)"`});
  const p=summarize(c,meta).matches[0].participants[1];assert.equal(p.ping.samples,2);assert.equal(p.ping.observedSeconds,6);assert.equal(p.ping.averageMs,11.7);
});
test('live style and skill messages match native server format',()=>{
  assert.equal(settingChange('OpenTDM-X: David-X[150] now plays at skill 150 (configured 200) while q stays in this duel.\n',1000).value,150);
  assert.equal(settingChange('OpenTDM-X: David-X[200] uses style defence while q stays in this duel.\n',1000).value,'defence');
});

test('skill changes announced during pauses use active intervals for rating',()=>{
  const {c,event,frame}=scene();
  event('print',{time_ms:100000,level:2,text:'Game paused\n'});
  event('print',{time_ms:110000,level:2,text:'OpenTDM-X: David-X[50] now plays at skill 50 (configured 200) while q stays in this duel.\n'});
  event('print',{time_ms:130000,level:2,text:'Fight!\n'});
  frame(329900,'David-X[50]',[6,2]);event('print',{time_ms:330000,level:2,text:'Timelimit hit. Match ended.\n'});
  const m=summarize(c,meta).matches[0];assert.equal(m.timelineDurationMs,300000);
  assert.deepEqual(m.participants[0].skillTimeline,[{fromMs:0,toMs:100000,value:200},{fromMs:100000,toMs:300000,value:50}]);
  assert.equal(botDifficulty(m).averageSkill,100);assert.equal(botDifficulty(m).factor,.5);
});
test('real final table preserves actual score, detailed weapon and item counters',async()=>{
  const text=await readFile(new URL('./fixtures/stats.txt',import.meta.url),'utf8'),r=parseTable(text);
  assert.equal(r.complete,true);assert.deepEqual(r.participants.map(p=>p.score),[13,4]);
  const bot=r.participants[0];assert.equal(bot.stats.damageDealt,3105);assert.equal(bot.stats.weapons.find(w=>w.name==='Railgun').hits,13);assert.equal(bot.stats.pickups.find(x=>x.name==='Rocket Launcher').count,7);assert.equal(bot.stats.weapons.find(w=>w.name==='R.Launch').pickups,5);
});
test('overtime preserves extra-time score and duration, not the last regulation frame',()=>{
  const {c,event,frame}=scene();frame(299000,'David-X[200]',[4,4]);
  event('print',{time_ms:300000,level:2,text:'Scores are tied 4 - 4, adding 1 minute overtime.\n'});
  event('configstring',{time_ms:300000,index:1574,text:'Overtime'});
  frame(359900,'David-X[200]',[5,4]);event('print',{time_ms:360000,level:2,text:'Timelimit hit. Match ended.\n'});
  const m=summarize(c,meta).matches[0];assert.equal(m.overtime,true);assert.equal(m.overtimeKind,'overtime');assert.deepEqual(m.participants.map(p=>p.score),[5,4]);assert.equal(m.durationSeconds,360);assert.equal(m.overtimePeriods[0].fromMs,300000);
});
test('sudden death is extra time; settings text alone is not',()=>{
  const {c,event,frame}=scene();frame(310000,'David-X[200]',[5,4]);event('print',{time_ms:300000,level:2,text:'Scores are tied 4 - 4, entering Sudden Death!\n'});event('print',{time_ms:310000,level:2,text:'David-X[200] wins, 5 to 4.\n'});
  assert.equal(summarize(c,meta).matches[0].overtimeKind,'sudden_death');
  const other=scene();other.frame(100000,'David-X[200]',[1,0]);other.event('print',{time_ms:1000,level:2,text:'Overtime is set to 1 minute.\nNew tie mode: sudden death\n'});assert.equal(summarize(other.c,meta).matches[0].overtime,false);
});
test('administrative opponent replacement is flagged, skill change is not replacement',()=>{
  const {c,frame}=scene();frame(30000,'David-X[150]',[1,0]);frame(50000,'Purri-X[200]',[2,0]);const m=summarize(c,meta).matches[0];assert.equal(m.ratingExcluded,'opponent_changed');assert.deepEqual(m.botProfiles,['David-X','Purri-X']);
});
test('server automatic recording starts after Fight; filename and initial HUD identify the full game',()=>{
  const {c,event,frame}=scene();c.part().prints=[];
  frame(300000,'David-X[200]',[3,1]);event('print',{time_ms:300000,level:2,text:'Timelimit hit. Match ended.\n'});
  const m=summarize(c,{...meta,originalName:'2026-10-22_10-00-00_q2duel5_David-X[200]-vs-q-default_3-1_001.mvd2'}).matches[0];
  assert.equal(m.startObserved,true);assert.equal(m.startSource,'server_autorecord');assert.equal(m.durationSeconds,300);assert.ok(!m.warnings.includes('partial_start'));
});
test('a timestamp alone does not turn a mid-match recording into a full game',()=>{
  const {c,event,frame}=scene();c.part().prints=[];c.part().frames=[];
  frame(5000,'David-X[200]',[2,1]);event('print',{time_ms:300000,level:2,text:'Timelimit hit. Match ended.\n'});
  const m=summarize(c,meta).matches[0];assert.equal(m.startObserved,false);assert.equal(m.durationSeconds,null);
});

test('warmup before Fight is excluded from duration and weighted skill; post-match settings are excluded',()=>{
  const {c,event,frame}=scene();c.part().prints=[];c.part().frames=[];c.part().previous.clear();
  event('configstring',{time_ms:0,index:1574,text:'Warmup'});frame(0,'David-X[200]');
  event('print',{time_ms:5000,level:2,text:'OpenTDM-X: David-X[200] style: arcade.\n'});
  event('print',{time_ms:14900,level:2,text:'Fight!\n'});
  event('configstring',{time_ms:14900,index:1574,text:'Match'});
  event('configstring',{time_ms:14900,index:1572,text:'10:00'});frame(14900,'David-X[200]');
  frame(614800,'David-X[200]',[12,2]);event('print',{time_ms:614900,level:2,text:'Timelimit hit. Match ended.\n'});
  event('print',{time_ms:614900,level:2,text:'David-X[200] wins, 13 to 2.\n'});
  event('print',{time_ms:624900,level:2,text:'OpenTDM-X: David-X[200] style: default.\n'});
  event('print',{time_ms:624900,level:2,text:'OpenTDM-X: David-X[50] now plays at skill 50 (configured 200) while q stays in this duel.\n'});
  const m=summarize(c,meta).matches[0];assert.equal(m.startMs,14900);assert.equal(m.durationSeconds,600);assert.equal(m.timelineDurationMs,600000);assert.equal(m.startObserved,true);
  assert.equal(botDifficulty(m).factor,1);assert.equal(m.settingsChanges.length,0);
  const bot=m.participants[0];assert.equal(bot.style,'arcade');assert.equal(bot.styleVariable,false);
  assert.deepEqual(bot.styleTimeline,[{fromMs:0,toMs:600000,value:'arcade'}]);
  assert.deepEqual(bot.skillTimeline,[{fromMs:0,toMs:600000,value:200}]);
});

test('Fight resuming a recording that began mid-match does not fabricate a full start',()=>{
  const {c,event,frame}=scene();c.part().prints=[];frame(10000,'David-X[200]',[2,1]);
  event('print',{time_ms:20000,level:2,text:'Game paused\n'});
  event('print',{time_ms:30000,level:2,text:'Fight!\n'});
  frame(90000,'David-X[200]',[4,1]);event('print',{time_ms:90000,level:2,text:'David-X[200] wins, 4 to 1.\n'});
  const m=summarize(c,meta).matches[0];assert.equal(m.startObserved,false);assert.equal(m.startMs,0);
  assert.equal(botDifficulty(m).known,false);
});

test('legacy split item and total tables preserve available counters without inventing hits or shots',async()=>{
  const text=await readFile(new URL('./fixtures/legacy-stats.txt',import.meta.url),'utf8');
  const stats=parseLegacyStats(text);assert.equal(stats.size,2);
  const bot=stats.get('Syanid-X[200]'),human=stats.get('pp');
  assert.equal(bot.damageDealt,3482);assert.equal(bot.damageReceived,3020);
  assert.equal(human.kills,13);assert.equal(human.deaths,2);
  const rail=bot.weapons.find(w=>w.name==='Railgun');assert.equal(rail.accuracyPercent,54);assert.equal(rail.hits,null);assert.equal(rail.shots,null);
  assert.equal(bot.control.find(x=>x.name==='Body Armor').pickups,4);
  assert.equal(human.pickups.find(x=>x.name==='Ammo Pack').count,1);
  assert.equal(human.pickups.find(x=>x.name==='Mega Health').count,8);
});

test('legacy totals are used only at the match finish, not from a mid-match stats request',async()=>{
  const text=(await readFile(new URL('./fixtures/legacy-stats.txt',import.meta.url),'utf8')).replaceAll('Syanid-X[200]','David-X[200]').replaceAll('pp','q');
  for(const atFinish of [true,false]){
    const {c,event,frame}=scene();frame(299000,'David-X[200]',[2,12]);
    for(const fragment of text.split(/(?=Stats for |\nTotal)/))event('print',{time_ms:atFinish?300000:100000,level:2,text:fragment.replace(/Timelimit hit[\s\S]*/,'')});
    event('print',{time_ms:300000,level:2,text:'Timelimit hit. Match ended.\n'});
    event('print',{time_ms:300000,level:2,text:'q wins, 13 to 2.\n'});
    const m=summarize(c,meta).matches[0];assert.equal(m.statsComplete,atFinish);assert.equal(m.statsFormat,atFinish?'legacy':null);
    assert.deepEqual(m.participants.map(p=>p.score),[2,13]);
  }
});

test('disconnect placeholder does not replace the human identity in the forfeit result',()=>{
  const {c,event,frame}=scene();frame(290000,'David-X[200]',[3,10]);
  event('configstring',{time_ms:295000,index:1569,text:'Player 2'});frame(295000,'David-X[200]',[3,10]);
  event('print',{time_ms:300000,level:2,text:'David-X[200] wins by forfeit!\n'});
  const m=summarize(c,meta).matches[0];assert.equal(m.participants[1].name,'q');assert.equal(m.forfeitBy,'q');assert.deepEqual(m.participants.map(p=>p.score),[3,10]);
});


test('restart/abort/map votes forfeit a leading human despite a normal score announcement',()=>{
 for(const [text,reason]of [['Restarting the match...\n','restart'],['Match aborted.\n','abort'],['Match interrupted by vote: map change to q3t2.\n','map_change'],['Match interrupted by map vote. Match ended.\n','map_change'],['New map: q3t2\n','map_change']]){
  const {c,event,frame}=scene();frame(299900,'David-X[200]',[3,10]);
  event('print',{time_ms:300000,level:text.startsWith('Match interrupted')?2:3,text});
  if(reason!=='restart')event('print',{time_ms:300000,level:2,text:'q wins, 10 to 3.\n'});
  const m=summarize(c,meta).matches[0];
  assert.equal(m.status,'forfeit',reason);assert.equal(m.winnerIndex,0);assert.equal(m.forfeitBy,'q');assert.equal(m.endReason,reason);
  assert.deepEqual(m.participants.map(p=>p.score),[3,10]);assert.ok(m.events.some(e=>e.text===text.trim()));
 }
});
test('restart after a completed result never revokes a normal win; following match is independent',()=>{
 const {c,event,frame}=scene();frame(300000,'David-X[200]',[3,10]);event('print',{time_ms:300000,level:2,text:'q wins, 10 to 3.\n'});
 event('print',{time_ms:320000,level:3,text:'Restarting the match...\n'});event('configstring',{time_ms:320000,index:1574,text:'Countdown'});frame(320000,'David-X[200]',[0,0]);
 event('print',{time_ms:332000,level:2,text:'Fight!\n'});event('configstring',{time_ms:332000,index:1574,text:'Match'});frame(332000,'David-X[200]',[0,0]);frame(340000,'David-X[200]',[1,0]);
 const ms=summarize(c,meta).matches;assert.equal(ms.length,2);assert.equal(ms[0].status,'completed');assert.equal(ms[0].winnerIndex,1);assert.equal(ms[1].status,'interrupted');
});
test('warmup aborts, failed votes and chat do not create technical losses',()=>{
 const {c,event,frame}=scene();frame(100000,'David-X[200]',[3,10]);
 for(const text of ['q: Match aborted.\n','q: Restarting the match...\n','q: New map: q3t2\n','q started a vote: restart the match\n','Vote failed!\n','Countdown aborted!\n'])event('print',{time_ms:110000,level:3,text});
 assert.equal(summarize(c,meta).matches[0].status,'interrupted');
 const warm=new Collector();warm.accept({kind:'print',level:3,time_ms:100,text:'Match aborted.\n'});assert.equal(summarize(warm,meta).matches.length,0);
});
test('human departure is a forfeit, a reconnect pause or spectator departure is not',()=>{
 for(const action of ['q disconnected\n',"q left team 'q'\n"]){
  const {c,event,frame}=scene();frame(299900,'David-X[200]',[3,10]);event('print',{time_ms:300000,level:2,text:action});
  const m=summarize(c,meta).matches[0];assert.equal(m.status,'forfeit');assert.equal(m.forfeitBy,'q');assert.equal(m.winnerIndex,0);
 }
 for(const resume of [false,true]){
  const {c,event,frame}=scene();frame(100000,'David-X[200]',[3,10]);event('print',{time_ms:101000,level:2,text:'q disconnected\n'});
  if(resume){event('print',{time_ms:120000,level:2,text:'Fight!\n'});frame(121000,'David-X[200]',[4,10]);}
  else event('print',{time_ms:101000,level:3,text:'q disconnected and has 30 seconds to reconnect.\n'});
  // Reconnect pause text at PRINT_CHAT is present in raw collector prints.
  const m=summarize(c,meta).matches[0];assert.equal(m.status,'interrupted');
 }
 const {c,event,frame}=scene();frame(290000,'David-X[200]',[3,10]);event('print',{time_ms:300000,level:2,text:'spectator disconnected\n'});assert.equal(summarize(c,meta).matches[0].status,'interrupted');
});
