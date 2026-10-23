import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateMatches,filters,periodBounds} from '../src/store.js';
import {matchPoints,victoryPoints,victoryDuration,botDifficulty,rankParticipants,rankMaps,ratingDetails} from '../public/rating.js';
function game(map,status,winnerIndex,score=[5,3]){return {map,status,winnerIndex,statsComplete:true,durationSeconds:600,participants:[{name:'q',isBot:false,score:score[0],stats:{kills:score[0],deaths:score[1],damageDealt:500}},{name:'David-X[200]',profile:'David-X',isBot:true,score:score[1],stats:{kills:score[1],deaths:score[0],damageDealt:400}}]};}
test('independent human/bot policies; leading forfeiter score and per-map averages',()=>{
  const s=aggregateMatches([game('q2duel5','completed',0),game('q2duel5','completed',1,[2,6]),game('ztn2dm3','forfeit',1,[10,3]),game('ztn2dm3','interrupted',null,[4,1])]);
  const p=s.players.find(p=>p.name==='q');assert.equal(p.points,4);assert.equal(p.losses,2);assert.equal(p.normalLosses,1);assert.equal(p.forfeits,1);assert.equal(p.matches,4);assert.equal(p.finished,3);assert.equal(p.pointsPerMatch,4/3);assert.equal(p.averageScore,21/4);assert.equal(p.averageFragDifference,2);assert.equal(p.averageDeaths,13/4);
  assert.equal(s.byMap.find(m=>m.map==='q2duel5').players.find(p=>p.name==='q').points,9);
  assert.equal(s.byMap.find(m=>m.map==='ztn2dm3').players.find(p=>p.name==='q').points,-5);
  const b=s.players.find(p=>p.isBot);assert.equal(b.points,1);assert.equal(b.forfeitWins,1);assert.equal(b.normalWins,1);
});
test('forfeit bot points use the actual score, including a tie, never the technical winner',()=>{
  for(const [score,points]of [[[2,8],1],[[8,2],0],[[4,4],0]]){
    const m=game('q3t2','forfeit',1,score);assert.equal(matchPoints(m,1),points);assert.equal(matchPoints(m,0),-5);
  }
  assert.equal(matchPoints(game('q3t2','forfeit',0),0),0);
  assert.equal(matchPoints({...game('q3t2','completed',1),ratingExcluded:'opponent_changed'},1),null);
});
test('overtime wins/losses are separate from forfeits and award ordinary points',()=>{
  const rows=[{...game('q3t2','completed',0,[9,8]),overtime:true},{...game('q3t2','forfeit',1,[9,10]),overtime:true}];
  const s=aggregateMatches(rows),p=s.players.find(p=>!p.isBot),b=s.players.find(p=>p.isBot);
  assert.equal(s.overtimeMatches,2);assert.equal(p.overtimeWins,1);assert.equal(b.overtimeLosses,1);assert.equal(b.overtimeWins,0);assert.equal(p.overtimeForfeits,1);assert.equal(p.points,5);assert.equal(b.points,0);
});
test('rating periods use inclusive MSK dates and carry across month/year boundaries',()=>{
  const now=new Date('2026-12-31T21:30:00Z');
  assert.deepEqual(periodBounds('today',now),{from:'2027-01-01',to:'2027-01-01'});
  assert.deepEqual(periodBounds('three',now),{from:'2026-12-30',to:'2027-01-01'});
  assert.equal(periodBounds('week',now).from,'2026-12-26');
  assert.equal(periodBounds('month',now).from,'2026-12-03');
  assert.equal(periodBounds('year',now).from,'2026-01-02');assert.equal(periodBounds('all',now),null);
  assert.equal(filters({period:'today'},now).startedAt.$gte,'2026-12-31T21:00:00.000Z');
});
test('filters escape search syntax and use MSK calendar dates and skill history',()=>{
  const f=filters({q:'q[200]',from:'2026-10-22',skill:'150',identity:'q',kind:'human'});
  assert.equal(f['participants.name'].$regex,'q\\[200\\]');assert.equal(f.startedAt.$gte,'2026-10-21T21:00:00.000Z');assert.ok(f.$and);
});

