import {resultKnown,botDifficulty} from '../public/rating.js';

// Inputs already obey the same period/map/settings filters as the match list.
// Group by bot profile (not the skill suffix), and keep exact human nicknames.
export function buildBotVictims(matches){
  const pairs=new Map(),seen=new Set();
  for(const m of matches){
    if(m.id&&seen.has(m.id))continue;
    if(m.id)seen.add(m.id);
    if(!resultKnown(m)||m.participants?.length!==2)continue;
    const bi=m.participants.findIndex(p=>p.isBot===true);
    if(bi<0||m.participants[1-bi].isBot!==false)continue;
    if(m.winnerIndex!==null&&![0,1].includes(m.winnerIndex))continue;
    const b=m.participants[bi],h=m.participants[1-bi];
    const bot=b.profile||b.name.replace(/(?:\[\d+\]|>\d+)$/,''),human=h.name;
    const key=JSON.stringify([bot,human]);
    if(!pairs.has(key))pairs.set(key,{bot,human,matches:0,botWins:0,forfeitWins:0,lastBotWinAt:null,lastBotWinMatchId:null,botScore:0,humanScore:0,scoredMatches:0,skillSeconds:0,weightedSkill:0,skillMatches:0});
    const pair=pairs.get(key);pair.matches++;
    if(Number.isFinite(b.score)&&Number.isFinite(h.score)){
      pair.botScore+=b.score;pair.humanScore+=h.score;pair.scoredMatches++;
    }
    if(m.winnerIndex===bi){
      pair.botWins++;if(m.status==='forfeit')pair.forfeitWins++;
      const difficulty=botDifficulty(m),seconds=m.durationSeconds??(m.startObserved===true?m.timelineDurationMs/1000:null);
      if(difficulty.known&&Number.isFinite(seconds)&&seconds>0){
        pair.skillSeconds+=seconds;pair.weightedSkill+=difficulty.averageSkill*seconds;pair.skillMatches++;
      }
      // Use the match date, consistently with the match list and player profile.
      const ms=Date.parse(m.startedAt),date=Number.isFinite(ms)?new Date(ms).toISOString():null;
      if(date&&(!pair.lastBotWinAt||date>pair.lastBotWinAt||(date===pair.lastBotWinAt&&String(m.id||'')>String(pair.lastBotWinMatchId||'')))){
        pair.lastBotWinAt=date;pair.lastBotWinMatchId=m.id||null;
      }
    }
  }
  const items=[...pairs.values()].filter(p=>p.botWins>0).map(p=>({
    bot:p.bot,human:p.human,matches:p.matches,botWins:p.botWins,forfeitWins:p.forfeitWins,
    botWinPercent:100*p.botWins/p.matches,lastBotWinAt:p.lastBotWinAt,lastBotWinMatchId:p.lastBotWinMatchId,scoredMatches:p.scoredMatches,
    averageBotFrags:p.scoredMatches?p.botScore/p.scoredMatches:null,
    averageBotSkill:p.skillSeconds?p.weightedSkill/p.skillSeconds:null,botSkillMatches:p.skillMatches,
    averageHumanFrags:p.scoredMatches?p.humanScore/p.scoredMatches:null
  })).sort((a,b)=>b.botWins-a.botWins||b.botWinPercent-a.botWinPercent||a.bot.localeCompare(b.bot)||a.human.localeCompare(b.human));
  return {items,total:items.length};
}
