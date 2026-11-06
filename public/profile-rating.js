import {profileMatchQuery} from './pagination.js';
import {rankParticipants} from './rating.js';

// One summary supplies both the participant's totals and the full comparison
// group. Match history remains scoped to the exact participant separately.
export function profileSummaryQuery(params){
  const query=profileMatchQuery(params);
  for(const key of ['identity','kind','page','sort_matches','dir_matches'])query.delete(key);
  return query;
}

export function profileStanding(players,name,kind){
  const isBot=kind==='bot',person=players.find(p=>p.name===name&&p.isBot===isBot);
  const raw=isBot?person?.points:person?.performance?.value;
  const value=Number.isFinite(raw)&&(!isBot||person.ratedMatches>0)?raw:null;
  const provisional=!isBot&&value!==null&&person.performance.provisional===true;
  const eligible=players.filter(p=>p.isBot===isBot&&(isBot?
    Number.isFinite(p.points):Number.isFinite(p.performance?.value)&&!p.performance.provisional));
  const ranked=rankParticipants(eligible,'average');
  const index=value!==null&&!provisional?ranked.findIndex(p=>p.name===name):-1;
  return {value,rank:index<0?null:index+1,provisional,games:person?.performance?.games??0};
}