function skilled(profile,skill,winner=0){const m=game('q2duel5','completed',winner);m.durationSeconds=600;m.timelineDurationMs=600000;m.startObserved=true;Object.assign(m.participants[1],{name:`${profile}[${skill}]`,profile,skill,skillTimeline:[{fromMs:0,toMs:600000,value:skill}]});return m;}

test('human victory uses exact duration boundaries and linear interpolation before skill',()=>{
  for(const [seconds,expected]of [[60,0],[119.999,0],[120,1],[120.001,1.00001875],[240,3.25],[360,5.5],[480,7.75],[600,10],[900,10]]){
    const m=skilled('David-X',200);m.durationSeconds=seconds;m.timelineDurationMs=seconds*1000;m.participants[1].skillTimeline[0].toMs=seconds*1000;
    assert.ok(Math.abs(matchPoints(m,0)-expected)<1e-10,`${seconds} seconds`);
    assert.equal(victoryPoints(m,0),matchPoints(m,0));assert.equal(matchPoints(m,1),-1);
    assert.equal(ratingDetails(m).duration.basePoints,victoryDuration(m).basePoints);
  }
  const m=skilled('David-X',200);m.durationSeconds=360;m.timelineDurationMs=360000;m.participants[1].skillTimeline=[{fromMs:0,toMs:180000,value:50},{fromMs:180000,toMs:360000,value:200}];
  assert.equal(matchPoints(m,0),5.5*.625);
  const s=aggregateMatches([m,m]).players.find(p=>!p.isBot);assert.equal(s.points,6.875);assert.equal(s.victoryPoints,6.875,'No per-match rounding');
});

test('duration uses game clock including overtime, never recording pauses or missing start',()=>{
  const m=skilled('David-X',200);m.durationSeconds=120;m.timelineDurationMs=119900;m.participants[1].skillTimeline[0].toMs=119900;m.recordedSeconds=900;
  assert.equal(matchPoints(m,0),1,'Confirmed timelimit beats one-frame timeline difference');
  m.durationSeconds=360;m.timelineDurationMs=360000;m.participants[1].skillTimeline[0].toMs=360000;m.overtime=true;
  assert.equal(matchPoints(m,0),5.5,'Overtime included, pause time excluded');
  m.startObserved=false;assert.equal(victoryDuration(m).known,false);assert.equal(matchPoints(m,0),null);
  delete m.startObserved;m.durationSeconds=null;assert.equal(matchPoints(m,0),null,'Fragment timeline alone is insufficient');
  m.startObserved=true;assert.equal(matchPoints(m,0),5.5,'Confirmed full active timeline is valid fallback');
  for(const duration of [null,NaN,-1,0]){m.durationSeconds=duration;m.timelineDurationMs=null;assert.equal(matchPoints(m,0),null);}
});

