import {botDifficulty, victoryDuration} from '../public/rating.js';
import {modeDifficulty} from '../public/match-modes.js';
import {normalizeMatchResult} from '../public/match-result.js';
import {PROGRESS_DEFINITIONS} from './progress-definitions.js';
export {PROGRESS_DEFINITIONS};

// Never change this identifier on an ordinary release/restart: its activation
// timestamp belongs to the database, not the process or the operator's config.
export const PROGRESS_SET_ID='completed-matches-2026-11';
export async function activateProgressSet(collection, now=new Date()) {
  try {
    await collection.updateOne({_id:PROGRESS_SET_ID},{$setOnInsert:{activatedAt:now.toISOString()}},{upsert:true});
  } catch(e) { if(e.code!==11000)throw e; } // Concurrent first start, same unique _id.
  const record=await collection.findOne({_id:PROGRESS_SET_ID});
  if(!Number.isFinite(Date.parse(record?.activatedAt)))throw new Error('Invalid achievement activation timestamp');
  return record.activatedAt;
}
const count=n=>Number.isSafeInteger(n)&&n>=0;
const aliases={'R.Launch':'Rocket Launcher','C.Gun':'Chaingun','S.Shotgun':'Super Shotgun','H.Blaster':'HyperBlaster','M.Gun':'Machinegun','G.Launch':'Grenade Launcher'};

function contributions(m, i, duration) {
  const p=m.participants[i], opponent=m.participants[1-i], won=m.winnerIndex===i;
  const values=new Map(), unique=new Map(), add=(key,n=1)=>{if(n>0)values.set(key,n);};
  if(duration>=120&&won)add('wins2min:'+m.map);
  if(duration<600)return {values,unique};
  add('longGames');add('longSeconds',duration);
  if(won){
    add('longWins');add('mapWins:'+m.map);unique.set('mapsWon',m.map);
    const margin=p.score-opponent.score;
    if(margin>=1&&margin<=3)add('closeWins');
    if(opponent.score<=3)add('winsOpponentAtMost3');
    if(!p.isBot){
      const d=botDifficulty(m);
      const max=d.known&&(d.intervals.length?d.intervals.every(x=>x.value===d.maximum):d.averageSkill===d.maximum);
      if(max)add('maxSkillWins');
      if(max&&/^god(?:-x)?$/i.test(opponent.profile))add('godMaxWins');
      const modes=modeDifficulty(m);
      if(modes.hardcore==='on'&&modes.training==='off')add('hardcoreNoTrainingWins');
    }
  }
  unique.set('days',new Date(Date.parse(m.startedAt)+10800000).toISOString().slice(0,10));
  if(m.overtime===true||m.overtimePlayed===true)add('overtimeGames');
  if(!m.statsComplete||!p.stats)return {values,unique};
  const s=p.stats;
  if(count(s.kills)&&s.kills>=15)add('games15kills');
  if(won&&count(s.kills)&&s.kills>=10&&s.suicides===0)add('winsClean10kills');
  // A duplicated alias is not a second weapon and must not double its kills.
  const weapons=new Map();
  for(const w of s.weapons||[]){const name=aliases[w.name]||w.name;if(!weapons.has(name))weapons.set(name,w);}
  let three=0;
  for(const [name,w] of weapons){
    if(count(w.kills)){
      add(name+':kills',w.kills);
      if(w.kills>=3)three++;
      if(won&&w.kills>=5)add('wins5kills:'+name);
    }
    if(won&&name==='Railgun'&&count(w.shots)&&w.shots>=15&&count(w.hits)&&w.hits<=w.shots&&w.hits*2>=w.shots)add('rail50Wins');
  }
  if(won&&three>=3)add('wins3weapons');
  const picks=new Map();
  for(const item of s.pickups||[])if(count(item.count)&&!picks.has(item.name))picks.set(item.name,item.count);
  // Control is the legacy fallback, never an additional copy of the same pickup.
  for(const item of s.control||[])if(!picks.has(item.name)&&count(item.pickups))picks.set(item.name,item.pickups);
  for(const [name,n]of picks)add('pickups:'+name,n);
  return {values,unique};
}

// Pure calculation shared by runtime, pre-release audit and fixtures. All time
// gates use actual known match duration; file length/unknown dates cannot unlock.
// Historical progress counts, but only a post-activation threshold crossing
// earns a badge. Backfilled old games cannot award already-met historical goals.
export function computeProgressAchievements(input, activatedAt=null) {
  const activation=Date.parse(activatedAt), groups={human:new Map(),bot:new Map()};
  const rows=[...new Map(input.filter(m=>m.id).map(m=>[m.id,normalizeMatchResult(m)])).values()]
    .map(m=>{const d=victoryDuration(m),start=Date.parse(m.startedAt);return {m,d,end:d.known&&Number.isFinite(start)?start+d.seconds*1000:NaN};})
    .filter(({m,d,end})=>m.status==='completed'&&!m.ratingExcluded&&d.known&&Number.isFinite(end)&&m.participants?.length===2&&m.participants.filter(p=>p.isBot).length===1)
    .sort((a,b)=>a.end-b.end||a.m.id.localeCompare(b.m.id));
  for(const {m,d,end} of rows)for(let i=0;i<2;i++){
    const p=m.participants[i],kind=p.isBot?'bot':'human',name=p.isBot?p.profile:p.name;
    if(!name)continue;
    if(!groups[kind].has(name))groups[kind].set(name,{name,kind,awards:new Map(),metrics:new Map(),evidence:new Map(),unique:new Map()});
    const g=groups[kind].get(name), {values,unique}=contributions(m,i,d.seconds);
    for(const [key,value]of unique){
      if(!g.unique.has(key))g.unique.set(key,new Set());
      if(!g.unique.get(key).has(value)){g.unique.get(key).add(value);values.set(key,1);}
    }
    for(const [key,n]of values){
      const before=g.metrics.get(key)||0,after=before+n;g.metrics.set(key,after);
      if(!g.evidence.has(key))g.evidence.set(key,[]);g.evidence.get(key).push(m.id);
      for(const def of PROGRESS_DEFINITIONS){
        if(def.audience!==kind||def.metric!==key||before>=def.threshold||after<def.threshold||!Number.isFinite(activation)||end<=activation)continue;
        g.awards.set(def.id,{earnedAt:new Date(end).toISOString(),metric:after,evidence:[...g.evidence.get(key)]});
      }
    }
  }
  return groups;
}
