import {victoryDuration} from '../public/rating.js';
import {normalizeMatchResult} from '../public/match-result.js';

export const BOT_MAP_POOL=Object.freeze(['q2duel5','ztn2dm3','q2duel1','q3t2']);
const award=(id,ru,en,ruleRu,ruleEn)=>({id:'bot-'+id,audience:'bot',name:{ru,en},description:{ru:ruleRu,en:ruleEn},revocable:false,icon:`achievements/bots/${id}.svg`});
const longRu=' Победа без forfeit, матч от 10 минут.',longEn=' Win without a forfeit in a match lasting at least 10 minutes.';
export const BOT_DEFINITIONS=Object.freeze([
  award('skynet','Скайнет','Skynet','Победить человека с преимуществом минимум 50 фрагов.'+longRu,'Beat a human by at least 50 frags.'+longEn),
  award('terminator','Терминатор','Terminator','Выиграть у людей 10 матчей подряд, включая forfeit. Любая длительность. Поражение, ничья или запись без результата прерывают серию.','Win 10 consecutive matches against humans, including forfeits. Any duration. A loss, draw or unconfirmed result breaks the streak.'),
  award('artificial-mind','Искусственный разум','Artificial Mind','Выиграть у людей не менее 10 матчей без forfeit. Любая длительность.','Win at least 10 matches against humans without forfeits. Any duration.'),
  award('meat-factory','Мясной комбинат','Meat Factory','Выиграть 20 матчей с преимуществом минимум 20 фрагов, включая forfeit. Любая длительность; учитывается фактический счёт до сдачи.','Win 20 matches by at least 20 frags, including forfeits. Any duration; forfeits use the actual score before surrender.'),
  award('judgment-day','Судный день','Judgment Day','Победить человека с преимуществом минимум 30 фрагов.'+longRu,'Beat a human by at least 30 frags.'+longEn),
  award('endoskeleton','Эндоскелет','Endoskeleton','Выиграть со счётом 20:0 или выше; у человека ровно 0 фрагов.'+longRu,'Win 20:0 or better, with exactly zero frags for the human.'+longEn),
  award('red-eye','Красный глаз','Red Eye','Точность рейлгана от 60% при минимум 20 выстрелах. Нужны полные счётчики попаданий и выстрелов.'+longRu,'Reach 60% railgun accuracy with at least 20 shots. Requires complete hit and shot counts.'+longEn),
  award('perfect-sight','Без промаха','Perfect Sight','Попасть каждым из минимум 10 выстрелов рейлгана. Нужны полные счётчики попаданий и выстрелов.'+longRu,'Hit every one of at least 10 railgun shots. Requires complete hit and shot counts.'+longEn),
  award('siege-engine','Осадная машина','Siege Engine','Сделать минимум 15 убийств ракетницей. Нужна полная статистика оружия.'+longRu,'Make at least 15 rocket launcher kills. Requires complete weapon statistics.'+longEn),
  award('steel-storm','Стальной ливень','Steel Storm','Нанести минимум 2000 урона чейнганом. Нужна полная статистика оружия.'+longRu,'Deal at least 2,000 chaingun damage. Requires complete weapon statistics.'+longEn),
  award('plasma-core','Плазменное ядро','Plasma Core','Сделать минимум 10 убийств гипербластером. Нужна полная статистика оружия.'+longRu,'Make at least 10 hyperblaster kills. Requires complete weapon statistics.'+longEn),
  award('rail-protocol','Рельсовый протокол','Rail Protocol','На q2duel5 подобрать рейлган минимум 10 раз, не оставив человеку ни одного подбора. Выпавшие пушки тоже считаются. Нужна полная статистика подборов.'+longRu,'On q2duel5, collect at least 10 railguns while the human collects none. Dropped weapons count. Requires complete pickup statistics.'+longEn),
  award('reactor-lock','Реактор под охраной','Reactor Lock','На ztn2dm3 взять минимум 3 меги, не отдав человеку ни одной. Нужна полная статистика подборов.'+longRu,'On ztn2dm3, collect at least 3 Mega Healths while the human collects none. Requires complete pickup statistics.'+longEn),
  award('armour-foundry','Броневой завод','Armour Foundry','Взять минимум 10 красных арморов, человек берёт не больше 2. Нужна полная статистика подборов.'+longRu,'Collect at least 10 Body Armors while the human collects at most 2. Requires complete pickup statistics.'+longEn),
  award('iron-discipline','Железная дисциплина','Iron Discipline','Сделать минимум 30 убийств без единого самоубийства. Нужна полная итоговая статистика.'+longRu,'Make at least 30 kills without a single suicide. Requires complete final statistics.'+longEn),
  award('reboot','Перезагрузка','Reboot','Победить, уступая по ходу матча минимум 10 фрагов. Нужна подтверждённая история счёта.'+longRu,'Win after trailing by at least 10 frags. Requires confirmed score history.'+longEn),
  award('final-directive','Последняя директива','Final Directive','Выиграть 5 матчей в овертайме без forfeit. Основное время каждого — не менее 10 минут.','Win 5 overtime matches without forfeits. Each must have at least 10 minutes of regulation time.'),
  award('all-sectors','Все сектора захвачены','All Sectors Captured','Победить без forfeit на каждой из карт q2duel5, ztn2dm3, q2duel1 и q3t2. Каждый матч от 10 минут.','Win without forfeits on each of q2duel5, ztn2dm3, q2duel1 and q3t2. Each match lasts at least 10 minutes.'),
  award('hunter-net','Охотничья сеть','Hunter Network','Победить 5 людей с разными никами без forfeit. Каждый матч от 10 минут; разные ники не доказывают разные личности.','Beat humans with 5 distinct nicknames without forfeits. Each match lasts at least 10 minutes; distinct nicknames do not prove distinct people.'),
  award('legion','Легион','Legion','Выиграть 100 матчей у людей без forfeit. Каждый матч от 10 минут.','Win 100 matches against humans without forfeits. Each match lasts at least 10 minutes.')
]);

