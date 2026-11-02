import {normalizeMatchResult} from '../public/match-result.js';
import {botDifficulty} from '../public/rating.js';
import {modeState} from '../public/match-modes.js';
import {buildDynamics} from './dynamics.js';

export const chartTypes=['duration','finished','maps','skill','margin','modes','items','activity'];
const count=key=>({key,humanWins:0,botWins:0,forfeits:0,draws:0,matches:0});
const goodNumber=n=>Number.isFinite(n)&&n>=0;
export function fullSeconds(m){
  if(m.startObserved===false)return null;
  const n=Number.isFinite(m.durationSeconds)?m.durationSeconds:m.startObserved===true&&Number.isFinite(m.timelineDurationMs)?m.timelineDurationMs/1000:null;
  return goodNumber(n)?n:null;
}
export function durationBucket(m){
  const n=fullSeconds(m);
  return n===null?'unknown':n<10?'under10':n<30?'10to30':n<60?'30to60':n<600?'minute'+Math.floor(n/60):n===600?'minute10':'over10';
}
function valid(m){return m.participants?.length===2&&m.participants.filter(p=>p.isBot===true).length===1&&m.participants.filter(p=>p.isBot===false).length===1&&!m.ratingExcluded&&['completed','forfeit'].includes(m.status);}
function result(m){return m.winnerIndex===0||m.winnerIndex===1?(m.participants[m.winnerIndex].isBot?'bot':'human'):'draw';}
function add(group,m){group.matches++;const who=result(m);if(who==='draw')group.draws++;else group[who+'Wins']++;if(m.status==='forfeit')group.forfeits++;}
function modeKey(m){const hc=modeState(m.modes?.hardcore),tr=modeState(m.modes?.training);return hc==='variable'||tr==='variable'?'variable':hc==='unknown'||tr==='unknown'?'unknown':hc==='on'?(tr==='on'?'both':'hardcore'):tr==='on'?'training':'normal';}
function skillKey(m){const d=botDifficulty(m);if(!d.known)return 'unknown';const percent=d.averageSkill/d.maximum*100;return percent<=25?'0to25':percent<=50?'25to50':percent<=75?'50to75':percent<100?'75to100':'100';}
function marginKey(m){const h=m.participants.find(p=>!p.isBot)?.score,b=m.participants.find(p=>p.isBot)?.score;if(!Number.isFinite(h)||!Number.isFinite(b))return 'unknown';const n=h-b,abs=Math.abs(n);return n===0?'draw':(n>0?'human':'bot')+(abs<=1?'1':abs<=5?'2to5':abs<=10?'6to10':abs<=20?'11to20':'over20');}
function activityKey(m){const time=Date.parse(m.startedAt);if(!Number.isFinite(time))return 'unknown';const d=new Date(time+10800000);return ((d.getUTCDay()+6)%7)+'-'+d.getUTCHours();}
export function chartKey(m,type){return type==='duration'?durationBucket(m):type==='maps'?(m.map||'unknown'):type==='skill'?skillKey(m):type==='margin'?marginKey(m):type==='modes'?modeKey(m):type==='activity'?activityKey(m):null;}
export function chartRows(rows,type,query={}){
  const normal=type==='finished'||type==='margin'||type==='items'||query.chartResults==='completed';
  return rows.map(normalizeMatchResult).filter(m=>valid(m)&&(!normal||m.status==='completed'));
}
export function chartProjection(type){
  // Only the opened chart's fields cross the MongoDB/Node boundary.
  const p={_id:0,id:1,status:1,winnerIndex:1,ratingExcluded:1,'participants.isBot':1};
  if(type==='duration'||type==='items'||type==='skill')Object.assign(p,{durationSeconds:1,timelineDurationMs:1,startObserved:1});
  if(type==='finished'||type==='activity')p.startedAt=1;
  if(type==='maps')p.map=1;
  if(type==='skill')for(const k of ['name','profile','metadataProfile','skill','skillVariable','skillTimeline'])p['participants.'+k]=1;
  if(type==='margin')p['participants.score']=1;
  if(type==='modes')p.modes=1;
  if(type==='items'){p.map=1;p['participants.stats.control']=1;p.statsComplete=1;}
  return p;
}
export function chartCacheKey(type,query){return JSON.stringify([type,...Object.keys(query).sort().map(k=>[k,query[k]])]);}
export function makeChartCache({limit=24,ttl=20000}={}){
  const values=new Map();let generation=0;
  return {clear(){generation++;values.clear();},async get(key,load){
    const existing=values.get(key);if(existing&&existing.until>Date.now())return existing.promise;
    values.delete(key);while(values.size>=limit)values.delete(values.keys().next().value);
    const own=generation,entry={until:Date.now()+ttl};
    entry.promise=Promise.resolve().then(load).catch(e=>{if(generation===own&&values.get(key)===entry)values.delete(key);throw e;});values.set(key,entry);return entry.promise;
  }};
}
export function buildChart(raw,type,query={},now=new Date()){
  if(!chartTypes.includes(type)&&type!=='balance')throw Object.assign(new Error('Unknown chart'),{status:400});
  const rows=chartRows(raw,type,query),totals=count('total');for(const m of rows)add(totals,m);
  const base={type,totals,normalOnly:['finished','margin','items'].includes(type)||query.chartResults==='completed',excluded:raw.length-rows.length};
  if(type==='balance')return base;
  if(type==='finished')return {...base,trend:buildDynamics(rows,query,now)};
  if(type==='items'){
    const groups=new Map();let eligible=0;
    for(const m of rows){
      const seconds=fullSeconds(m);if(!seconds||result(m)==='draw'||!m.statsComplete)continue;
      const winner=m.participants[m.winnerIndex],loser=m.participants[1-m.winnerIndex];
      const w=winner.stats?.control,l=loser.stats?.control;if(!Array.isArray(w)||!Array.isArray(l))continue;
      const wm=new Map(w.map(x=>[x.name,x.pickups])),lm=new Map(l.map(x=>[x.name,x.pickups]));let contributed=false;
      for(const [name,value] of wm){
        const loss=lm.get(name);if(!goodNumber(value)||!goodNumber(loss))continue;
        const key=JSON.stringify([m.map||'unknown',name]);if(!groups.has(key))groups.set(key,{key,map:m.map||'unknown',item:name,winnerPickups:0,loserPickups:0,seconds:0,matches:0});
        const group=groups.get(key);group.winnerPickups+=value;group.loserPickups+=loss;group.seconds+=seconds;group.matches++;contributed=true;
      }
      if(contributed)eligible++;
    }
    return {...base,eligible,groups:[...groups.values()].map(x=>({...x,winnerPer10:x.winnerPickups*600/x.seconds,loserPer10:x.loserPickups*600/x.seconds})).sort((a,b)=>a.map.localeCompare(b.map)||a.item.localeCompare(b.item))};
  }
  let keys=[];
  if(type==='duration')keys=['under10','10to30','30to60',...Array.from({length:10},(_,i)=>'minute'+(i+1)),'over10','unknown'];
  if(type==='skill')keys=['0to25','25to50','50to75','75to100','100','unknown'];
  if(type==='margin')keys=['botover20','bot11to20','bot6to10','bot2to5','bot1','draw','human1','human2to5','human6to10','human11to20','humanover20','unknown'];
  if(type==='modes')keys=['normal','hardcore','training','both','variable','unknown'];
  if(type==='activity')keys=Array.from({length:168},(_,i)=>Math.floor(i/24)+'-'+i%24).concat('unknown');
  const groups=new Map(keys.map(key=>[key,count(key)]));
  for(const m of rows){const key=chartKey(m,type);if(!groups.has(key))groups.set(key,count(key));const g=groups.get(key);add(g,m);
    if(type==='skill'){const d=botDifficulty(m);if(d.known){g.skillTotal=(g.skillTotal||0)+d.averageSkill;g.skillSamples=(g.skillSamples||0)+1;g.variableMatches=(g.variableMatches||0)+Number(m.participants.find(p=>p.isBot).skillVariable===true);}}
  }
  let values=[...groups.values()];if(type==='maps')values.sort((a,b)=>(b.humanWins/(b.humanWins+b.botWins||1))-(a.humanWins/(a.humanWins+a.botWins||1))||b.matches-a.matches||a.key.localeCompare(b.key));
  return {...base,groups:values};
}
export function chartSelection(rows,type,query){
  return chartRows(rows,type,query).filter(m=>{
    if(query.chartOutcome&&query.chartOutcome!=='all'&&(query.chartOutcome==='forfeit'?m.status!=='forfeit':result(m)!==query.chartOutcome||query.chartOutcome==='bot'&&m.status==='forfeit'))return false;
    if(type==='finished'){
      if(!query.bucketFrom||!query.bucketTo)return false;
      const t=Date.parse(m.startedAt);return Number.isFinite(t)&&t>=Date.parse(query.bucketFrom+'T00:00:00+03:00')&&t<=Date.parse(query.bucketTo+'T23:59:59.999+03:00');
    }
    return chartKey(m,type)===query.bucket;
  }).map(m=>m.id);
}
