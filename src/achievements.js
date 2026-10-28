import {botDifficulty,victoryDuration} from '../public/rating.js';
import {normalizeMatchResult} from '../public/match-result.js';
import {sortRows} from '../public/sort.js';
import {BOT_DEFINITIONS,computeBotAchievements} from './bot-achievements.js';

export const MAP_POOL=Object.freeze(['q2duel5','ztn2dm3','q3t2']);
export const ACHIEVEMENT_VERSION='achievements-v3-bots';
const definition=(id,ru,en,ruleRu,ruleEn,revocable=false)=>({id,name:{ru,en},description:{ru:ruleRu,en:ruleEn},revocable,icon:`achievements/${id}.webp`});
// Kept on the server: the public catalog contains only unlocked achievements.
export const DEFINITIONS=[
  definition('death-breath','Дуновение смерти',"Death’s Breath",'Победить бота со скиллом 200+ со счётом 20:0 или выше. У бота ровно 0 фрагов. Без forfeit.','Beat a skill 200+ bot 20:0 or better, with exactly zero frags for the bot. No forfeits.'),
  definition('immortal','Бессмертный','Immortal','Победить бота со скиллом 200+ со счётом от 10:0 до 19:0. Без forfeit.','Beat a skill 200+ bot with a score from 10:0 to 19:0. No forfeits.'),
  definition('strategist','Стратег','Strategist','Выиграть минимум 5 матчей в овертайме. Основное время каждого — не менее 10 минут. Любой скилл, без forfeit.','Win at least 5 overtime matches with at least 10 minutes of regulation time each. Any skill; no forfeits.'),
  definition('explorer','Исследователь','Explorer','Получить минимум 10 технических поражений (forfeit) против ботов любого скилла.','Receive at least 10 forfeit losses against bots of any skill.'),
  definition('universal-soldier','Универсальный солдат','Universal Soldier','Завершить минимум по 10 матчей на q2duel5, ztn2dm3 и q3t2. Любой скилл, без forfeit.','Complete at least 10 matches on each of q2duel5, ztn2dm3 and q3t2. Any skill; no forfeits.'),
  definition('punching-bag','Груша для бота',"Bot’s Punching Bag",'В матчах с основным временем 10 минут иметь минимум на 10 поражений больше, чем побед. Ничьи и forfeit не учитываются. Награда снимается при балансе ниже 10 и возвращается при его восстановлении.','Have at least 10 more losses than wins in matches with 10 minutes of regulation time. Draws and forfeits do not count. Revoked below that balance and restored when it returns.',true),
  definition('diplomacy','Дипломатия','Diplomacy','Завершить минимум 10 матчей с разницей ровно в 1 фраг. Победы и поражения, любой скилл; без forfeit.','Complete at least 10 matches decided by exactly one frag. Wins and losses, any skill; no forfeits.'),
  definition('human-cannon','Человек-пушка','Human Cannon','В каждом из минимум 15 матчей убить бота со скиллом 200+ не менее 15 раз. Считаются убийства, а не итоговые очки. Без forfeit.','Kill a skill 200+ bot at least 15 times in each of at least 15 matches. Actual kills, not net score; no forfeits.'),
  definition('i-can-win','I can win','I can win','Минимум 15 раз победить бота со скиллом ниже 100 в матчах длительностью от 10 минут. Без forfeit.','Win at least 15 matches lasting 10 minutes or more against bots below skill 100. No forfeits.'),
  definition('farm-owner','Хозяин фермы','Farm Owner','Завершить минимум 100 матчей с ботами любых скиллов. Без forfeit.','Complete at least 100 matches against bots of any skill. No forfeits.'),
  definition('cowboy','Ковбой','Cowboy','Выиграть 5 матчей подряд у ботов со скиллом 200+, с основным временем от 10 минут. Forfeit пропускаются; другой завершённый матч или прерванная запись прерывают серию.','Win 5 consecutive matches against skill 200+ bots with at least 10 minutes of regulation time. Forfeits are skipped; any other completed match or interrupted recording breaks the streak.'),
  definition('comeback','Не дождётесь','Not Today','Победить бота со скиллом 200+, уступая по ходу матча минимум 10 фрагов. Длительность от 10 минут, без forfeit.','Beat a skill 200+ bot after trailing by at least 10 frags. Match duration at least 10 minutes; no forfeits.'),
  definition('revenge','Реванш','Revenge','После поражения с разницей от 20 фрагов выиграть следующий завершённый матч против того же бота на той же карте. Скилл не ниже прежнего; оба матча от 10 минут. Forfeit пропускаются.','After losing by at least 20 frags, win the next completed match against the same bot on the same map at no lower skill. Both matches last at least 10 minutes. Forfeits are skipped.'),
  definition('head-hunter','Охотник за головами','Head Hunter','Победить 5 разных бот-персонажей со скиллом 200+. Каждый матч от 10 минут, без forfeit.','Beat 5 distinct bot characters at skill 200+. Each match lasts at least 10 minutes; no forfeits.'),
  definition('three-crowns','Три короны','Three Crowns','Победить бота со скиллом 200+ на каждой из карт q2duel5, ztn2dm3 и q3t2. Каждый матч от 10 минут, без forfeit.','Beat a skill 200+ bot on each of q2duel5, ztn2dm3 and q3t2. Each match lasts at least 10 minutes; no forfeits.'),
  definition('one-shot','Один выстрел — целая жизнь','One Shot, One Life','Выиграть 1:0 в Sudden Death после минимум 10 минут основного времени, завершившегося 0:0. Без forfeit.','Win 1:0 in Sudden Death after at least 10 minutes of regulation ending 0:0. No forfeits.'),
  definition('resort-closed','Курорт закрыт','Resort Closed','Победить на ztn2dm3, забрав минимум 3 меги и не отдав боту ни одной. Нужна полная статистика подборов; без forfeit.','Win on ztn2dm3, collecting at least 3 Mega Healths while the bot collects none. Requires complete pickup statistics; no forfeits.'),
  definition('negative-intelligence','Отрицательный интеллект','Negative Intelligence','Выиграть десятиминутный матч: у человека минимум 10 фрагов, у бота отрицательный итоговый счёт. Скилл бота ровно 200 и не менялся весь матч. Без овертайма и forfeit.','Win a ten-minute match with at least 10 frags while the bot finishes below zero. Bot skill must stay exactly 200 throughout. No overtime or forfeits.'),
  definition('god-slayer','Убийца богов','God Slayer','Победить GOD-X со скиллом 250 с перевесом минимум 15 фрагов. Матч от 10 минут, скилл неизменен, без forfeit.','Beat GOD-X at skill 250 by at least 15 frags. Match lasts at least 10 minutes; unchanged skill, no forfeits.'),
  definition('old-school','Олдскул','Old School','Победить бота со скиллом 200+, набрав минимум 10 фрагов и ни разу не выстрелив из рейлгана. Матч от 10 минут, скилл неизменен, без forfeit. Нужна полная статистика выстрелов.','Beat a skill 200+ bot with at least 10 frags without firing the railgun. Match lasts at least 10 minutes; unchanged skill, no forfeits. Requires complete shot statistics.'),
  definition('surgeon','Хирург','Surgeon','Победить бота со скиллом 200+ с точностью рейлгана от 50% при минимум 15 выстрелах. Матч от 10 минут, скилл неизменен, без forfeit. Точность считается по попаданиям и выстрелам без округления.','Beat a skill 200+ bot with at least 50% railgun accuracy from at least 15 shots. Match lasts at least 10 minutes; unchanged skill, no forfeits. Accuracy uses unrounded hits and shots.'),
  definition('rail-monopoly','Рельса приватизирована','Rail Monopoly','Победить на q2duel5 бота со скиллом 200+, подобрав рейлган минимум 10 раз, а бот — ни разу. Учитываются и выпавшие рейлганы. Матч от 10 минут, скилл неизменен, без forfeit. Нужна полная статистика подборов.','Beat a skill 200+ bot on q2duel5, collecting the railgun at least 10 times while the bot collects none, including dropped railguns. Match lasts at least 10 minutes; unchanged skill, no forfeits. Requires complete pickup statistics.'),
  definition('personal-space','Личное пространство','Personal Space','Победить бота со скиллом 200+ и сделать минимум 3 телефрага за матч. Матч от 10 минут, скилл неизменен, без forfeit. Нужна полная итоговая статистика.','Beat a skill 200+ bot and score at least 3 telefrags in the match. Match lasts at least 10 minutes; unchanged skill, no forfeits. Requires complete final statistics.'),
  definition('last-minute','Последняя минута','The Last Minute','За минуту до конца основного времени уступать боту минимум 5 фрагов, но победить до овертайма. Скилл бота 200+, матч от 10 минут, скилл неизменен, без forfeit. Нужна история счёта.','Trail a skill 200+ bot by at least 5 frags with one minute of regulation left, then win without overtime. Match lasts at least 10 minutes; unchanged skill, no forfeits. Requires score history.')
];

