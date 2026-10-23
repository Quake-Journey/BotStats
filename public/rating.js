// One policy for both API aggregation and the browser's per-match explanation.
export const ratingPolicy = Object.freeze({
  version: 'victory-duration-skill-v3',
  skill: Object.freeze({standardReference:200, humanReference:100, inverseWeightCap:4}),
  duration: Object.freeze({minimumSeconds:120, maximumSeconds:600, minimumPoints:1, maximumPoints:10}),
  human: Object.freeze({win:10, loss:-1, forfeitWin:0, forfeitLoss:-5, draw:0}),
  bot: Object.freeze({win:2, loss:-1, forfeitLeading:1, forfeitNotLeading:0, draw:0})
});

// durationSeconds is the parser's full active duration, including overtime.
// At a timelimit it is corrected from the game clock; timelineDurationMs may
// differ by a frame. Never substitute wall-clock recording length or a fragment.
export function victoryDuration(match) {
  if(match.startObserved===false)return {known:false,reason:'partial_duration'};
  const seconds=Number.isFinite(match.durationSeconds)?match.durationSeconds:
    match.startObserved===true&&Number.isFinite(match.timelineDurationMs)?match.timelineDurationMs/1000:null;
  if(!Number.isFinite(seconds)||seconds<=0)return {known:false,reason:'unknown_duration'};
  const p=ratingPolicy.duration;
  const basePoints=seconds<p.minimumSeconds?0:seconds>=p.maximumSeconds?p.maximumPoints:
    p.minimumPoints+(p.maximumPoints-p.minimumPoints)*(seconds-p.minimumSeconds)/(p.maximumSeconds-p.minimumSeconds);
  return {known:true,seconds,basePoints,factor:basePoints/p.maximumPoints};
}

// Timelines use active match time: parser has already removed pauses and warmup.
// Human has its own 1..100 scale; GOD's 250 stays above the standard 200 reference.
export function botDifficulty(match) {
  const bot=match.participants.find(p=>p.isBot);
  if(!bot)return {known:false,reason:'missing_bot'};
  const profile=(bot.profile||bot.name.replace(/(?:\[\d+\]|>\d+)$/,'')).toLowerCase();
  const human=/^human(?:-x)?$/.test(profile),god=/^god(?:-x)?$/.test(profile);
  const reference=human?ratingPolicy.skill.humanReference:ratingPolicy.skill.standardReference;
  const maximum=human?100:god?250:200;
  const valid=s=>Number.isFinite(s)&&s>=1&&s<=maximum;
  const unknown=reason=>({known:false,reason,reference});
  if(match.startObserved===false)return unknown('partial_skill_history');
  const durationMs=match.timelineDurationMs??(Number.isFinite(match.durationSeconds)?match.durationSeconds*1000:null);
  let intervals=bot.skillTimeline;
  if(!Array.isArray(intervals)||!intervals.length){
    if(bot.skillVariable)return unknown('missing_skill_history');
    const named=bot.name.match(/(?:\[(\d+)\]|>(\d+))$/)?.slice(1).find(x=>x!==undefined);
    const value=bot.skill??(named===undefined?null:Number(named));
    if(!valid(value))return unknown('unknown_skill');
    return {known:true,averageSkill:value,factor:value/reference,reference,durationMs,source:'constant_skill',intervals:[]};
  }
  if(!Number.isFinite(durationMs)||durationMs<=0)return unknown('unknown_duration');
  if(intervals.some(x=>!Number.isFinite(x.fromMs)||!Number.isFinite(x.toMs)||x.fromMs<0||x.toMs<x.fromMs))return unknown('invalid_skill_history');
  intervals=intervals.map(x=>({...x,toMs:Math.min(durationMs,x.toMs)})).filter(x=>x.toMs>x.fromMs).sort((a,b)=>a.fromMs-b.fromMs);
  let cursor=0,weighted=0;
  for(const x of intervals){
    if(x.fromMs!==cursor||!valid(x.value))return unknown('incomplete_skill_history');
    weighted+=x.value*(x.toMs-x.fromMs);cursor=x.toMs;
  }
  if(cursor!==durationMs)return unknown('incomplete_skill_history');
  const averageSkill=weighted/durationMs;
  return {known:true,averageSkill,factor:averageSkill/reference,reference,durationMs,source:'time_weighted',intervals};
}

export function resultKnown(match) {
  return !match.ratingExcluded && (match.status==='completed' ||
    (match.status==='forfeit' && Number.isInteger(match.winnerIndex)));
}

export function matchPoints(match,index) {
  if(!resultKnown(match))return null;
  const p=match.participants[index],other=match.participants[1-index];
  const policy=p.isBot?ratingPolicy.bot:ratingPolicy.human;
  if(match.status==='forfeit') {
    if(p.isBot)return p.score>other.score?policy.forfeitLeading:policy.forfeitNotLeading;
    return match.winnerIndex===index?policy.forfeitWin:policy.forfeitLoss;
  }
  if(match.winnerIndex===null)return policy.draw;
  if(p.isBot)return match.winnerIndex===index?policy.win:policy.loss;
  const won=match.winnerIndex===index;
  const duration=won?victoryDuration(match):null;
  if(won&&!duration.known)return null;
  if(won&&duration.basePoints===0)return 0;
  const difficulty=botDifficulty(match);if(!difficulty.known)return null;
  const k=difficulty.factor,inverse=Math.min(ratingPolicy.skill.inverseWeightCap,1/k);
  return won?duration.basePoints*k:policy.loss*inverse;
}

// Victory rating is independent of penalties. Forfeits never award victory points.
// A win with unknown required difficulty/duration stays unscored, not guessed.
export function victoryPoints(match,index){
  if(!resultKnown(match))return null;
  if(match.status!=='completed'||match.winnerIndex!==index)return 0;
  return matchPoints(match,index);
}

export function rankParticipants(rows,mode='victory'){
  const key=mode==='activity'?'completedMatches':mode==='average'?'points':'victoryPoints';
  return [...rows].sort((a,b)=>b[key]-a[key]||
    (mode==='average'?b.wins-a.wins||b.matches-a.matches:
      mode==='activity'?0:b.normalWins-a.normalWins)||a.name.localeCompare(b.name,'en'));
}

export function rankMaps(rows){
  return rows.filter(r=>r.completedMatches>0).sort((a,b)=>b.completedMatches-a.completedMatches||a.map.localeCompare(b.map,'en'));
}

export function ratingDetails(match){
  return {version:ratingPolicy.version,difficulty:botDifficulty(match),duration:victoryDuration(match),points:match.participants.map((_,i)=>matchPoints(match,i)),victoryPoints:match.participants.map((_,i)=>victoryPoints(match,i))};
}