const known=n=>Number.isInteger(n)&&n>=0;
const weapon=(p,name)=>p.stats?.weapons?.find(x=>x.name===name||x.name===({'Rocket Launcher':'R.Launch',Chaingun:'C.Gun',HyperBlaster:'H.Blaster'})[name]);
function pickup(p,name){
  const n=p.stats?.pickups?.find(x=>x.name===name)?.count??weapon(p,name)?.pickups??p.stats?.control?.find(x=>x.name===name)?.pickups;
  return known(n)?n:null;
}
const atLeast=(n,min)=>known(n)&&n>=min;
const validDate=s=>Number.isFinite(Date.parse(s));
const botName=b=>b.profile||b.name.replace(/(?:\[\d+\]|>\d+)$/,'');

// Input is deduplicated and ordered by the existing shared achievement index.
// Separate maps prevent a human nickname equal to a bot profile sharing awards.
export function computeBotAchievements(rows,regulationSeconds){
  rows=rows.map(normalizeMatchResult);
  const bots=new Map();
  // An undated match cannot be placed before or inside a winning streak.
  // Keep ordinary cumulative awards, but do not invent its chronological order.
  const undated=new Set(rows.filter(m=>!validDate(m.startedAt)&&m.participants?.length===2&&m.participants.filter(p=>p.isBot).length===1).map(m=>botName(m.participants.find(p=>p.isBot))));
  for(const m of rows){
    if(m.participants?.length!==2||m.participants.filter(p=>p.isBot).length!==1)continue;
    const bi=m.participants.findIndex(p=>p.isBot),b=m.participants[bi],h=m.participants[1-bi];
    const name=botName(b);if(!name)continue;
    if(!bots.has(name))bots.set(name,{name,kind:'bot',awards:new Map(),buckets:new Map(),maps:new Map(),humans:new Map(),streak:[]});
    const p=bots.get(name),timed=validDate(m.startedAt);
    const grant=(id,evidence,metric=evidence.length)=>{id='bot-'+id;if(!p.awards.has(id))p.awards.set(id,{id,evidence:[...evidence],metric,
      earnedAt:timed?new Date(Date.parse(m.startedAt)+(m.recordedSeconds??m.durationSeconds??0)*1000).toISOString():null});};
    const count=(id,n)=>{const ids=p.buckets.get(id)||[];ids.push(m.id);p.buckets.set(id,ids);if(ids.length>=n)grant(id,ids.slice(0,n),n);};
    const confirmed=!m.ratingExcluded&&['completed','forfeit'].includes(m.status)&&m.winnerIndex===bi;
    if(!confirmed){p.streak=[];continue;}
    if(timed&&!undated.has(name)){p.streak.push(m.id);if(p.streak.length>=10)grant('terminator',p.streak.slice(0,10),10);}else p.streak=[];
    const scores=Number.isInteger(b.score)&&Number.isInteger(h.score),margin=scores?b.score-h.score:null;
    if(margin!==null&&margin>=20)count('meat-factory',20);
    if(m.status==='forfeit')continue;
    count('artificial-mind',10);
    const duration=victoryDuration(m),long=duration.known&&duration.seconds>=600;
    if(!long)continue;
    if(margin>=50)grant('skynet',[m.id],margin);
    if(margin>=30)grant('judgment-day',[m.id],margin);
    if(scores&&h.score===0&&b.score>=20)grant('endoskeleton',[m.id],b.score);
    if(m.statsComplete&&b.stats){
      const rail=weapon(b,'Railgun');
      if(known(rail?.hits)&&known(rail?.shots)&&rail.shots>=20&&rail.hits<=rail.shots&&rail.hits*5>=rail.shots*3)grant('red-eye',[m.id]);
      if(known(rail?.hits)&&known(rail?.shots)&&rail.shots>=10&&rail.hits===rail.shots)grant('perfect-sight',[m.id]);
      if(atLeast(weapon(b,'Rocket Launcher')?.kills,15))grant('siege-engine',[m.id]);
      if(atLeast(weapon(b,'Chaingun')?.damageDealt,2000))grant('steel-storm',[m.id]);
      if(atLeast(weapon(b,'HyperBlaster')?.kills,10))grant('plasma-core',[m.id]);
      if(atLeast(b.stats.kills,30)&&b.stats.suicides===0)grant('iron-discipline',[m.id]);
      if(h.stats){
        if(m.map==='q2duel5'&&pickup(b,'Railgun')>=10&&pickup(h,'Railgun')===0)grant('rail-protocol',[m.id]);
        if(m.map==='ztn2dm3'&&pickup(b,'Mega Health')>=3&&pickup(h,'Mega Health')===0)grant('reactor-lock',[m.id]);
        const red=pickup(h,'Body Armor');if(pickup(b,'Body Armor')>=10&&red!==null&&red<=2)grant('armour-foundry',[m.id]);
      }
    }
    if((m.scoreHistory||[]).some(x=>Number.isFinite(x.timeMs)&&x.timeMs>=0&&x.timeMs<=duration.seconds*1000&&x.scores?.length===2&&x.scores.every(Number.isInteger)&&x.scores[1-bi]-x.scores[bi]>=10))grant('reboot',[m.id]);
    if(m.overtime&&regulationSeconds(m)>=600)count('final-directive',5);
    if(BOT_MAP_POOL.includes(m.map)&&!p.maps.has(m.map))p.maps.set(m.map,m.id);
    if(BOT_MAP_POOL.every(map=>p.maps.has(map)))grant('all-sectors',BOT_MAP_POOL.map(map=>p.maps.get(map)),4);
    if(h.name&&!p.humans.has(h.name))p.humans.set(h.name,m.id);
    if(p.humans.size>=5)grant('hunter-net',[...p.humans.values()].slice(0,5),5);
    count('legion',100);
  }
  return bots;
}