test('short wins earn zero even with missing skill; duration never changes loss or bot policies',()=>{
  const short=skilled('David-X',200);short.durationSeconds=60;short.participants[1].skillTimeline[0].fromMs=1000;
  assert.equal(botDifficulty(short).known,false);assert.equal(matchPoints(short,0),0);
  assert.equal(aggregateMatches([short]).players.find(p=>!p.isBot).unscoredWins,0);
  const m=skilled('David-X',100,1);m.durationSeconds=60;
  assert.equal(matchPoints(m,0),-2);assert.equal(matchPoints(m,1),2);
  m.durationSeconds=null;assert.equal(matchPoints(m,0),-2);
  m.status='forfeit';m.participants[1].score=10;assert.equal(matchPoints(m,0),-5);assert.equal(matchPoints(m,1),1);
  m.participants[0].score=20;assert.equal(matchPoints(m,1),0);
});
test('skill weights use standard 200, Human 100 and GOD 250 above the reference',()=>{
  for(const [profile,skill,k,win,loss,botWin,botLoss]of [
    ['Noob-X',50,.25,2.5,-4,2,-1],['David-X',100,.5,5,-2,2,-1],
    ['David-X',200,1,10,-1,2,-1],['Human-X',100,1,10,-1,2,-1],['GOD-X',250,1.25,12.5,-.8,2,-1]]){
    const m=skilled(profile,skill);assert.equal(botDifficulty(m).factor,k);assert.equal(matchPoints(m,0),win);assert.equal(matchPoints(m,1),botLoss);
    m.winnerIndex=1;assert.equal(matchPoints(m,0),loss);assert.equal(matchPoints(m,1),botWin);
  }
});
test('skill is weighted by active duration before applying inverse loss, not by change count or final skill',()=>{
  const m=skilled('David-X',200),b=m.participants[1];b.skillVariable=true;b.skillTimeline=[{fromMs:0,toMs:300000,value:50},{fromMs:300000,toMs:600000,value:200}];
  assert.equal(botDifficulty(m).averageSkill,125);assert.equal(botDifficulty(m).factor,.625);assert.equal(matchPoints(m,0),6.25);assert.equal(matchPoints(m,1),-1);
  m.winnerIndex=1;assert.equal(matchPoints(m,0),-1.6);assert.equal(matchPoints(m,1),2);
  b.skillTimeline=[{fromMs:0,toMs:540000,value:200},{fromMs:540000,toMs:600000,value:50}];assert.equal(botDifficulty(m).averageSkill,185);
  b.skillTimeline=[{fromMs:0,toMs:599000,value:50},{fromMs:599000,toMs:600000,value:200}];assert.equal(botDifficulty(m).averageSkill,50.25);
  m.recordedSeconds=1000;assert.equal(botDifficulty(m).durationMs,600000,'Wall-clock pauses do not dilute active time');
});
test('forfeit stays more costly than any ordinary human loss, while missing skill is not guessed',()=>{
  for(const skill of [1,20,50,100,200]){
    const m=skilled('David-X',skill,1);const normal=matchPoints(m,0);assert.ok(normal>=-4);m.status='forfeit';assert.equal(matchPoints(m,0),-5);assert.equal(matchPoints(m,1),0);m.participants[1].score=20;assert.equal(matchPoints(m,1),1);
  }
  const missing=skilled('David-X',200);missing.participants[1].skillTimeline[0].fromMs=1000;
  assert.equal(botDifficulty(missing).known,false);assert.equal(matchPoints(missing,0),null);
  const s=aggregateMatches([missing,skilled('David-X',200)]),p=s.players.find(x=>!x.isBot);
  assert.equal(p.wins,2);assert.equal(p.finished,2);assert.equal(p.ratedMatches,1);assert.equal(p.unratedMatches,1);assert.equal(p.pointsPerMatch,10);
  missing.participants[1].skillTimeline=[{fromMs:0,toMs:600000,value:250}];assert.equal(botDifficulty(missing).known,false,'250 is only valid for GOD');
  missing.participants[1].skillTimeline=[{fromMs:0,toMs:400000,value:50},{fromMs:300000,toMs:600000,value:200}];assert.equal(botDifficulty(missing).known,false,'Overlaps are not double counted');
});
test('aggregates retain fractional awards rather than rounding each match',()=>{
  const m=skilled('David-X',125),s=aggregateMatches([m,m]),human=s.players.find(x=>!x.isBot),bot=s.players.find(x=>x.isBot);
  assert.equal(human.points,12.5);assert.equal(bot.points,-2);assert.equal(bot.pointsPerMatch,-1);
});

