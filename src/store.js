import { MongoClient } from 'mongodb';
import {computeAchievements,publicAchievements,achievementDetail} from './achievements.js';
import {buildDynamics} from './dynamics.js';
import {buildBotVictims} from './bot-victims.js';
import { ratingPolicy, matchPoints, victoryPoints, resultKnown, ratingDetails, botDifficulty, victoryDuration } from '../public/rating.js';
import {humanPerformance} from '../public/performance-rating.js';
import {normalizeMatchResult} from '../public/match-result.js';
import {matchResultStages} from './match-results.js';

const escapeRegex=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const botFirst={$arrayElemAt:['$participants.isBot',0]};
const humanScore={$cond:[botFirst,{$arrayElemAt:['$participants.score',1]},{$arrayElemAt:['$participants.score',0]}]};
const botScore={$cond:[botFirst,{$arrayElemAt:['$participants.score',0]},{$arrayElemAt:['$participants.score',1]}]};
export function periodBounds(period,now=new Date()) {
  const days={today:1,three:3,week:7,month:30,year:365}[period];
  if(!days)return null;
  const today=new Date(now.getTime()+3*3600000).toISOString().slice(0,10);
  const midnight=Date.parse(today+'T00:00:00Z');
  return {from:new Date(midnight-(days-1)*86400000).toISOString().slice(0,10),to:today};
}
export function filters(query,now=new Date()) {
  query={...query,...periodBounds(query.period,now)};
  const q={};
  for(const key of ['map','status','modVersion'])if(query[key])q[key]=String(query[key]).slice(0,80);
  if(query.overtime==='1')q.overtime=true;
  if(query.q)q['participants.name']={$regex:escapeRegex(String(query.q).slice(0,80)),$options:'i'};
  const bot={isBot:true};
  if(query.bot)bot.profile=String(query.bot).slice(0,80);
  if(query.style)bot['styleTimeline.value']=String(query.style).slice(0,20);
  if(query.skill==='variable')bot.skillVariable=true;
  else if(query.skill && /^\d+$/.test(query.skill))bot['skillTimeline.value']=+query.skill;
  if(Object.keys(bot).length>1)q.participants={$elemMatch:bot};
  if(query.identity){const identity={isBot:query.kind==='bot'};identity[query.kind==='bot'?'profile':'name']=String(query.identity).slice(0,128);if(q.participants)q.$and=[{participants:q.participants},{participants:{$elemMatch:identity}}];else q.participants={$elemMatch:identity};if(q.$and)delete q.participants;}
  if(query.q&&query.playerSearch==='1')q.$and=[...(q.$and||[]),{participants:{$elemMatch:{isBot:false,name:{$regex:escapeRegex(String(query.q).slice(0,80)),$options:'i'}}}}];
  if(query.from && /^\d{4}-\d\d-\d\d$/.test(query.from)&&Number.isFinite(Date.parse(query.from+'T00:00:00+03:00')))q.startedAt={$gte:new Date(query.from+'T00:00:00+03:00').toISOString()};
  if(query.to && /^\d{4}-\d\d-\d\d$/.test(query.to)&&Number.isFinite(Date.parse(query.to+'T23:59:59.999+03:00')))q.startedAt={...q.startedAt,$lte:new Date(query.to+'T23:59:59.999+03:00').toISOString()};
  if(query.humanDefeats==='1'){
    q.$and=[...(q.$and||[]),{status:{$in:['completed','forfeit']}}];
    q.ratingExcluded=null;
    q.winnerIndex={$in:[0,1]};
    q.$expr={$and:[{$eq:[{$arrayElemAt:['$participants.isBot',{$ifNull:['$winnerIndex',0]}]},true]},{$gt:[botScore,humanScore]}]};
  }
  if(query.botDefeats==='1'){
    q.$and=[...(q.$and||[]),{status:'completed'},{$expr:{$and:[{$eq:[{$arrayElemAt:['$participants.isBot',{$ifNull:['$winnerIndex',0]}]},false]},{$gt:[humanScore,botScore]}]}}];
    q.ratingExcluded=null;
    q.winnerIndex={$in:[0,1]};
  }
  return q;
}

