const DAY=86400000,MSK=3*3600000;
const dateKey=ms=>new Date(ms).toISOString().slice(0,10);
const dayTime=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&dateKey(Date.parse(s+'T00:00:00Z'))===s?Date.parse(s+'T00:00:00Z'):null;
const empty=()=>({botWins:0,humanWins:0,botForfeitWins:0,humanForfeitWins:0});
function startOf(ms,unit){
  const d=new Date(ms);
  if(unit==='week')return ms-((d.getUTCDay()+6)%7)*DAY;
  if(unit==='month')d.setUTCDate(1);
  if(unit==='year'){d.setUTCMonth(0);d.setUTCDate(1);}
  return d.getTime();
}
function next(ms,unit){
  if(unit==='day')return ms+DAY;
  if(unit==='week')return ms+7*DAY;
  const d=new Date(ms);if(unit==='month')d.setUTCMonth(d.getUTCMonth()+1);else d.setUTCFullYear(d.getUTCFullYear()+1);return d.getTime();
}
function complete(value){const matches=value.botWins+value.humanWins;return {...value,matches,forfeits:value.botForfeitWins+value.humanForfeitWins,botWinPercent:matches?100*value.botWins/matches:null};}

// Rows have already been filtered by map/player/bot/date. Outcomes are counts,
// never rating points: a technical winner counts even when behind on score.
export function buildDynamics(rows,range={},now=new Date()){
  const dated=[],excluded={undated:0,draws:0,unconfirmed:0,changedOpponent:0};
  for(const m of rows){
    if(m.participants?.length!==2||m.participants.filter(p=>p.isBot).length!==1)continue;
    if(m.ratingExcluded){excluded.changedOpponent++;continue;}
    if(!['completed','forfeit'].includes(m.status)){excluded.unconfirmed++;continue;}
    if(m.status==='completed'&&m.winnerIndex===null){excluded.draws++;continue;}
    if(![0,1].includes(m.winnerIndex)){excluded.unconfirmed++;continue;}
    const timestamp=Date.parse(m.startedAt);
    if(!Number.isFinite(timestamp)){excluded.undated++;continue;}
    const day=dayTime(dateKey(timestamp+MSK));
    dated.push({day,bot:Boolean(m.participants[m.winnerIndex].isBot),forfeit:m.status==='forfeit'});
  }
  const suppliedFrom=dayTime(range.from),suppliedTo=dayTime(range.to);
  const first=dated.reduce((n,x)=>Math.min(n,x.day),Infinity),last=dated.reduce((n,x)=>Math.max(n,x.day),-Infinity);
  const from=suppliedFrom??(dated.length?first:suppliedTo);
  const to=suppliedTo??(suppliedFrom!==null?dayTime(dateKey(now.getTime()+MSK)):dated.length?last:null);
  const base={timezone:'Europe/Moscow',excluded,totals:complete(empty())};
  if(from===null||to===null)return {...base,from:null,to:null,unit:'day',points:[]};
  if(from>to)return {...base,from:dateKey(from),to:dateKey(to),invalidRange:true,unit:'day',points:[]};
  const days=Math.round((to-from)/DAY)+1,unit=days<=62?'day':days<=186?'week':days<=1098?'month':'year';
  const buckets=new Map();
  for(let ms=startOf(from,unit);ms<=to;ms=next(ms,unit)){
    buckets.set(ms,{key:dateKey(ms),from:dateKey(Math.max(from,ms)),to:dateKey(Math.min(to,next(ms,unit)-DAY)),...empty()});
  }
  for(const row of dated){
    if(row.day<from||row.day>to)continue;
    const point=buckets.get(startOf(row.day,unit)),who=row.bot?'bot':'human';
    point[who+'Wins']++;if(row.forfeit)point[who+'ForfeitWins']++;
  }
  const points=[...buckets.values()].map(complete),totals=empty();
  for(const p of points)for(const key of Object.keys(totals))totals[key]+=p[key];
  return {...base,from:dateKey(from),to:dateKey(to),unit,points,totals:complete(totals)};
}
