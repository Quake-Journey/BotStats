import {botDifficulty,resultKnown} from './rating.js';
import {normalizeMatchResult} from './match-result.js';

// A conservative performance estimate against fixed bot difficulty references.
// Not a sum of rewards and not Elo (opponent ratings never depend on upload order).
export const performancePolicy=Object.freeze({
  version:'human-performance-v2',maximum:100,
  priorDeviation:2,confidenceZ:1.2815515655446004,minimumGames:10,
  resultWeight:.75,minimumSeconds:120,fullWeightSeconds:600
});
const logistic=x=>x>=0?1/(1+Math.exp(-x)):Math.exp(x)/(1+Math.exp(x));

export function humanPerformance(matches){
  const p=performancePolicy,evidence=[];
  for(const raw of matches){
    const m=normalizeMatchResult(raw);
    if(m.status!=='completed'||!resultKnown(m)||m.startObserved===false)continue;
    const seconds=m.durationSeconds??(m.startObserved===true?m.timelineDurationMs/1000:null);
    if(!Number.isFinite(seconds)||seconds<p.minimumSeconds)continue;
    const difficulty=botDifficulty(m);if(!difficulty.known)continue;
    const i=m.participants.findIndex(x=>!x.isBot),human=m.participants[i],bot=m.participants[1-i];
    if(!human||!bot?.isBot||!Number.isFinite(human.score)||!Number.isFinite(bot.score))continue;
    const outcome=m.winnerIndex===null?.5:Number(m.winnerIndex===i);
    const margin=(human.score-bot.score)/(Math.abs(human.score)+Math.abs(bot.score)+2);
    const target=p.resultWeight*outcome+(1-p.resultWeight)*(.5+.5*margin);
    evidence.push({difficulty:Math.log(difficulty.factor),weight:Math.min(1,seconds/p.fullWeightSeconds),target,
      outcome,fragDifference:human.score-bot.score});
  }
  if(!evidence.length)return {value:null,estimate:null,games:0,equivalentGames:0,provisional:true,wins:0,losses:0,draws:0,winRate:null,averageFragDifference:null,averageDifficulty:null};
  const precision=1/(p.priorDeviation*p.priorDeviation);
  const evaluate=theta=>{
    let gradient=-precision*theta,information=precision;
    for(const e of evidence){const expected=logistic(theta-e.difficulty);gradient+=e.weight*(e.target-expected);information+=e.weight*expected*(1-expected);}
    return {gradient,information};
  };
  let theta=0;
  for(let n=0;n<40;n++){
    const {gradient,information}=evaluate(theta),step=Math.max(-1,Math.min(1,gradient/information));
    theta+=step;if(Math.abs(step)<1e-10)break;
  }
  const deviation=1/Math.sqrt(evaluate(theta).information);
  const equivalentGames=evidence.reduce((n,e)=>n+e.weight,0),wins=evidence.filter(e=>e.outcome===1).length;
  // A bounded index, not accumulated reward points or a measured win percentage.
  // Only the display scale changes; evidence, fitting and uncertainty stay the same.
  return {value:p.maximum*logistic(theta-p.confidenceZ*deviation),
    estimate:p.maximum*logistic(theta),games:evidence.length,
    equivalentGames,provisional:evidence.length<p.minimumGames,wins,losses:evidence.filter(e=>e.outcome===0).length,
    draws:evidence.filter(e=>e.outcome===.5).length,winRate:wins/evidence.length*100,
    averageFragDifference:evidence.reduce((n,e)=>n+e.fragDifference,0)/evidence.length,
    averageDifficulty:evidence.reduce((n,e)=>n+e.weight*Math.exp(e.difficulty),0)/equivalentGames};
}