export function aggregateMatches(rows,includeMaps=true,asOf=new Date()){
  rows=rows.map(normalizeMatchResult);
  const players=new Map(),humanGames=new Map();let humanWins=0,botWins=0,finished=0,completedDurationSeconds=0,completedDurationMatches=0;
  for(const m of rows){
    const known=resultKnown(m),dateMs=Date.parse(m.startedAt),dated=Number.isFinite(dateMs)?new Date(dateMs).toISOString():null;
    const duration=m.status==='completed'?victoryDuration(m):{known:false};
    const difficulty=known&&m.status==='completed'&&m.winnerIndex!==null?botDifficulty(m):null;
    const botPing=m.participants.find(p=>p.isBot)?.ping,humanPing=m.participants.find(p=>!p.isBot)?.ping;
    if(duration.known){completedDurationSeconds+=duration.seconds;completedDurationMatches++;}
    if(known){finished++;if(m.winnerIndex!==null){if(m.participants[m.winnerIndex].isBot)botWins++;else humanWins++;}}
    for(let i=0;i<m.participants.length;i++){
      const p=m.participants[i],name=p.isBot?p.profile:p.name,key=`${p.isBot}:${name}`;
      if(!p.isBot){if(!humanGames.has(key))humanGames.set(key,[]);humanGames.get(key).push(m);}
      if(!players.has(key))players.set(key,{name,isBot:p.isBot,matches:0,finished:0,ratedMatches:0,wins:0,losses:0,draws:0,forfeits:0,forfeitWins:0,overtimeMatches:0,overtimeWins:0,overtimeLosses:0,overtimeForfeits:0,points:0,score:0,opponentScore:0,kills:0,deaths:0,damage:0,statsMatches:0,completedDurationSeconds:0,completedDurationMatches:0,winBotSkillTotal:0,winBotSkillMatches:0,winBotPingTotal:0,winBotPingMatches:0,winHumanPingTotal:0,winHumanPingMatches:0});
      const r=players.get(key);r.matches++;r.score+=p.score;r.opponentScore+=m.participants[1-i].score;
      // Match dates follow the same start timestamp shown in the match list.
      if(dated&&(!r.lastGameAt||dated>r.lastGameAt||(dated===r.lastGameAt&&String(m.id||'')>String(r.lastGameMatchId||'')))){
        r.lastGameAt=dated;r.lastGameMatchId=m.id||null;
      }
      if(dated&&known&&m.status==='completed'&&m.winnerIndex===i&&(!r.lastWinAt||dated>r.lastWinAt))r.lastWinAt=dated;
      r.completedMatches=(r.completedMatches||0)+Number(m.status==='completed');
      if(duration.known){r.completedDurationSeconds+=duration.seconds;r.completedDurationMatches++;}
      // Each ordinary win contributes one match-average skill. The shared
      // difficulty reader already weights changes within that match by time.
      if(m.winnerIndex===i&&difficulty?.known){r.winBotSkillTotal+=difficulty.averageSkill;r.winBotSkillMatches++;}
      // Match ping is already time-weighted from actual scoreboard observations.
      // Average the available winning-match means, without guessing missing pings.
      if(known&&m.status==='completed'&&m.winnerIndex===i&&Number.isFinite(botPing?.averageMs)&&botPing.averageMs>=0&&Number.isFinite(botPing.samples)&&botPing.samples>0){
        r.winBotPingTotal+=botPing.averageMs;r.winBotPingMatches++;
      }
      if(known&&m.status==='completed'&&m.winnerIndex===i&&Number.isFinite(humanPing?.averageMs)&&humanPing.averageMs>=0&&Number.isFinite(humanPing.samples)&&humanPing.samples>0){
        r.winHumanPingTotal+=humanPing.averageMs;r.winHumanPingMatches++;
      }
      r.victoryPoints=(r.victoryPoints||0)+(victoryPoints(m,i)??0);
      r.unscoredWins=(r.unscoredWins||0)+Number(known&&m.status==='completed'&&m.winnerIndex===i&&victoryPoints(m,i)===null);
      if(known){
        r.finished++;const points=matchPoints(m,i);
        // Human Average uses only normally completed games. A forfeit must
        // affect neither its numerator nor its denominator (bots keep their policy).
        if(points!==null&&(p.isBot||m.status==='completed')){r.ratedMatches++;r.points+=points;}
        if(m.winnerIndex===i){r.wins++;if(m.status==='forfeit')r.forfeitWins++;}
        else if(m.winnerIndex===null)r.draws++;
        else {r.losses++;if(m.status==='forfeit')r.forfeits++;}
        if(m.overtime){r.overtimeMatches++;if(m.status==='forfeit')r.overtimeForfeits++;else if(m.winnerIndex===i)r.overtimeWins++;else if(m.winnerIndex!==null)r.overtimeLosses++;}
      }
      if(p.stats){r.statsMatches++;r.kills+=p.stats.kills;r.deaths+=p.stats.deaths;r.damage+=p.stats.damageDealt;}
    }
  }
  const result={matches:rows.length,finished,interrupted:rows.length-finished,humanWins,botWins,fullStats:rows.filter(x=>x.statsComplete).length,minutes:Math.round(rows.reduce((s,x)=>s+(x.durationSeconds??x.recordedSeconds),0)/60),players:[...players.values()].map(p=>({...p,
    normalWins:p.wins-p.forfeitWins,normalLosses:p.losses-p.forfeits,winRate:p.finished?p.wins/p.finished*100:null,pointsPerMatch:p.ratedMatches?p.points/p.ratedMatches:null,
    normalMatches:p.finished-p.forfeits-p.forfeitWins,
    completedWinRate:p.finished-p.forfeits-p.forfeitWins?(p.wins-p.forfeitWins)/(p.finished-p.forfeits-p.forfeitWins)*100:null,
    forfeitRate:p.finished?p.forfeits/p.finished*100:null,
    unratedMatches:p.finished-(p.isBot?0:p.forfeits+p.forfeitWins)-p.ratedMatches,
    averageWinBotSkill:p.winBotSkillMatches?p.winBotSkillTotal/p.winBotSkillMatches:null,
    averageWinBotPingMs:p.winBotPingMatches?p.winBotPingTotal/p.winBotPingMatches:null,
    averageWinHumanPingMs:p.winHumanPingMatches?p.winHumanPingTotal/p.winHumanPingMatches:null,
    averageCompletedDurationSeconds:p.completedDurationMatches?p.completedDurationSeconds/p.completedDurationMatches:null,
    averageScore:p.matches?p.score/p.matches:null,averageOpponentScore:p.matches?p.opponentScore/p.matches:null,
    fragDifference:p.score-p.opponentScore,averageFragDifference:p.matches?(p.score-p.opponentScore)/p.matches:null,
    averageKills:p.statsMatches?p.kills/p.statsMatches:null,averageDeaths:p.statsMatches?p.deaths/p.statsMatches:null,
    killDeathDifference:p.statsMatches?p.kills-p.deaths:null,averageKillDeathDifference:p.statsMatches?(p.kills-p.deaths)/p.statsMatches:null,
    averageDamage:p.statsMatches?p.damage/p.statsMatches:null
  })).sort((a,b)=>b.points-a.points||b.wins-a.wins||b.matches-a.matches||a.name.localeCompare(b.name))};
  result.asOf=asOf.toISOString();
  for(const player of result.players){player.lastGameAt??=null;player.lastGameMatchId??=null;player.lastWinAt??=null;
    if(!player.isBot)player.performance=humanPerformance(humanGames.get(`false:${player.name}`)||[]);
  }
  result.ratingPolicy=ratingPolicy;
  result.completedMatches=rows.filter(m=>m.status==='completed').length;
  result.completedDurationMatches=completedDurationMatches;
  result.averageCompletedDurationSeconds=completedDurationMatches?completedDurationSeconds/completedDurationMatches:null;
  result.overtimeMatches=rows.filter(m=>m.overtime&&resultKnown(m)).length;
  if(includeMaps)result.byMap=[...new Set(rows.map(m=>m.map))].sort().map(map=>({map,...aggregateMatches(rows.filter(m=>m.map===map),false,asOf)}));
  return result;
}
export function matchSortStages(query) {
  const values={date:'$startedAt',map:'$map',match:{$concat:[{$arrayElemAt:['$participants.name',0]},' ',{$arrayElemAt:['$participants.name',1]}]},score:{$arrayElemAt:['$participants.score',0]},status:'$status',duration:{$ifNull:['$durationSeconds','$recordedSeconds']},version:'$modVersion',margin:{$subtract:[botScore,humanScore]},human:{$cond:[botFirst,{$arrayElemAt:['$participants.name',1]},{$arrayElemAt:['$participants.name',0]}]},bot:{$cond:[botFirst,{$arrayElemAt:['$participants.name',0]},{$arrayElemAt:['$participants.name',1]}]},humanScore};
  if(query.botDefeats==='1')values.margin={$subtract:[humanScore,botScore]};
  const key=Object.hasOwn(values,query.sort_matches)?query.sort_matches:'date';
  const direction=query.dir_matches==='asc'?1:-1;
  return [{$set:{sortValue:values[key],sortTie:key==='score'?{$arrayElemAt:['$participants.score',1]}:'$startedAt'}},{$set:{sortMissing:{$cond:[{$eq:[{$ifNull:['$sortValue',null]},null]},1,0]}}},{$sort:{sortMissing:1,sortValue:direction,sortTie:direction,id:1}}];
}
export async function openStore(config) {
  if(!/^q2pro_botstats(?:_[a-z0-9_]+)?$/.test(config.database))throw new Error('Use a separate q2pro_botstats database');
  const client=new MongoClient(config.mongoUri,{serverSelectionTimeoutMS:5000});
  await client.connect();const db=client.db(config.database),demos=db.collection('demos');
  await demos.createIndex({'matches.startedAt':-1});await demos.createIndex({'matches.map':1});
  await demos.createIndex({'matches.participants.name':1});
  const base=()=>[{$unwind:'$matches'},{$replaceRoot:{newRoot:{$mergeObjects:['$matches',{demo:'$demo',parserVersion:'$parserVersion'}]}}},...matchResultStages()];
  let awardRevision=0,awardCache=null,awardPending=null;
  async function awardIndex(){
    const revision=awardRevision;
    if(awardCache?.revision===revision&&Date.now()-awardCache.at<30000)return awardCache.value;
    if(awardPending?.revision===revision)return awardPending.promise;
    const promise=(async()=>{
      const rows=await demos.aggregate([...base(),{$project:{demo:0,stateHistory:0,settingsChanges:0,events:0}}]).toArray();
      const value=computeAchievements(rows);
      if(awardRevision===revision)awardCache={revision,at:Date.now(),value};
      return value;
    })();
    awardPending={revision,promise};
    try{return await promise;}finally{if(awardPending?.promise===promise)awardPending=null;}
  }
  return {
    close:()=>client.close(),ping:()=>db.command({ping:1}),demo:sha=>demos.findOne({_id:sha}),
    async save(manifest){await demos.replaceOne({_id:manifest.demo.sha256},{_id:manifest.demo.sha256,...manifest,importedAt:new Date()},{upsert:true,writeConcern:{w:1,j:true}});awardRevision++;awardCache=null;},
    async achievements(){return publicAchievements(await awardIndex());},
    async achievement(id,query){return achievementDetail(await awardIndex(),id,query);},
    async victims(query){
      const rows=await demos.aggregate([...base(),{$match:filters(query)},{$project:{id:1,startedAt:1,status:1,winnerIndex:1,ratingExcluded:1,durationSeconds:1,timelineDurationMs:1,startObserved:1,participants:1}}]).toArray();
      return buildBotVictims(rows);
    },
    async dynamics(query){
      // This view always includes all skills and technical results. Unrelated
      // rating-tab filters in a shared URL cannot silently remove forfeits.
      const allowed=['period','from','to','q','map','bot','style','modVersion'];
      const selected=Object.fromEntries(allowed.filter(k=>query[k]).map(k=>[k,query[k]]));
      const now=new Date(),range={...selected,...periodBounds(selected.period,now)};
      const rows=await demos.aggregate([...base(),{$match:filters(selected,now)},{$project:{startedAt:1,status:1,winnerIndex:1,ratingExcluded:1,'participants.isBot':1}}]).toArray();
      return buildDynamics(rows,range,now);
    },
    async match(id){const m=(await demos.aggregate([...base(),{$match:{id}},{$limit:1}]).toArray())[0];return m?{...m,rating:ratingDetails(m)}:null;},
    async list(query){
      const page=Math.max(1,Math.min(10000,Number(query.page)||1)),limit=20;
      const [r]=await demos.aggregate([...base(),{$match:filters(query)},...matchSortStages(query),{$facet:{total:[{$count:'n'}],items:[{$skip:(page-1)*limit},{$limit:limit},{$project:{events:0,stateHistory:0,scoreHistory:0,sortValue:0,sortTie:0,sortMissing:0}}]}}],{collation:{locale:'en',numericOrdering:true,strength:2}}).toArray();
      return {items:r.items.map(m=>({...m,rating:ratingDetails(m)})),total:r.total[0]?.n||0,page,pages:Math.ceil((r.total[0]?.n||0)/limit)};
    },
    async facets(){const rows=await demos.aggregate([...base(),{$project:{map:1,modVersion:1,participants:1}}]).toArray();const values=fn=>[...new Set(rows.flatMap(fn).filter(x=>x!==null&&x!==undefined))].sort();return {maps:values(x=>[x.map]),versions:values(x=>[x.modVersion]),bots:values(x=>x.participants.filter(p=>p.isBot).map(p=>p.profile)),styles:values(x=>x.participants.filter(p=>p.isBot).flatMap(p=>[p.style,...(p.styleTimeline||[]).map(x=>x.value)])),skills:values(x=>x.participants.filter(p=>p.isBot).flatMap(p=>[p.skill,...(p.skillTimeline||[]).map(x=>x.value)]))};},
    async summary(query){
      const rows=await demos.aggregate([...base(),{$match:filters(query)},{$project:{id:1,startedAt:1,participants:1,winnerIndex:1,status:1,durationSeconds:1,recordedSeconds:1,timelineDurationMs:1,startObserved:1,map:1,statsComplete:1,overtime:1,ratingExcluded:1}}]).toArray();
      return aggregateMatches(rows);
    }
  };
}