export function regulationSeconds(m){
  if(m.startObserved===false)return null;
  if(Number.isFinite(m.regulationSeconds))return m.regulationSeconds;
  if(m.overtime||m.overtimePlayed){
    const periods=(m.overtimePeriods||[]).filter(p=>Number.isFinite(p.fromMs)&&p.fromMs>=0);
    // A frame can straddle 10:00. Only the first OT transition counts; later
    // extensions must never turn a short regulation into a ten-minute game.
    return periods.length?Math.round(Math.min(...periods.map(p=>p.fromMs))/1000):null;
  }
  const duration=victoryDuration(m);return duration.known?Math.round(duration.seconds):null;
}
function skillRange(m){
  const d=botDifficulty(m);if(!d.known)return null;
  const values=d.intervals.length?d.intervals.map(x=>x.value):[d.averageSkill];
  return {min:Math.min(...values),max:Math.max(...values)};
}
function fullSeconds(m){const d=victoryDuration(m);return d.known?d.seconds:null;}
function mega(p){return p.stats?.control?.find(x=>x.name==='Mega Health')?.pickups??p.stats?.pickups?.find(x=>x.name==='Mega Health')?.count??0;}
const countKnown=n=>Number.isInteger(n)&&n>=0;
const rail=p=>p.stats?.weapons?.find(x=>x.name==='Railgun');
function railPickups(p){const n=p.stats?.pickups?.find(x=>x.name==='Railgun')?.count??rail(p)?.pickups;return countKnown(n)?n:null;}
function scoreWithMinuteLeft(m,regulation){
  const cutoff=regulation*1000-60000;
  const history=(m.scoreHistory||[]).filter(x=>Number.isFinite(x.timeMs)&&x.timeMs>=0&&x.scores?.length===2&&x.scores.every(Number.isInteger)).sort((a,b)=>a.timeMs-b.timeMs);
  if(!history.some(x=>x.timeMs>cutoff))return null;
  return history.filter(x=>x.timeMs<=cutoff).at(-1)?.scores??null;
}
const dateValue=m=>Number.isFinite(Date.parse(m.startedAt))?Date.parse(m.startedAt):Infinity;
const evidenceDate=m=>Number.isFinite(Date.parse(m.startedAt))?new Date(Date.parse(m.startedAt)+(m.recordedSeconds??m.durationSeconds??0)*1000).toISOString():null;

