import {normalizeMatchResult} from '../public/match-result.js';

// Home needs counts and participants, not rating calculations or gameplay data.
export const homeProjection={_id:0,id:1,status:1,winnerIndex:1,ratingExcluded:1,startedAt:1,durationSeconds:1,recordedSeconds:1,statsComplete:1,'participants.name':1,'participants.profile':1,'participants.isBot':1};
export function buildHome(raw,now=new Date()){
  const players=new Map();let humanWins=0,botWins=0,seconds=0,fullStats=0,lastHumanWinAt=null,lastBotWinAt=null;
  for(const source of raw){
    const m=normalizeMatchResult(source),ps=m.participants||[],date=typeof m.startedAt==='string'&&Number.isFinite(Date.parse(m.startedAt))?new Date(m.startedAt).toISOString():null;
    const duration=m.durationSeconds??m.recordedSeconds;if(Number.isFinite(duration)&&duration>=0)seconds+=duration;
    if(m.statsComplete)fullStats++;
    const known=!m.ratingExcluded&&['completed','forfeit'].includes(m.status)&&[0,1].includes(m.winnerIndex);
    for(const [i,p] of ps.entries()){
      const name=p.isBot?(p.profile||p.name):p.name,key=JSON.stringify([Boolean(p.isBot),name]);
      if(!players.has(key))players.set(key,{name,isBot:Boolean(p.isBot),matches:0,wins:0,lastWinAt:null,lastGameAt:null});
      const entry=players.get(key);entry.matches++;
      if(date&&(!entry.lastGameAt||date>entry.lastGameAt))entry.lastGameAt=date;
      if(!known||m.winnerIndex!==i)continue;
      entry.wins++;if(date&&(!entry.lastWinAt||date>entry.lastWinAt))entry.lastWinAt=date;
      if(p.isBot){botWins++;if(date&&(!lastBotWinAt||date>lastBotWinAt))lastBotWinAt=date;}
      else{humanWins++;if(date&&(!lastHumanWinAt||date>lastHumanWinAt))lastHumanWinAt=date;}
    }
  }
  const ordered=[...players.values()].sort((a,b)=>b.wins-a.wins||b.matches-a.matches||a.name.localeCompare(b.name,'en'));
  return {matches:raw.length,minutes:Math.round(seconds/60),fullStats,humanWins,botWins,lastHumanWinAt,lastBotWinAt,uniqueHumans:ordered.filter(p=>!p.isBot).length,players:ordered,asOf:now.toISOString()};
}