test('Victory rating preserves skill awards but never subtracts losses or counts forfeits',()=>{
  const variable=skilled('David-X',200);
  variable.participants[1].skillTimeline=[{fromMs:0,toMs:300000,value:50},{fromMs:300000,toMs:600000,value:200}];
  assert.equal(victoryPoints(variable,0),6.25);
  for(const [profile,skill,points]of [['Human-X',100,10],['GOD-X',250,12.5],['David-X',50,2.5]])assert.equal(victoryPoints(skilled(profile,skill),0),points);
  const matches=[skilled('David-X',200),variable,skilled('David-X',50,1),game('q2duel5','forfeit',1),game('q2duel5','forfeit',0),game('q2duel5','completed',null),game('q2duel5','interrupted',null)];
  const q=aggregateMatches(matches).players.find(p=>!p.isBot);
  assert.equal(q.victoryPoints,16.25);assert.equal(q.points,7.25);
  assert.equal(q.completedMatches,4);assert.equal(q.normalWins,2);
  assert.equal(victoryPoints(matches[2],0),0);assert.equal(victoryPoints(matches[3],0),0);assert.equal(victoryPoints(matches[4],0),0);
  assert.equal(victoryPoints(matches[6],0),null);
  assert.deepEqual(ratingDetails(variable).victoryPoints,[6.25,0]);
});

test('active winner ranks above one-off winner despite losses, which only affect Average rating',()=>{
  const active=skilled('David-X',200),one=skilled('David-X',200);active.participants[0].name='Active';one.participants[0].name='Once';
  const loss=structuredClone(active);loss.winnerIndex=1;
  const forfeits={...loss,status:'forfeit'};
  const rows=aggregateMatches([active,active,one,...Array(12).fill(loss),...Array(3).fill(forfeits)]).players.filter(p=>!p.isBot);
  assert.deepEqual(rankParticipants(rows).map(p=>[p.name,p.victoryPoints]),[['Active',20],['Once',10]]);
  assert.deepEqual(rankParticipants(rows,'average').map(p=>[p.name,p.points]),[['Once',10],['Active',-7]]);
  assert.deepEqual(rankParticipants(rows,'activity').map(p=>[p.name,p.completedMatches]),[['Active',14],['Once',1]]);
  const a={...rows[0],name:'Zulu',victoryPoints:10,normalWins:1},b={...a,name:'Alpha',matches:1,completedMatches:1,losses:0,forfeits:0};
  assert.equal(rankParticipants([a,b])[0].name,'Alpha','Losses/forfeits must not break victory ties');
});

test('completed-match and map popularity counts exclude every forfeit and unfinished recording',()=>{
  const rows=[game('q2duel5','completed',0),{...game('q2duel5','completed',null),overtime:true},game('q3t2','completed',1),
    ...Array(5).fill(game('q3t2','forfeit',1)),game('ztn2dm3','forfeit',0),game('ztn2dm3','interrupted',null)];
  const s=aggregateMatches(rows);
  assert.equal(s.completedMatches,3);assert.equal(s.players.find(p=>!p.isBot).completedMatches,3);
  assert.deepEqual(rankMaps(s.byMap).map(m=>[m.map,m.completedMatches]),[['q2duel5',2],['q3t2',1]]);
  const q=s.byMap.find(m=>m.map==='q2duel5').players.find(p=>!p.isBot);
  assert.equal(q.completedMatches,2);assert.equal(q.victoryPoints,10);
  assert.equal(s.byMap.reduce((sum,m)=>sum+m.completedMatches,0),3,'Count matches once, not once per participant');
});

test('activity does not require skill or a rated outcome; unknown winning skill remains explicit',()=>{
  const unknown=skilled('David-X',200);unknown.participants[1].skillTimeline[0].fromMs=1000;
  const changed={...game('q3t2','completed',0),ratingExcluded:'opponent_changed'};
  const s=aggregateMatches([unknown,changed]),q=s.players.find(p=>!p.isBot);
  assert.equal(s.completedMatches,2);assert.equal(q.completedMatches,2);
  assert.equal(q.victoryPoints,0);assert.equal(q.unscoredWins,1);
  assert.equal(victoryPoints(unknown,0),null);assert.equal(victoryPoints(changed,0),null);
});