export function computeAchievements(input){
  input=input.map(normalizeMatchResult);
  const rows=[...new Map(input.filter(m=>m.id).map(m=>[m.id,m])).values()].sort((a,b)=>dateValue(a)-dateValue(b)||a.id.localeCompare(b.id));
  const players=new Map(),matches=new Map();
  for(const m of rows){
    if(m.participants?.length!==2||m.participants.filter(p=>p.isBot).length!==1)continue;
    const hi=m.participants.findIndex(p=>!p.isBot),h=m.participants[hi],b=m.participants[1-hi];
    if(!players.has(h.name))players.set(h.name,{name:h.name,awards:new Map(),buckets:new Map(),maps:new Map(),crowns:new Map(),heads:new Map(),streak:[],previous:null,losses:[],wins:[]});
    const p=players.get(h.name);
    matches.set(m.id,{id:m.id,map:m.map,startedAt:m.startedAt,status:m.status,durationSeconds:m.durationSeconds,modes:m.modes,human:h.name,bot:b.name,score:[h.score,b.score]});
    const grant=(id,evidence,metric=evidence.length)=>{if(!p.awards.has(id))p.awards.set(id,{id,earnedAt:evidenceDate(m),evidence:[...evidence],metric});};
    const count=(id,n)=>{const ids=p.buckets.get(id)||[];ids.push(m.id);p.buckets.set(id,ids);if(ids.length>=n)grant(id,ids.slice(0,n),n);};
    if(m.ratingExcluded){p.streak=[];p.previous=null;continue;}
    if(m.status==='forfeit'){
      if(m.winnerIndex===1-hi||m.forfeitBy===h.name)count('explorer',10);
      continue;
    }
    if(m.status!=='completed'){p.streak=[];p.previous=null;continue;}
    const won=m.winnerIndex===hi,lost=m.winnerIndex===1-hi;
    const range=skillRange(m),strong=range&&range.min>=200,seconds=fullSeconds(m),long=seconds!==null&&seconds>=600;
    const regulation=regulationSeconds(m),regLong=regulation!==null&&regulation>=600;
    const timed=Number.isFinite(Date.parse(m.startedAt));
    const fixed=range&&range.min===range.max&&!b.skillVariable;
    if(won&&fixed&&strong&&long){
      const noOvertime=!m.overtime&&!m.overtimePlayed;
      if(range.min===200&&Math.round(seconds)===600&&noOvertime&&h.score>=10&&b.score<0)grant('negative-intelligence',[m.id]);
      if(/^god(?:-x)?$/i.test(b.profile||b.name.replace(/(?:\[\d+\]|>\d+)$/,''))&&range.min===250&&h.score-b.score>=15)grant('god-slayer',[m.id]);
      if(m.statsComplete&&h.stats){
        const weapon=rail(h);
        if(h.score>=10&&weapon?.shots===0)grant('old-school',[m.id]);
        if(countKnown(weapon?.hits)&&countKnown(weapon?.shots)&&weapon.shots>=15&&weapon.hits*2>=weapon.shots)grant('surgeon',[m.id]);
        if(m.map==='q2duel5'&&b.stats&&railPickups(h)>=10&&railPickups(b)===0)grant('rail-monopoly',[m.id]);
        if(countKnown(h.stats.telefrags)&&h.stats.telefrags>=3)grant('personal-space',[m.id]);
      }
      const minuteScore=noOvertime&&regLong?scoreWithMinuteLeft(m,regulation):null;
      if(minuteScore&&minuteScore[1-hi]-minuteScore[hi]>=5)grant('last-minute',[m.id]);
    }
    if(won&&strong&&b.score===0){if(h.score>=20)grant('death-breath',[m.id]);else if(h.score>=10&&h.score<=19)grant('immortal',[m.id]);}
    if(won&&m.overtime&&regLong)count('strategist',5);
    if(MAP_POOL.includes(m.map)){const ids=p.maps.get(m.map)||[];ids.push(m.id);p.maps.set(m.map,ids);if(MAP_POOL.every(map=>(p.maps.get(map)?.length||0)>=10))grant('universal-soldier',MAP_POOL.flatMap(map=>p.maps.get(map).slice(0,10)),30);}
    if(regulation===600){if(lost)p.losses.push(m.id);if(won)p.wins.push(m.id);}
    if(Math.abs(h.score-b.score)===1)count('diplomacy',10);
    if(strong&&Number.isInteger(h.stats?.kills)&&h.stats.kills>=15)count('human-cannon',15);
    if(won&&range&&range.max<100&&long)count('i-can-win',15);
    count('farm-owner',100);
    if(won&&strong&&regLong&&timed){p.streak.push(m.id);if(p.streak.length>=5)grant('cowboy',p.streak.slice(0,5),5);}else p.streak=[];
    if(won&&strong&&long&&(m.scoreHistory||[]).some(x=>x.scores?.[1-hi]-x.scores?.[hi]>=10))grant('comeback',[m.id]);
    const prev=p.previous;
    if(won&&timed&&long&&range&&b.profile&&prev?.lost&&prev.long&&prev.range&&prev.margin>=20&&prev.profile===b.profile&&prev.map===m.map&&range.min>=prev.range.max)grant('revenge',[prev.id,m.id]);
    p.previous=timed?{id:m.id,lost,long,range,margin:b.score-h.score,profile:b.profile,map:m.map}:null;
    if(won&&strong&&long){
      if(b.profile&&!p.heads.has(b.profile))p.heads.set(b.profile,m.id);
      if(p.heads.size>=5)grant('head-hunter',[...p.heads.values()].slice(0,5),5);
      if(MAP_POOL.includes(m.map)&&!p.crowns.has(m.map))p.crowns.set(m.map,m.id);
      if(MAP_POOL.every(map=>p.crowns.has(map)))grant('three-crowns',MAP_POOL.map(map=>p.crowns.get(map)),3);
    }
    if(won&&m.overtimeKind==='sudden_death'&&regLong&&h.score===1&&b.score===0){
      const boundary=Math.min(...(m.overtimePeriods||[]).map(x=>x.fromMs));
      const last=(m.scoreHistory||[]).filter(x=>x.timeMs<=boundary).at(-1);
      if(last&&last.scores.every(x=>x===0))grant('one-shot',[m.id]);
    }
    if(won&&m.map==='ztn2dm3'&&m.statsComplete&&h.stats&&b.stats&&mega(h)>=3&&mega(b)===0)grant('resort-closed',[m.id]);
    const balance=p.losses.length-p.wins.length;
    if(balance>=10){
      grant('punching-bag',[...p.losses,...p.wins],balance);
      Object.assign(p.awards.get('punching-bag'),{evidence:[...p.losses,...p.wins],metric:balance,losses:p.losses.length,wins:p.wins.length});
    }else p.awards.delete('punching-bag');
  }
  return {players,bots:computeBotAchievements(rows,regulationSeconds),matches};
}

