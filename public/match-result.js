// BotStats policy: an interrupted human-vs-bot game is a technical human loss.
// Scores remain the last recorded scores, even when the human was leading.
export function normalizeMatchResult(match){
  const ps=match.participants;
  if(!Array.isArray(ps)||ps.length!==2||ps.filter(p=>p.isBot===true).length!==1||ps.filter(p=>p.isBot===false).length!==1)return match;
  const bi=ps.findIndex(p=>p.isBot),human=ps[1-bi];
  if(match.status==='interrupted')return {...match,status:'forfeit',winnerIndex:bi,forfeitBy:human.name,resultCorrection:'interrupted_as_forfeit'};
  if(match.status==='forfeit'&&(match.winnerIndex!==bi||match.forfeitBy!==human.name))return {...match,winnerIndex:bi,forfeitBy:human.name,resultCorrection:'forfeit_winner'};
  if(match.status==='completed'&&match.winnerIndex==null&&ps.every(p=>Number.isFinite(p.score))&&ps[0].score!==ps[1].score){
    return {...match,winnerIndex:ps[0].score>ps[1].score?0:1,resultCorrection:'winner_from_score'};
  }
  return match;
}