export function publicAchievements(index){
  const items=[...DEFINITIONS,...BOT_DEFINITIONS].map(d=>({...d,holders:[...(d.audience==='bot'?index.bots:index.players).values()].filter(p=>p.awards.has(d.id)).map(p=>{
    const a=p.awards.get(d.id);return {name:p.name,kind:d.audience==='bot'?'bot':'human',earnedAt:a.earnedAt,metric:a.metric,losses:a.losses,wins:a.wins};
  }).sort((a,b)=>(a.earnedAt||'9999').localeCompare(b.earnedAt||'9999')||a.name.localeCompare(b.name))})).filter(d=>d.holders.length);
  return {version:ACHIEVEMENT_VERSION,mapPool:MAP_POOL,items};
}

export function achievementDetail(index,id,query={}){
  const achievement=publicAchievements(index).items.find(x=>x.id===id);if(!achievement)return null;
  const name=String(query.player||''),award=(achievement.audience==='bot'?index.bots:index.players).get(name)?.awards.get(id);
  const limit=20;
  const ids=award?.evidence||[];
  const columns={date:m=>m.startedAt,map:m=>m.map,bot:m=>achievement.audience==='bot'?m.human:m.bot,score:m=>m.score,duration:m=>m.durationSeconds};
  const key=Object.hasOwn(columns,query.sort_award_evidence)?query.sort_award_evidence:'date';
  const direction=query.dir_award_evidence==='desc'?'desc':'asc';
  const evidence=sortRows(ids.map(x=>index.matches.get(x)),columns[key],direction,query.lang==='en'?'en':'ru');
  const pages=Math.ceil(ids.length/limit),page=Math.min(Math.max(1,Math.floor(Number(query.page)||1)),Math.max(1,pages));
  return {...achievement,evidence:award?{player:name,total:ids.length,page,pages,matches:evidence.slice((page-1)*limit,page*limit)}:null};
}
