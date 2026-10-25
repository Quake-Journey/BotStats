import {playersPage} from './players-ui.js';
import {performancePolicy} from './performance-rating.js';
import {createNavigation} from './navigation.js';
import {aboutPage} from './about.js';
import {dynamicsPage,mountDynamics} from './dynamics-ui.js';
import {winsWithHistory} from './win-history.js';
import {achievementBadges,achievementProfile,achievementsPage,achievementPage,mountAchievementBadges} from './achievements-ui.js';
let awardCatalog={items:[]};
import {completeScoreHistory,scoreAxis} from './score-history.js';
import {renderTable,sortState,sortButton} from './tables.js';
import {ratingPolicy,matchPoints,victoryPoints,victoryDuration,botDifficulty,botLossPenalty,botWinAward,rankParticipants,rankMaps} from './rating.js';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const currentPath=location.pathname.replace(/\/$/,''),base=currentPath.endsWith('/about')?currentPath.slice(0,-6):currentPath,params=new URLSearchParams(location.search);
if(currentPath.endsWith('/about'))params.set('view','about');
let lang=window.botstatsLang||'ru',theme=window.botstatsTheme||'auto',facets={},view=params.get('view')||'rating',selectedWeaponPlayer=Number(params.get('weapon'))===1?1:0;
const dict={
ru:{mainSite:'Основной сайт ↗',theme:'Тема',auto:'Системная',dark:'Тёмная',light:'Светлая',footer:'Реальные матчи. Статистика из MVD.',eyebrow:'Человек против бота',title:'Каждый матч.<br><span>В деталях.</span>',intro:'Кто точнее стрелял, кто забирал броню и как менялся счёт. Вся история противостояния с ботами Q2PRO-X.',latest:'Последний матч',matches:'Матчи',players:'Игроки',bots:'Боты',allMatches:'Всего матчей',humanWins:'Победы людей',botWins:'Победы ботов',gameTime:'Время в игре',minutes:'мин',finished:'завершённых',interruptedShort:'прервано',results:'матчей',all:'Все',search:'Игрок или бот',searchHint:'Ник, например q или David…',map:'Карта',bot:'Бот',style:'Стиль',skill:'Скилл',version:'Версия мода',status:'Результат',from:'С даты',to:'По дату',moreFilters:'Скилл, версия, даты и результат',reset:'Сбросить',copy:'Скопировать ссылку',copied:'Скопировано',apply:'Найти',match:'Матч',date:'Дата',duration:'Длительность',completed:'Завершён',forfeit:'Forfeit',interrupted:'Прерван',variable:'Переменный',empty:'По этим условиям матчей пока нет.',error:'Не удалось загрузить статистику.',retry:'Повторить',back:'← Все матчи',download:'↓ Скачать MVD',human:'Игрок',botType:'Бот',scoreProgress:'Как менялся счёт',comparison:'Итоги матча',damage:'Нанесённый урон',received:'Полученный урон',kills:'Убийства',deaths:'Смерти',suicides:'Самоубийства',telefrags:'Телефраги',weapons:'Оружие',accuracy:'Точность',hits:'Попадания / выстрелы',items:'Подборы предметов',control:'Контроль главных предметов',events:'События матча',settings:'Настройки бота по ходу матча',ping:'Средний пинг',pingNote:'По записям таблицы счёта; одно значение учитывается не дольше 5 секунд. Это не непрерывный сетевой замер.',observed:'наблюдений',coverage:'сек. наблюдения',noStats:'Подробная итоговая статистика урона, оружия и подборов в этой записи отсутствует или неполна. Это не мешает учитывать подтверждённый результат и рейтинг при достаточных данных для расчёта.',partial:'Начало матча в записи не подтверждено. Указана длительность записанного фрагмента.',interruptedNote:'Матч прерван. Показан последний зафиксированный счёт; победа по нему автоматически не начисляется.',noVersion:'Версия не записана',serverTime:'Время сервера · МСК',ratingNote:'Сортировка по победам. Процент побед — только по завершённым матчам. Прерванные игры сохраняются отдельно; очки Competition не применяются.',wins:'Победы',losses:'Поражения',winRate:'Победы, %',averageScore:'Средний счёт',averageDamage:'Средний урон',details:'Открыть матч',prev:'← Назад',next:'Далее →',page:'Страница',of:'из',unknown:'Нет данных',player:'Участник',fullStats:'с полной статистикой',itemsNote:'Количество фактических подборов, включая выпавшие предметы. Контроль — счётчики подбора предметов карты.',damageNote:'Полученный урон включает урон от собственных выстрелов по правилам серверной статистики.',skillTimeline:'Скилл',styleTimeline:'Изменения стиля',recorded:'записанный фрагмент',rawEvents:'Сообщения сервера приведены в оригинале.',allMaps:'Все карты',matchCount:'Матчей',showProfile:'Матчи участника',noPing:'Пинг не записан',loading:'Загрузка матчей…',json:'Скачать JSON',rounds:'За выбранный период'},
en:{mainSite:'Main website ↗',theme:'Theme',auto:'System',dark:'Dark',light:'Light',footer:'Real matches. Statistics from MVD.',eyebrow:'Human versus bot',title:'Every match.<br><span>Every detail.</span>',intro:'Accuracy, armor control and every turn of the score. Explore your matches against Q2PRO-X bots.',latest:'Latest match',matches:'Matches',players:'Players',bots:'Bots',allMatches:'Total matches',humanWins:'Human wins',botWins:'Bot wins',gameTime:'Time played',minutes:'min',finished:'finished',interruptedShort:'interrupted',results:'matches',all:'All',search:'Player or bot',searchHint:'Nickname, e.g. q or David…',map:'Map',bot:'Bot',style:'Style',skill:'Skill',version:'Mod version',status:'Result',from:'From date',to:'To date',moreFilters:'Skill, version, dates and result',reset:'Reset',copy:'Copy link',copied:'Copied',apply:'Search',match:'Match',date:'Date',duration:'Duration',completed:'Finished',forfeit:'Forfeit',interrupted:'Interrupted',variable:'Variable',empty:'No matches match these filters yet.',error:'Could not load statistics.',retry:'Retry',back:'← All matches',download:'↓ Download MVD',human:'Player',botType:'Bot',scoreProgress:'Score over time',comparison:'Match summary',damage:'Damage dealt',received:'Damage received',kills:'Kills',deaths:'Deaths',suicides:'Suicides',telefrags:'Telefrags',weapons:'Weapons',accuracy:'Accuracy',hits:'Hits / shots',items:'Item pickups',control:'Major item control',events:'Match events',settings:'Bot settings throughout the match',ping:'Average ping',pingNote:'From scoreboard observations; a value is held for at most 5 seconds. This is not a continuous network measurement.',observed:'observations',coverage:'seconds observed',noStats:'Detailed final damage, weapon and pickup statistics are missing or incomplete in this recording. A confirmed result can still count towards ratings when the required scoring data is available.',partial:'The start of this match is not confirmed in the recording. Duration refers to the recorded fragment.',interruptedNote:'The match was interrupted. This is the last recorded score; it does not automatically count as a win.',noVersion:'Version not recorded',serverTime:'Server time · MSK',ratingNote:'Sorted by wins. Win rate uses finished matches only. Interrupted matches are retained separately; Competition points are not applied.',wins:'Wins',losses:'Losses',winRate:'Win rate, %',averageScore:'Average score',averageDamage:'Average damage',details:'Open match',prev:'← Previous',next:'Next →',page:'Page',of:'of',unknown:'Unavailable',player:'Participant',fullStats:'with full stats',itemsNote:'Actual pickup counts, including dropped items. Control uses the server counters for map items.',damageNote:'Received damage includes self-damage, following the server statistics.',skillTimeline:'Skill',styleTimeline:'Style changes',recorded:'recorded fragment',rawEvents:'Server messages are shown in their original language.',allMaps:'All maps',matchCount:'Matches',showProfile:'Participant matches',noPing:'Ping not recorded',loading:'Loading matches…',json:'Download JSON',rounds:'For the selected period'}
};
Object.assign(dict.ru,{interrupted:'Нет результата',interruptedNote:'По правилу BotStats прерванная игра человека с ботом считается forfeit: техническое поражение человека и победа бота независимо от счёта.'});
Object.assign(dict.en,{interrupted:'No result',interruptedNote:'Under BotStats rules, an interrupted human-versus-bot game counts as a forfeit: the human loses and the bot wins regardless of the score.'});
Object.assign(dict.ru,{mainFilters:'Период, игрок, карта, бот и стиль'});
Object.assign(dict.en,{mainFilters:'Period, player, map, bot and style'});
Object.assign(dict.ru,{achievements:'Достижения',dynamics:'Динамика'});
Object.assign(dict.en,{achievements:'Achievements',dynamics:'Trends'});
const itemRu={'Body Armor':'Красная броня','Combat Armor':'Жёлтая броня','Jacket Armor':'Зелёная броня','Armor Shard':'Осколки брони','Mega Health':'Мега','Adrenaline':'Адреналин','Ammo Pack':'Рюкзак с патронами','Bandolier':'Патронташ','Health 25':'Аптечка +25','Health 10':'Аптечка +10','Stimpack':'Стимпак','Bullets':'Пули','Slugs':'Снаряды для рейла','Shells':'Дробь','Rockets':'Ракеты','Cells':'Ячейки','Grenades':'Гранаты','Blaster':'Бластер','S.Shotgun':'Супершотган','Super Shotgun':'Супершотган','Shotgun':'Шотган','Machinegun':'Пулемёт','M.Gun':'Пулемёт','C.Gun':'Чейнган','Chaingun':'Чейнган','G.Launch':'Гранатомёт','Grenade Launcher':'Гранатомёт','R.Launch':'Ракетница','Rocket Launcher':'Ракетница','H.Blaster':'Гипербластер','HyperBlaster':'Гипербластер','Railgun':'Рейлган','H.Grenade':'Ручные гранаты'};
Object.assign(dict.ru,{forfeit:'Тех. поражение',rating:'Рейтинг',points:'Очки',pointsPerMatch:'Очков / матч',forfeits:'Тех. поражения',averageResult:'Средний счёт',difference:'Разница фрагов',averageDifference:'Средняя разница',averageKills:'Убийств / матч',averageDeaths:'Смертей / матч',averageKD:'Убийства − смерти / матч',mapLeaders:'Лидеры по картам',profile:'Профиль игрока',mapBreakdown:'Статистика по картам',recentMatches:'Последние матчи',technicalLoss:'Техническое поражение',ratingNote:'Рейтинг людей и ботов рассчитывается раздельно. Форфейт уже входит в общее число поражений. Очки за матч и процент побед считаются по играм с известным результатом.',meanNote:'Средний счёт и его разница учитывают все записи, включая счёт до прерывания. Средние убийства, смерти и урон — только матчи с полной серверной статистикой.'});
Object.assign(dict.en,{rating:'Rating',points:'Points',pointsPerMatch:'Points / match',forfeits:'Forfeit losses',averageResult:'Average score',difference:'Frag difference',averageDifference:'Average difference',averageKills:'Kills / match',averageDeaths:'Deaths / match',averageKD:'Kills − deaths / match',mapLeaders:'Map leaders',profile:'Player profile',mapBreakdown:'Statistics by map',recentMatches:'Recent matches',technicalLoss:'Forfeit loss',ratingNote:'Human and bot ratings use separate policies. Forfeits are included in total losses. Points per match and win rate use matches with a known result.',meanNote:'Average score and score difference include all records, including scores before interruption. Average kills, deaths and damage use matches with full server statistics only.'});

Object.assign(dict.ru,{forfeitWins:'Тех. победы',overtime:'Овертайм',overtimeWins:'Победы в ОТ',overtimeLosses:'Поражения в ОТ',overtimeForfeits:'Forfeit в ОТ',suddenDeath:'Sudden Death',overtimeResult:'Матч завершён в овертайме',ratingAward:'Очки за матч',opponentChanged:'Во время матча изменился бот-соперник. Запись сохранена, но исключена из рейтинга.',period:'Период',periodToday:'Сегодня',periodThree:'Последние 3 дня',periodWeek:'Неделя',periodMonth:'Месяц',periodYear:'Год',periodAll:'Всё время',periodCustom:'Свои даты',overtimeFilter:'Дополнительное время',overtimeOnly:'Только овертайм',ratingNote:'Технические победы и поражения включены в общее число побед и поражений. Очки за матч и процент побед — по играм с известным результатом. ОТ — овертайм, включая Sudden Death; forfeit в ОТ учитывается отдельно.',periodNote:'Дни по МСК. Неделя — 7 дней, месяц — 30, год — 365, включая сегодня.'});
Object.assign(dict.en,{forfeitWins:'Forfeit wins',overtime:'Overtime',overtimeWins:'OT wins',overtimeLosses:'OT losses',overtimeForfeits:'OT forfeits',suddenDeath:'Sudden Death',overtimeResult:'Match ended in overtime',ratingAward:'Match points',opponentChanged:'The bot opponent changed during this match. The record is retained but excluded from ratings.',period:'Period',periodToday:'Today',periodThree:'Last 3 days',periodWeek:'Week',periodMonth:'Month',periodYear:'Year',periodAll:'All time',periodCustom:'Custom dates',overtimeFilter:'Extra time',overtimeOnly:'Overtime only',ratingNote:'Forfeit wins and losses are included in total wins and losses. Points per match and win rate use matches with a known result. OT includes Sudden Death; OT forfeits are counted separately.',periodNote:'Days use Moscow time. Week: 7 days; month: 30; year: 365, including today.'});
Object.assign(dict.ru,{gameServer:'Игровой сервер',copyConnect:'Копировать connect',navigation:'Ссылки',partial:'Начало матча в записи не подтверждено. Показана длительность записанной части игры; дата определяется по имени файла, если оно содержит дату.',averages:'Средние показатели',overview:'Общая статистика',aboutRating:'О рейтинге',defeats:'Разгромы людей',defeatTitle:'Самые разгромные поражения людей',defeatNote:'Матчи с подтверждённым поражением человека, отсортированные по перевесу бота. Счёт указан в порядке человек : бот. Для forfeit сохранён счёт до прерывания; незавершённые игры без результата сюда не входят.',margin:'Перевес бота',profileSummary:'Сводная статистика',sortHint:'Нажми заголовок, чтобы изменить порядок',scoreLabel:'Счёт',forfeitWins:'Тех. победы',forfeits:'Тех. пораж.',pointsPerMatch:'Очки / матч',averageResult:'Ср. счёт',averageDifference:'Ср. разница',overtimeWins:'Победы в ОТ',overtimeLosses:'Пораж. в ОТ'});
Object.assign(dict.en,{gameServer:'Game server',copyConnect:'Copy connect',navigation:'Links',partial:'The recording does not confirm the start of the match. Duration covers the recorded portion; the date is taken from the filename when available.',averages:'Average performance',overview:'Overall statistics',aboutRating:'About the rating',defeats:'Human defeats',defeatTitle:'Biggest human defeats',defeatNote:'Confirmed human losses ranked by the bot’s score advantage. Scores are shown human : bot. Forfeits retain the pre-interruption score; games without a confirmed result are excluded.',margin:'Bot lead',profileSummary:'Overall performance',sortHint:'Click a heading to change the order',scoreLabel:'Score'});

Object.assign(dict.ru,{legacyStatsNote:'Статистика старого формата: точность оружия записана в процентах, без числа попаданий и выстрелов. Отсутствующие значения показаны прочерком.',legacyItemsNote:'Показаны предметы и счётчики, которые сервер включил в итоговую таблицу. Старый формат не содержит полного списка аптечек, боеприпасов и других подборов.'});
Object.assign(dict.en,{legacyStatsNote:'Legacy statistics report weapon accuracy as a percentage, without hit or shot counts. Missing values are shown as a dash.',legacyItemsNote:'These are the items and counters included in the server’s final table. The legacy format does not provide a complete list of health, ammunition and other pickups.'});

Object.assign(dict.ru,{
  rating:'Рейтинги', victory:'Победный рейтинг', average:'Усреднённый рейтинг',
  activity:'По числу матчей', maps:'Популярность карт', completedMatches:'Завершённые матчи', noForfeit:'без forfeit',
  victoryPoints:'Очки побед', averagePoints:'Очки рейтинга', normalWins:'Победы',
  normalLosses:'Поражения без forfeit',  share:'Доля игр',
  victoryNote:'Очки за победу = B × K: B зависит от длительности матча (меньше 2 минут — 0; 2 минуты — 1; от 10 минут — 10), K — от скилла бота. Между 2 и 10 минутами B растёт линейно. Победы в овертайме тоже считаются. Поражения, ничьи и forfeit не влияют на очки. «Завершённые матчи» — игры до финального результата, без forfeit и незавершённых записей.',
  activityNote:'Выше тот, у кого больше завершённых матчей без forfeit. Учитываются победы, поражения и ничьи, включая овертайм. Любые forfeit и прерванные записи исключены.',
  mapsNote:'Карты расположены по числу завершённых матчей без forfeit. Любые forfeit и прерванные записи исключены. Доля считается среди выбранных игр.',
  averageNote:'Индекс силы игры от 0 до 100, не процент побед: победы и поражения, разница фрагов, сила бота, длительность и число матчей. Только завершённые игры от 2 минут; forfeit исключены. До 10 таких матчей оценка предварительная и не участвует в основном топе. Малая выборка снижает уверенность в оценке.',
  botRating:'Рейтинг ботов'
});
Object.assign(dict.en,{
  rating:'Rankings', victory:'Victory rating', average:'Average rating',
  activity:'Matches played', maps:'Map popularity', completedMatches:'Completed matches', noForfeit:'no forfeits',
  victoryPoints:'Victory points', averagePoints:'Points with losses', normalWins:'Wins',
  normalLosses:'Losses without forfeits',  share:'Game share',
  victoryNote:'Win points = B × K: B depends on match duration (under 2 minutes: 0; 2 minutes: 1; 10 minutes or more: 10), and K on bot skill. B grows linearly between 2 and 10 minutes. Overtime wins also count. Losses, draws and forfeits do not affect points. Completed matches reached a final result, without a forfeit or an unfinished recording.',
  activityNote:'More completed matches rank higher. Wins, losses and draws count, including overtime. All forfeits and interrupted recordings are excluded.',
  mapsNote:'Maps are ranked by completed matches. All forfeits and interrupted recordings are excluded. Shares use the selected games.',
  averageNote:'Playing-strength index from 0 to 100, not a win percentage, using wins and losses, frag margin, bot strength, duration and match count. Completed games lasting at least 2 minutes only; forfeits are excluded. Fewer than 10 eligible games gives a provisional estimate outside the main leaderboard. Small samples reduce confidence.',
  botRating:'Bot rating'
});
Object.assign(dict.ru,{
  wins:'Победы, всего',losses:'Поражения, всего',matchCount:'Всего записей матчей',
  forfeit:'Досрочно (forfeit)',forfeits:'Поражения по forfeit',forfeitWins:'Победы по forfeit',
  overtimeWins:'Победы в овертайме',overtimeLosses:'Поражения в овертайме',overtimeForfeits:'Forfeit в овертайме',
  pointsPerMatch:'Средние очки за матч',averageResult:'Средний счёт',averageDifference:'Средняя разница счёта',
  victoryTotal:'Очки победного рейтинга',averageTotal:'Очки усреднённого рейтинга',
  averageKills:'Убийства за матч',averageDeaths:'Смерти за матч',averageKD:'Разница убийств и смертей за матч',
  finished:'завершено без forfeit',interruptedShort:'без подтверждённого результата'
});
Object.assign(dict.en,{
  wins:'Total wins',losses:'Total losses',matchCount:'Recorded matches',
  forfeit:'Ended early (forfeit)',forfeits:'Forfeit losses',forfeitWins:'Forfeit wins',
  overtimeWins:'Overtime wins',overtimeLosses:'Overtime losses',overtimeForfeits:'Overtime forfeits',
  pointsPerMatch:'Average points per match',averageDifference:'Average score difference',
  victoryTotal:'Victory rating points',averageTotal:'Average rating points',
  finished:'completed without forfeits',interruptedShort:'without a confirmed result'
});
function unscoredWarning(rows){
  const missing=rows.filter(p=>!p.isBot&&p.unscoredWins>0);if(!missing.length)return '';
  return `<div class="warning rating-data-note">${lang==='ru'?'Для части побед не удалось начислить очки: в записи не хватает данных о скилле бота или полной длительности матча. Победы сохранены в статистике.':'Points could not be awarded for some wins because the recordings lack reliable bot skill or full match duration data. These wins remain in the statistics.'}<ul>${missing.map(p=>`<li><a ${link({profile:p.name,kind:'human',match:null})}>${esc(p.name)}</a> — ${lang==='ru'?'побед с неполными данными':'wins with missing data'}: ${p.unscoredWins}</li>`).join('')}</ul></div>`;
}
function forfeitLoss(p,m){
  if(p.isBot||m?.status!=='forfeit')return '';
  const index=m.participants.indexOf(p);
  const lost=Number.isInteger(m.winnerIndex)?m.winnerIndex!==index:m.forfeitBy===p.name;
  return lost?`<span class="badge forfeit participant-result" data-outcome="forfeit-loss">${t('technicalLoss')}</span>`:'';
}
Object.assign(dict.ru,{
  forfeitRanking:'Антирейтинг forfeit', forfeitRate:'Доля forfeit', finishedResults:'Матчи с результатом',
  ratedMatches:'Матчи в расчёте', normalMatches:'Завершённые матчи', draws:'Ничьи', completedWinRate:'Победы без forfeit, %',
  averageTotal:'Усреднённый рейтинг · 0–100', averagePoints:'Индекс 0–100', provisional:'Предварительная оценка', performanceGames:'Матчи в расчёте', botStrength:'Сила бота, ×', performanceDifference:'Средняя разница фрагов',
  forfeitsNote:'Доля forfeit = технические поражения / все матчи с известным результатом × 100%. Выше тот, кто чаще прерывает игры. При равной доле — у кого больше forfeit. Количество матчей показано рядом: 1 из 1 и 66 из 119 — разный опыт. Записи без результата и матчи со сменой бота не учитываются; фильтр результата здесь не применяется.'
});
Object.assign(dict.en,{
  forfeitRanking:'Forfeit anti-ranking', forfeitRate:'Forfeit share', finishedResults:'Games with a result',
  ratedMatches:'Scored games', normalMatches:'Completed games', draws:'Draws', completedWinRate:'Wins excluding forfeits, %',
  averageTotal:'Average rating · 0–100', averagePoints:'Index 0–100', provisional:'Provisional estimate', performanceGames:'Rated games', botStrength:'Bot strength, ×', performanceDifference:'Average frag difference',
  forfeitsNote:'Forfeit share = forfeit losses / all games with a known result × 100%. A higher share ranks first; ties use the number of forfeits. Counts are shown alongside: 1 out of 1 and 66 out of 119 are different samples. Recordings without a result and games with a changed bot are excluded; the result filter does not apply here.'
});
const rankingMode=()=>['victory','average','forfeits','activity','maps'].includes(params.get('ranking'))?params.get('ranking'):'victory';
function rankingChoices(){return `<nav class="ranking-choices" aria-label="${t('rating')}">${['victory','average','forfeits','activity','maps'].map(mode=>`<a ${link({view:'rating',ranking:mode,page:null})} aria-current="${rankingMode()===mode?'page':'false'}">${t(mode==='forfeits'?'forfeitRanking':mode)}</a>`).join('')}</nav>`;}

function ratingExplanation(bot,victory=false){const attrs=link({view:'about',match:null,profile:null,kind:null,page:null},{hash:bot?'#bot-wins':victory?'#duration':'#performance'});if(victory)return `<a class="button-link" ${attrs}>${t('aboutRating')} →</a>`;return (lang==='ru'?(bot?'Боты на максимальном скилле: победа +0,1…+10; forfeit +0,05…+5. Награда растёт от 2 до 10 минут и умножается на долю скилла от собственного максимума. Поражение −0,01…−1.':'Индекс силы игры от 0 до 100, не процент побед и не сумма очков. Учитывает результаты против ботов и малое число игр. Forfeit — в отдельном антирейтинге.'):(bot?'Bots at maximum skill: win +0.1…+10; forfeit +0.05…+5. Rewards grow from 2 to 10 minutes and scale with skill relative to the bot’s own maximum. Loss −0.01…−1.':'Playing-strength index from 0 to 100, not a win percentage or accumulated points. It reflects results against bots with a small-sample adjustment. Forfeits have a separate anti-ranking.'))+` <a class="button-link" ${attrs}>${bot?(lang==='ru'?'Правила начисления ботам →':'Bot scoring rules →'):lang==='ru'?'Как рассчитывается оценка →':'How the estimate is calculated →'}</a>`;}

function periodSelect(){return field('period','period',`<select id="f-period" name="period">${[['all','periodAll'],['today','periodToday'],['three','periodThree'],['week','periodWeek'],['month','periodMonth'],['year','periodYear'],['custom','periodCustom']].map(([v,k])=>`<option value="${v}">${t(k)}</option>`).join('')}</select>`);}

const t=k=>dict[lang][k]||k,num=(v,d=0)=>v===null||v===undefined?'—':Number(v).toLocaleString(lang,{maximumFractionDigits:d}),item=n=>lang==='ru'?(itemRu[n]||n):n;
const time=s=>`${Math.floor(Math.max(0,s)/60)}:${String(Math.floor(Math.max(0,s)%60)).padStart(2,'0')}`;
const date=s=>s?new Intl.DateTimeFormat(lang,{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'}).format(new Date(s)):'—';
const skill=p=>p.skillVariable?t('variable'):num(p.skill);
const badge=m=>`<span class="badge ${esc(m.status)}">${t(m.status)}</span>${m.overtime?` <span class="badge overtime">${t(m.overtimeKind==='sudden_death'?'suddenDeath':'overtime')}</span>`:''}`;
const score=m=>`<span class="score"><span class="${m.winnerIndex===0?'win':''}">${m.participants[0].score}</span><span class="sep">:</span><span class="${m.winnerIndex===1?'win':''}">${m.participants[1].score}</span></span>`;
Object.assign(dict.ru,{botdefeats:'Поражения ботов',botDefeatTitle:'Самые крупные поражения ботов',botDefeatNote:'Победы людей по убыванию разницы фрагов. Счёт указан в порядке человек : бот. Только завершённые матчи с подтверждённой победой человека; forfeit, ничьи и незавершённые записи исключены. Все скиллы, с учётом выбранных фильтров.',humanMargin:'Перевес человека'});
Object.assign(dict.en,{botdefeats:'Bot defeats',botDefeatTitle:'Biggest bot defeats',botDefeatNote:'Human wins ranked by frag margin. Scores are shown as human : bot. Only completed games with a confirmed human win count; forfeits, draws and unfinished recordings are excluded. All skills, subject to the selected filters.',humanMargin:'Human lead'});
const defeatView=()=>['defeats','botdefeats'].includes(view);
Object.assign(dict.ru,{victims:'Жертвы бота',victimsTitle:'Кого бот побеждает чаще всего',pairs:'пар бот–человек',pairMatches:'Матчей пары',pairBotWins:'Победы бота',pairBotPercent:'Победы бота, %',pairBotFrags:'Фраги бота / матч',pairHumanFrags:'Фраги человека / матч',pairLastWin:'Последняя победа бота · МСК'});
Object.assign(dict.en,{victims:'Bot victims',victimsTitle:'Most frequent bot victims',pairs:'bot–human pairs',pairMatches:'Pair matches',pairBotWins:'Bot wins',pairBotPercent:'Bot wins, %',pairBotFrags:'Bot frags / match',pairHumanFrags:'Human frags / match',pairLastWin:'Last bot win · MSK'});
const qfields=['q','map','bot','style','skill','modVersion','status','from','to','period','overtime','page','sort_matches','dir_matches','sort_defeats','dir_defeats','sort_botdefeats','dir_botdefeats','sort_victims','dir_victims'];
const routes=createNavigation({base,params,getPreferences:()=>({lang,theme})});
const {url,link}=routes;
function writeLocation(mode='replace'){history[mode+'State'](null,'',url({}, {hash:location.hash}));routes.sync(document);}
async function api(endpoint){const r=await fetch(base+'/api/'+endpoint);if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json();}
function applyTheme(){document.documentElement.dataset.theme=theme==='auto'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):theme;try{localStorage.setItem('botstats.theme',theme);}catch(e){}}
function preferences(){document.documentElement.lang=lang;document.title=(view==='about'?t('aboutRating')+' · ':view==='achievements'?t('achievements')+' · ':view==='dynamics'?t('dynamics')+' · ':(defeatView()||view==='victims'||view==='players'||view==='rating')?t(view)+' · ':'')+'BotStats · Q2PRO-X';routes.bind($('.brand'),{}, {home:true});routes.bind($('#about-link'),{view:'about',match:null,profile:null,kind:null,page:null});$('#about-link').setAttribute('aria-current',view==='about'?'page':'false');document.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=t(el.dataset.i18n));$('#theme').value=theme;$('#language').value=lang;for(const o of $('#theme').options)o.textContent=({auto:'◐ ',dark:'☾ ',light:'☀ '}[o.value])+t(o.value);}
$('#theme').onchange=e=>{theme=e.target.value;applyTheme();writeLocation();};
$('#language').onchange=e=>{lang=e.target.value;try{localStorage.setItem('botstats.lang',lang);}catch(err){}writeLocation();preferences();render();};
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(theme==='auto')applyTheme();});
window.addEventListener('popstate',()=>{[...params.keys()].forEach(k=>params.delete(k));new URLSearchParams(location.search).forEach((v,k)=>params.set(k,v));if(location.pathname.replace(/\/$/,'').endsWith('/about'))params.set('view','about');view=params.get('view')||'rating';lang=['ru','en'].includes(params.get('lang'))?params.get('lang'):lang;theme=['auto','dark','light'].includes(params.get('theme'))?params.get('theme'):theme;selectedWeaponPlayer=Number(params.get('weapon'))===1?1:0;applyTheme();routes.sync(document);render();});
function options(values,label=t('all')){return `<option value="">${esc(label)}</option>`+values.map(v=>`<option value="${esc(v)}">${esc(v==='variable'?t('variable'):v)}</option>`).join('');}
function field(key,label,content){return `<div class="field"><label for="f-${key}">${t(label)}</label>${content}</div>`;}
function select(key,label,values){return field(key,label,`<select id="f-${key}" name="${key}">${options(values)}</select>`);}
const overviewMobile=matchMedia('(max-width:800px)');
function overviewHome(){return view==='rating'&&rankingMode()==='victory';}
function hero(){return `<section class="overview ${overviewHome()?'overview-home':'overview-secondary'}" aria-label="${t('overview')}"><details class="overview-fold" data-overview="overviewStats" open><summary>${t('overview')}</summary><div class="kpis" id="kpis"></div></details><details class="overview-fold" data-overview="overviewLatest" open><summary>${t('latest')}</summary><div class="hero-card" id="latest"><div class="loading">${t('loading')}</div></div></details></section>`;}
function mountOverview(){
  for(const panel of document.querySelectorAll('[data-overview]')){
    const key=panel.dataset.overview;panel.open=!overviewMobile.matches||overviewHome()||params.get(key)==='1';
    panel.ontoggle=()=>{if(!panel.isConnected||!overviewMobile.matches||overviewHome())return;if(panel.open===(params.get(key)==='1'))return;params.set(key,panel.open?'1':'0');writeLocation();};
  }
}
overviewMobile.addEventListener('change',mountOverview);
function navigation(){return `<nav class="tabs" aria-label="${t('matches')}">${['rating','matches','players','bots','defeats','victims','botdefeats','dynamics','achievements'].map(v=>`<a class="tab" data-view="${v}" ${link({view:v,match:null,profile:null,kind:null,achievement:null,awardPlayer:null,awardPage:null,page:null})} aria-current="${view===v?'page':'false'}" aria-selected="${view===v}">${t(v)}</a>`).join('')}</nav>`;}
function badges(p){return achievementBadges(awardCatalog,p.isBot?(p.profile||p.name.replace(/(?:\[\d+\]|>\d+)$/,'')):p.name,{lang,link,kind:p.isBot?'bot':'human'});}
function listShell(){
  const trend=view==='dynamics';
  const optional=trend?'':field('overtime','overtimeFilter',`<select id="f-overtime" name="overtime"><option value="">${t('all')}</option><option value="1">${t('overtimeOnly')}</option></select>`)+select('skill','skill',[...(facets.skills||[]),'variable']);
  const status=trend||(view==='rating'&&rankingMode()==='forfeits')?'':field('status','status',`<select id="f-status" name="status"><option value="">${t('all')}</option>${['completed','forfeit','interrupted'].map(s=>`<option value="${s}">${t(s)}</option>`).join('')}</select>`);
  const advancedKeys=trend?['modVersion','from','to']:['skill','modVersion','status','from','to','overtime'];
  return `${trend?'':hero()}<section class="workspace"><div class="workspace-head">${navigation()}<span class="refresh">${t('serverTime')}</span></div><form id="filters" class="filter-panel"><details class="primary-filters" ${params.get('filters')==='1'?'open':''}><summary>${t('mainFilters')}</summary><div class="filters">${periodSelect()}${field('q',view==='players'?(lang==='ru'?'Ник игрока':'Player name'):'search',`<input id="f-q" name="q" type="search" placeholder="${view==='players'?(lang==='ru'?'Ник, например pp или q':'Name, for example pp or q'):t('searchHint')}" maxlength="80" autocomplete="off">`)}${select('map','map',facets.maps||[])}${select('bot','bot',facets.bots||[])}${select('style','style',facets.styles||[])}</div></details><details class="advanced" ${(params.has('advanced')?params.get('advanced')==='1':advancedKeys.some(k=>params.has(k)))?'open':''}><summary>${trend?(lang==='ru'?'Версия и даты':'Version and dates'):t('moreFilters')}</summary><div class="filters">${optional}${select('modVersion','version',facets.versions||[])}${status}${field('from','from','<input id="f-from" name="from" type="date">')}${field('to','to','<input id="f-to" name="to" type="date">')}</div></details><div class="filter-bottom"><button type="submit">${t('apply')}</button><button type="button" id="reset">${t('reset')}</button><button type="button" id="copy">${t('copy')}</button><span class="sub">${t('periodNote')}</span><span class="result-count" id="count"></span></div></form><div id="results"><div class="loading">${t('loading')}</div></div></section>`;
}
function matchRow(m){const attrs=link({view:'matches',match:m.id,profile:null,achievement:null,awardPlayer:null,awardPage:null});return `<div class="match-row"><div><a ${attrs}><div class="map-name ${esc(m.map)}">${esc(m.map)}</div><div class="date">${esc(date(m.startedAt))}</div></a></div><div class="duel">${person(m.participants[0],m)}<a class="score-link" ${attrs} aria-label="${t('details')}">${score(m)}</a>${person(m.participants[1],m)}</div><div class="status">${badge(m)}</div><div class="row-meta">${time(m.durationSeconds??m.recordedSeconds)}<br>${m.modVersion?'Beta '+esc(m.modVersion):'—'}</div><div class="chevron"><a ${attrs} aria-label="${t('details')}">↗</a></div></div>`;}
function person(p,m){return `<span class="person" data-player-kind="${p.isBot?'bot':'human'}"><span class="person-name"><a ${link({view:'players',profile:p.isBot?p.profile:p.name,kind:p.isBot?'bot':'human',match:null,achievement:null,awardPlayer:null,awardPage:null})}>${esc(p.name)}</a></span>${badges(p)}${forfeitLoss(p,m)}<small>${p.isBot?`${t('skill')} ${esc(skill(p))} · ${esc(p.styleVariable?t('variable'):(p.style||'—'))}`:t('human')}</small></span>`;}
function kpis(s){return [['allMatches',s.matches,`${s.fullStats} ${t('fullStats')}`],['gameTime',`${num(s.minutes)} <small>${t('minutes')}</small>`,t('rounds')],['humanWins',s.humanWins,lang==='ru'?'Включая победы в овертайме':'Including overtime wins'],['botWins',s.botWins,lang==='ru'?'Включая технические победы':'Including forfeit wins']].map(([label,val,note])=>`<div class="kpi"><span class="label">${t(label)}</span><span class="value">${typeof val==='number'?num(val):val}</span><span class="note">${esc(note)}</span></div>`).join('');}
function rankTable(rows,map=false,id=map?'maps':'rating'){
  if(rows.some(r=>!r.isBot)||(!rows.length&&view!=='bots'))return averageTable(rows,map,id);
  const data=rows.map((r,i)=>({...r,rank:i+1}));
  const onlyBots=rows.length?rows.every(r=>r.isBot):view==='bots';
  const columns=[{key:map?'map':'name',label:t(map?'map':'player'),text:true,value:r=>map?r.map:r.name,render:r=>map?esc(r.map):`<span class="rank">${r.rank}</span><a ${link({profile:r.name,kind:r.isBot?'bot':'human',match:null})}>${esc(r.name)}</a>${badges(r)}`},
    ...[['points',rows.some(r=>!r.isBot)?'averagePoints':'points'],['matches','matchCount'],['wins','wins'],['losses','losses'],['forfeitWins','forfeitWins'],['forfeits','forfeits'],['overtimeWins','overtimeWins'],['overtimeLosses','overtimeLosses'],['winRate','winRate'],['pointsPerMatch','pointsPerMatch']].filter(([key])=>key==='forfeitWins'?onlyBots:key==='forfeits'?!onlyBots:true).map(([key,label])=>({key,label:t(label),value:r=>r[key],render:r=>key==='points'?`<b class="${r.points>=0?'positive':'negative'}">${r.points>0?'+':''}${pointNum(r.points)}</b>`:key==='pointsPerMatch'?pointNum(r[key]):num(r[key],key==='winRate'?1:0)})),
    {key:'averageScore',label:t('averageResult'),value:r=>[r.averageScore,r.averageOpponentScore],render:r=>`${num(r.averageScore,1)} : ${num(r.averageOpponentScore,1)}`},
    {key:'averageFragDifference',label:t('averageDifference'),value:r=>r.averageFragDifference,render:r=>num(r.averageFragDifference,1)}];
  return renderTable(id,columns,data,{params,lang,defaultKey:map?'map':'points',defaultDir:map?'asc':'desc'});
}
function averageTable(rows,map,id){
  const data=rows.map((r,i)=>({...r,rank:i+1}));
  const columns=[{key:map?'map':'name',label:t(map?'map':'player'),text:true,value:r=>map?r.map:r.name,render:r=>map?esc(r.map):`<span class="rank">${r.performance?.provisional?'—':r.rank}</span><a ${link({profile:r.name,kind:'human',match:null})}>${esc(r.name)}</a>${badges(r)}`},
    {key:'performance',label:t('averagePoints'),value:r=>r.performance?.value,render:r=>`<b class="positive">${num(r.performance?.value,2)}</b>${r.performance?.provisional?`<small class="column-hint">${t('provisional')} · ${r.performance.games}/${performancePolicy.minimumGames}</small>`:''}`},
    ...[['games','performanceGames'],['wins','normalWins'],['losses','normalLosses'],['winRate','completedWinRate'],['averageFragDifference','performanceDifference'],['averageDifficulty','botStrength']].map(([key,label])=>({key,label:t(label),value:r=>r.performance?.[key],render:r=>num(r.performance?.[key],['games','wins','losses'].includes(key)?0:2)}))];
  const render=(subset,tableId)=>renderTable(tableId,columns,subset,{params,lang,defaultKey:map?'map':'performance',defaultDir:map?'asc':'desc'});
  if(id!=='rating_average')return render(data,id);
  const ranked=data.filter(r=>!r.performance.provisional),provisional=data.filter(r=>r.performance.provisional);
  return (ranked.length?render(ranked,id):`<p class="empty">${lang==='ru'?'Пока нет игроков с 10 матчами для основного рейтинга.':'No players have 10 eligible games for the main ranking yet.'}</p>`)+
    (provisional.length?`<h3>${t('provisional')}</h3><p class="footnote">${lang==='ru'?'Эти игроки пока не участвуют в основном топе. Оценка станет основной после 10 подходящих матчей в выбранной статистике.':'These players are not in the main leaderboard yet. Their estimate becomes established after 10 eligible matches in the selected data.'}</p>`+render(provisional,id+'_provisional'):'');
}
function forfeitTable(rows,id){
  const data=rows.map((r,i)=>({...r,rank:i+1}));
  const columns=[{key:'name',label:t('player'),text:true,value:r=>r.name,render:r=>`<span class="rank">${r.rank}</span><a ${link({profile:r.name,kind:'human',match:null})}>${esc(r.name)}</a>${badges(r)}`},
    {key:'forfeitRate',label:t('forfeitRate'),value:r=>r.forfeitRate,render:r=>`<b class="negative">${num(r.forfeitRate,2)}%</b>`},
    ...[['forfeits','forfeits'],['finished','finishedResults'],['normalMatches','normalMatches']].map(([key,label])=>({key,label:t(label),value:r=>r[key],render:r=>num(r[key])}))];
  return renderTable(id,columns,data,{params,lang,defaultKey:'forfeitRate'});
}
function victoryTable(rows,id,mode,asOf){
  const data=rows.map((r,i)=>({...r,rank:i+1}));
  const keys=mode==='activity'?['completedMatches','normalWins','normalLosses','victoryPoints']:['victoryPoints','normalWins','completedMatches'];
  const columns=[{key:'name',label:t('player'),text:true,value:r=>r.name,render:r=>`<span class="rank">${r.rank}</span><a ${link({profile:r.name,kind:'human',match:null})}>${esc(r.name)}</a>${badges(r)}`},
    ...keys.map(key=>({key,label:t(key),hint:key==='completedMatches'?t('noForfeit'):null,value:r=>r[key],render:r=>key==='victoryPoints'||key==='completedMatches'?`<b class="positive">${num(r[key],key==='victoryPoints'?2:0)}</b>`:key==='normalWins'&&mode==='victory'?winsWithHistory(r,{lang,asOf}):num(r[key])}))];
  return renderTable(id,columns,data,{params,lang,defaultKey:mode==='activity'?'completedMatches':'victoryPoints'});
}
function popularityTable(s){
  const rows=rankMaps(s.byMap).map((r,i)=>({...r,rank:i+1,share:s.completedMatches?r.completedMatches/s.completedMatches*100:0}));
  const columns=[{key:'map',label:t('map'),text:true,value:r=>r.map,render:r=>`<span class="rank">${r.rank}</span><a ${link({map:r.map,view:'matches',page:null})}>${esc(r.map)}</a>`},
    {key:'completedMatches',label:t('completedMatches'),hint:t('noForfeit'),value:r=>r.completedMatches,render:r=>`<b>${num(r.completedMatches)}</b>`},
    {key:'share',label:t('share'),value:r=>r.share,render:r=>num(r.share,1)+'%'}];
  return renderTable('popularity',columns,rows,{params,lang,defaultKey:'completedMatches'})+(!rows.length?`<div class="empty">${lang==='ru'?'Нет завершённых матчей без forfeit.':'No completed matches without forfeits.'}</div>`:'');
}
function ratingLeaders(s){
  const bot=view==='bots',mode=bot?'average':rankingMode();
  const heading=`${bot?'':rankingChoices()}<div class="ranking-intro"><h2>${t(bot?'botRating':mode==='forfeits'?'forfeitRanking':mode)}</h2><p>${bot?ratingExplanation(true):t(mode+'Note')}</p></div>`;
  if(mode==='maps')return heading+popularityTable(s);
  const eligible=rows=>rankParticipants(rows.filter(p=>p.isBot===bot&&(mode!=='activity'||p.completedMatches>0)&&(mode!=='victory'||p.normalWins>0)&&(bot||mode!=='average'||p.performance?.value!=null)&&(mode!=='forfeits'||p.forfeits>0)),mode);
  const rows=eligible(s.players),id=bot?'rating_bots':'rating_'+mode;
  const table=mode==='forfeits'?forfeitTable(rows,id):mode==='average'?rankTable(rows,false,id):victoryTable(rows,id,mode,s.asOf);
  const note=mode==='victory'?ratingExplanation(false,true):mode==='average'?ratingExplanation(bot)+(bot?'<br>'+t('ratingNote'):''):'';
  return heading+table+(mode==='victory'?unscoredWarning(rows):'')+(!rows.length?`<div class="empty">${mode==='victory'?(lang==='ru'?'В выбранных матчах нет побед человека.':'No human wins in the selected matches.'):mode==='activity'?(lang==='ru'?'Нет завершённых матчей без forfeit.':'No completed matches without forfeits.'):t('empty')}</div>`:'')+`<p class="footnote">${note}</p><div class="map-leaders">${s.byMap.map(m=>{
    const leaders=eligible(m.players).filter(p=>bot||mode!=='average'||!p.performance.provisional).slice(0,3);if(!leaders.length)return '';
    const key=mode==='activity'?'completedMatches':mode==='forfeits'?'forfeitRate':mode==='average'?(bot?'points':'performance'):'victoryPoints';
    return `<section class="map-leader"><a class="map-name ${esc(m.map)}" ${link({map:m.map,view:bot?'bots':'rating'})}>${esc(m.map)}</a><div class="map-leader-heading"><span>№</span><span>${t(bot?'botType':'human')}</span><span>${t(mode==='activity'?'matches':mode==='victory'?'victoryPoints':mode==='forfeits'?'forfeitRate':bot?'points':'averagePoints')}</span></div>${leaders.map((p,i)=>`<div><span class="rank">${i+1}</span><span class="leader-identity"><a ${link({profile:p.name,kind:bot?'bot':'human'})}>${esc(p.name)}</a>${badges(p)}</span><b>${mode==='activity'?num(p[key]):(key==='performance'?num(p.performance.value,2):pointNum(p[key]))+(mode==='forfeits'?'%':'')}</b></div>`).join('')}</section>`;
  }).join('')}</div>`;
}

function profileControls(){return `<div class="profile-period filters">${periodSelect()}${field('from','from','<input id="f-from" type="date">')}${field('to','to','<input id="f-to" type="date">')}</div>`;}
function mountProfilePeriod(){for(const k of ['period','from','to'])$('#f-'+k).value=params.get(k)||(k==='period'?'all':'');for(const k of ['period','from','to'])$('#f-'+k).onchange=e=>{if(k==='period'){params.set('period',e.target.value);if(e.target.value!=='custom'){params.delete('from');params.delete('to');}}else{params.set('period','custom');if(e.target.value)params.set(k,e.target.value);else params.delete(k);}writeLocation();render();};}

async function profile(epoch){const name=params.get('profile'),kind=params.get('kind')==='bot'?'bot':'human',q=new URLSearchParams({identity:name,kind});for(const k of ['period','from','to','overtime','map','style','skill','modVersion','status','sort_matches','dir_matches'])if(params.has(k))q.set(k,params.get(k));const [s,r]=await Promise.all([api('summary?'+q),api('matches?'+q)]),p=s.players.find(p=>p.name===name&&p.isBot===(kind==='bot'));if(epoch!==renderEpoch)return;if(!p){$('#content').innerHTML=`<a class="back" ${link({profile:null,kind:null})}>${t('back')}</a><div class="detail-top"><h1>${esc(name)}</h1></div>${achievementProfile(awardCatalog,name,{lang,link,kind})}${profileControls()}<div class="empty">${t('empty')}</div>`;mountProfilePeriod();return;}const maps=s.byMap.map(m=>({map:m.map,...m.players.find(p=>p.name===name&&p.isBot===(kind==='bot'))}));$('#content').innerHTML=`<a class="back" ${link({profile:null,kind:null})}>${view==='players'?(lang==='ru'?'← К списку игроков':'← Player directory'):t('back')}</a><div class="detail-top"><div><div class="eyebrow">${kind==='bot'?t('botType'):t('profile')}</div><h1>${esc(name)}</h1><span class="subtle">${params.has('map')?esc(params.get('map')):t('allMaps')} · ${t({today:'periodToday',three:'periodThree',week:'periodWeek',month:'periodMonth',year:'periodYear',custom:'periodCustom'}[params.get('period')]||'periodAll')}</span></div></div>${achievementProfile(awardCatalog,name,{lang,link,kind})}${profileControls()}<div class="kpis">${(kind==='human'?[['victoryTotal',num(p.victoryPoints,2)],['averageTotal',num(p.performance?.value,2)+(p.performance?.provisional?` <small>${t('provisional')}</small>`:'')],['completedMatches',p.completedMatches],['forfeitRate',num(p.forfeitRate,2)+'%']]:[['points',pointNum(p.points)],['matchCount',p.matches],['winRate',num(p.winRate,1)+'%'],['pointsPerMatch',pointNum(p.pointsPerMatch)]]).map(([label,value])=>`<div class="kpi"><span class="label">${t(label)}</span><span class="value">${value}</span></div>`).join('')}</div><section class="panel"><h2>${t('profileSummary')}</h2>${rankTable([p],false,'profile')}${unscoredWarning([p])}<p class="sub">${ratingExplanation(kind==='bot')}${kind==='bot'?'<br>'+t('ratingNote'):''}</p><div class="kpis">${[['averageKills',p.averageKills],['averageDeaths',p.averageDeaths],['averageKD',p.averageKillDeathDifference],['averageDamage',p.averageDamage],['overtimeForfeits',p.overtimeForfeits]].map(([label,value])=>`<div class="kpi"><span class="label">${t(label)}</span><span class="value">${num(value,1)}</span></div>`).join('')}</div><p class="sub">${t('meanNote')}</p></section><section class="panel"><h2>${t('mapBreakdown')}</h2>${kind==='human'?profileVictories(maps):''}${rankTable(maps,true)}<h3>${t('averages')}</h3>${mapAverages(maps)}</section><section class="panel"><h2>${t('recentMatches')}</h2>${matchHeaders()}${r.items.map(matchRow).join('')}</section>`;mountProfilePeriod();}
function profileVictories(rows){
  const columns=[{key:'map',label:t('map'),text:true,value:r=>r.map},...['victoryPoints','completedMatches'].map(key=>({key,label:t(key),hint:key==='completedMatches'?t('noForfeit'):null,value:r=>r[key],render:r=>num(r[key],2)}))];
  return `<h3>${t('victory')}</h3>`+renderTable('profile_victory_maps',columns,rows,{params,lang,defaultKey:'victoryPoints'})+`<h3>${t('average')}</h3>`;
}
const pointNum=v=>num(v,v&&Math.abs(v)<0.01?Math.min(12,Math.ceil(-Math.log10(Math.abs(v)))+1):2);
function matchRatingAwards(m){
  const award=(p,i,fn)=>`${esc(p.name)} <b>${fn(m,i)===null?'—':(fn(m,i)>0?'+':'')+pointNum(fn(m,i))}</b>`;
  return `<p class="footnote">${t('victory')}: ${m.participants.map((p,i)=>p.isBot?'':award(p,i,victoryPoints)).filter(Boolean).join(' · ')}<br>${t('average')}: ${m.status==='forfeit'?(lang==='ru'?'forfeit не участвует в расчёте':'forfeit excluded from calculation'):(lang==='ru'?'пересчитывается по всем подходящим матчам игрока, без фиксированной прибавки за одну игру':'recalculated across eligible games, with no fixed award per game')}<br>${t('botRating')}: ${m.participants.map((p,i)=>p.isBot?award(p,i,matchPoints):'').filter(Boolean).join(' · ')}</p>`;
}
function mapAverages(rows){const columns=[{key:'map',label:t('map'),text:true,value:r=>r.map},...['averageKills','averageDeaths','averageKillDeathDifference','averageDamage','statsMatches'].map((key,i)=>({key,label:t(['averageKills','averageDeaths','averageKD','averageDamage','fullStats'][i]),value:r=>r[key],render:r=>num(r[key],key==='statsMatches'?0:1)}))];return renderTable('averages',columns,rows,{params,lang,defaultKey:'map',defaultDir:'asc'});}

function victimResults(result){
  const identity=(name,isBot)=>`<a ${link({view:'players',profile:name,kind:isBot?'bot':'human',match:null})}>${esc(name)}</a>${badges({name,profile:isBot?name:null,isBot})}`;
  const columns=[
    {key:'bot',label:t('botType'),text:true,value:r=>r.bot,render:r=>identity(r.bot,true)},
    {key:'human',label:t('human'),text:true,value:r=>r.human,render:r=>identity(r.human,false)},
    {key:'botWins',label:t('pairBotWins'),value:r=>r.botWins,render:r=>`<strong class="victim-wins">${num(r.botWins)}</strong>${r.forfeitWins?`<small class="victim-forfeits">${lang==='ru'?'Из них forfeit':'Forfeit wins'}: ${num(r.forfeitWins)}</small>`:''}`},
    {key:'matches',label:t('pairMatches'),value:r=>r.matches,render:r=>num(r.matches)},
    {key:'botWinPercent',label:t('pairBotPercent'),value:r=>r.botWinPercent,render:r=>num(r.botWinPercent,1)+'%'},
    {key:'averageBotSkill',label:lang==='ru'?'Средний скилл в победах':'Average skill in wins',value:r=>r.averageBotSkill,render:r=>`${num(r.averageBotSkill,1)}${r.botSkillMatches<r.botWins?`<small class="column-hint">${lang==='ru'?'Известен в':'Known in'} ${num(r.botSkillMatches)} / ${num(r.botWins)}</small>`:''}`},
    {key:'averageBotFrags',label:t('pairBotFrags'),value:r=>r.averageBotFrags,render:r=>num(r.averageBotFrags,1)},
    {key:'averageHumanFrags',label:t('pairHumanFrags'),value:r=>r.averageHumanFrags,render:r=>num(r.averageHumanFrags,1)},
    {key:'lastBotWinAt',label:t('pairLastWin'),value:r=>r.lastBotWinAt,render:r=>r.lastBotWinMatchId?`<a class="last-bot-win" ${link({view:'matches',match:r.lastBotWinMatchId,profile:null,kind:null,achievement:null,awardPlayer:null,awardPage:null,page:null})} title="${lang==='ru'?'Открыть матч':'Open match'}">${esc(date(r.lastBotWinAt))} ↗</a>`:esc(date(r.lastBotWinAt))}
  ];
  const note=lang==='ru'?'Пары бот–человек по числу побед бота, включая forfeit. Процент побед и средние фраги считаются по всем матчам пары с известным результатом, включая поражения бота и ничьи. Фраги — итоговый счёт; при forfeit — счёт до прерывания. Дата последней победы — дата матча. Скиллы одного бота объединены. Средний скилл — по активному времени в победах бота, включая forfeit; изменения скилла внутри матча учитываются по времени. Неполные данные и игры нулевой длительности не дают выдуманных значений. Скилл показан по собственной шкале бота (Human до 100, GOD до 250). Выбранные фильтры применяются ко всем показателям.':'Bot–human pairs ranked by bot wins, including forfeits. Win percentage and average frags cover all pair matches with a known result, including bot losses and draws. Frags use the final score, or the score before a forfeit. The last win date is the match date. Skill levels of the same bot are grouped together. Average skill is weighted by active time in bot wins, including forfeits and in-game skill changes. Incomplete data and zero-duration games do not invent values. Skills use each bot’s native scale (Human up to 100, GOD up to 250). Selected filters apply to every metric.';
  return `<div class="defeat-intro"><h2>${t('victimsTitle')}</h2><p>${lang==='ru'?'Топ пар бот–человек по числу побед бота, включая forfeit.':'Bot–human pairs ranked by bot wins, including forfeits.'}</p><details class="victim-rules"><summary>${lang==='ru'?'Как считаются показатели':'How these metrics are calculated'}</summary><p>${note}</p></details></div>`+(result.items.length?renderTable('victims',columns,result.items,{params,lang,defaultKey:'botWins',defaultDir:'desc'}):`<div class="empty">${t('empty')}</div>`);
}

function defeatResults(r){
  const botLoss=view==='botdefeats';
  const human=m=>m.participants.find(p=>!p.isBot),bot=m=>m.participants.find(p=>p.isBot),matchLink=m=>link({match:m.id});
  const columns=[
    {key:'human',label:t('human'),text:true,value:m=>human(m).name,render:m=>`<a ${link({profile:human(m).name,kind:'human',match:null})}>${esc(human(m).name)}</a>${badges(human(m))}${forfeitLoss(human(m),m)}`},
    {key:'bot',label:t('botType'),text:true,value:m=>bot(m).name,render:m=>`<a ${link({profile:bot(m).profile,kind:'bot',match:null})}>${esc(bot(m).name)}</a>${badges(bot(m))}${bot(m).skillVariable?`<div>${t('variable')} · ${lang==='ru'?'средний':'average'} ${num(m.rating?.difficulty.averageSkill,2)}</div>`:''}`},
    {key:'humanScore',label:t('scoreLabel'),value:m=>human(m).score,render:m=>`<a ${matchLink(m)}>${human(m).score} : ${bot(m).score} ↗</a>`},
    {key:'margin',label:t(botLoss?'humanMargin':'margin'),value:m=>botLoss?human(m).score-bot(m).score:bot(m).score-human(m).score,render:m=>`<b>${num(botLoss?human(m).score-bot(m).score:bot(m).score-human(m).score)}</b>`},
    {key:'map',label:t('map'),text:true,value:m=>m.map},
    {key:'date',label:t('date'),value:m=>m.startedAt,render:m=>esc(date(m.startedAt))},
    {key:'duration',label:t('duration'),value:m=>m.durationSeconds??m.recordedSeconds,render:m=>time(m.durationSeconds??m.recordedSeconds)},
    {key:'status',label:t('status'),text:true,value:m=>m.status,render:m=>badge(m)}
  ];
  return `<div class="defeat-intro"><h2>${t(botLoss?'botDefeatTitle':'defeatTitle')}</h2><p>${t(botLoss?'botDefeatNote':'defeatNote')}</p></div>`+(r.items.length?renderTable(view,columns,r.items,{params,lang,defaultKey:'margin',defaultDir:'desc',presorted:true})+`<div class="pagination"><button data-page="${r.page-1}" ${r.page<=1?'disabled':''}>${t('prev')}</button><span>${t('page')} ${r.page} ${t('of')} ${r.pages}</span><button data-page="${r.page+1}" ${r.page>=r.pages?'disabled':''}>${t('next')}</button></div>`:`<div class="empty">${t('empty')}</div>`);
}

function matchHeaders(){const columns=[['map','map',true],['date','date',false],['match','match',true],['score','scoreLabel',false],['status','status',true],['duration','duration',false],['version','version',true]].map(([key,label,text])=>({key,label:t(label),text})),state=sortState('matches',columns,params,'date','desc');return `<div class="match-sort" aria-label="${t('sortHint')}">${columns.map(c=>sortButton('matches',c,state,lang)).join('')}</div>`;}
document.addEventListener('click',async e=>{const button=e.target.closest('[data-sort-table]');if(!button)return;const id=button.dataset.sortTable;params.set('sort_'+id,button.dataset.sortKey);params.set('dir_'+id,button.dataset.sortDir);if(id==='award_evidence')params.delete('awardPage');if(['matches','defeats','botdefeats'].includes(id))params.delete('page');writeLocation();const y=scrollY;if(['matches','defeats','botdefeats','victims'].includes(id)&&!params.has('profile')&&!params.has('match'))await refresh();else await render();window.scrollTo(0,y);document.querySelector(`[data-sort-table="${id}"][data-sort-key="${button.dataset.sortKey}"]`)?.focus({preventScroll:true});});
$('#copy-server').onclick=async()=>{const command='connect 91.227.18.67:27950';try{await navigator.clipboard.writeText(command);$('#copy-server').textContent=t('copied');}catch(e){window.prompt(t('copyConnect'),command);}};
$('#toggle-links').onclick=()=>{const open=$('#toggle-links').getAttribute('aria-expanded')!=='true';$('#toggle-links').setAttribute('aria-expanded',String(open));$('.header').classList.toggle('links-open',open);};

let requestId=0;
let dynamicsCleanup=()=>{};
async function refreshDynamics(){
  const request=++requestId,q=new URLSearchParams();
  for(const k of ['period','from','to','q','map','bot','style','modVersion'])if(params.has(k))q.set(k,params.get(k));
  try{
    const data=await api('dynamics?'+q);if(request!==requestId||!$('#results'))return;
    dynamicsCleanup();$('#count').textContent=`${lang==='ru'?'Матчей с победителем':'Matches with a winner'}: ${num(data.totals.matches)}`;
    $('#results').innerHTML=dynamicsPage(data,{lang,link,params});
    dynamicsCleanup=mountDynamics($('#results'),data,{lang,link,params,
      onSelect:key=>{params.set('trendPoint',key);writeLocation();},
      onTable:open=>{params.set('trendTable',open?'1':'0');writeLocation();}
    });
  }catch(e){if(request===requestId&&$('#results')){$('#results').innerHTML=`<div class="error">${t('error')} <button id="retry">${t('retry')}</button></div>`;$('#retry').onclick=refreshDynamics;}}
}

async function refresh(){if(view==='dynamics')return refreshDynamics();const request=++requestId,q=new URLSearchParams();for(const k of qfields)if(params.has(k))q.set(k,params.get(k));if(view==='rating'&&rankingMode()==='forfeits')q.delete('status');if(view==='players')q.set('playerSearch','1');if(defeatView()){q.set(view==='botdefeats'?'botDefeats':'humanDefeats','1');q.set('sort_matches',params.get('sort_'+view)||'margin');q.set('dir_matches',params.get('dir_'+view)||'desc');}try{const [r,s,v]=await Promise.all([api('matches?'+q),api('summary?'+q),view==='victims'?api('victims?'+q):null]);if(request!==requestId||!$('#results'))return;$('#kpis').innerHTML=kpis(s);$('#count').textContent=view==='players'?`${num(s.players.filter(p=>!p.isBot).length)} ${lang==='ru'?'участников':'players'}`:v?`${num(v.total)} ${t('pairs')}`:`${num(r.total)} ${t('results')}`;const latest=(defeatView()||params.has('sort_matches')&&params.get('sort_matches')!=='date'||params.get('dir_matches')==='asc'||Number(params.get('page'))>1)?(await api('matches?'+new URLSearchParams([...q].filter(([k])=>!['sort_matches','dir_matches','page'].includes(k))))).items[0]:r.items[0];$('#latest').innerHTML=latest?`<div class="mini-label"><span>${t('latest')}</span><span>${esc(latest.map)}</span></div><div class="latest-match"><div class="hero-score">${person(latest.participants[0],latest)}<a class="score-link" ${link({match:latest.id})} aria-label="${t('details')}">${score(latest)}</a>${person(latest.participants[1],latest)}</div><div class="mini-label"><span>${esc(date(latest.startedAt))}</span>${badge(latest)}</div></div>`:`<p>${t('empty')}</p>`;
  $('#results').innerHTML=view==='players'?playersPage(s,{lang,params,link,badges}):view==='victims'?victimResults(v):defeatView()?defeatResults(r):view==='matches'?(r.items.length?`<div class="match-list">${matchHeaders()}${r.items.map(matchRow).join('')}</div><div class="pagination"><button data-page="${r.page-1}" ${r.page<=1?'disabled':''}>${t('prev')}</button><span>${t('page')} ${r.page} ${t('of')} ${r.pages}</span><button data-page="${r.page+1}" ${r.page>=r.pages?'disabled':''}>${t('next')}</button></div>`:`<div class="empty">${t('empty')}</div>`):ratingLeaders(s);
  document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{params.set('page',b.dataset.page);writeLocation('push');refresh();});
  mountAchievementBadges();
}catch(e){if($('#results'))$('#results').innerHTML=`<div class="error">${t('error')} <button id="retry">${t('retry')}</button></div>`;if($('#retry'))$('#retry').onclick=refresh;}}
function mountFilters(){for(const [selector,key] of [['.primary-filters','filters'],['.advanced','advanced']]){const section=$(selector);section.ontoggle=()=>{if(!section.isConnected)return;params.set(key,section.open?'1':'0');writeLocation();};}for(const k of qfields){const input=$('#f-'+k);if(input)input.value=params.get(k)||(k==='period'?'all':'');}let debounce;
  const submit=()=>{for(const [k,v]of new FormData($('#filters'))){if(v)params.set(k,v);else params.delete(k);}params.delete('page');writeLocation();refresh();};
  $('#filters').onsubmit=e=>{e.preventDefault();clearTimeout(debounce);submit();};$('#filters').onchange=e=>{if(e.target.id==='f-period'&&e.target.value!=='custom'){$('#f-from').value='';$('#f-to').value='';}if(e.target.id==='f-from'||e.target.id==='f-to')$('#f-period').value='custom';submit();};$('#f-q').oninput=()=>{clearTimeout(debounce);debounce=setTimeout(submit,300);};
  $('#reset').onclick=()=>{qfields.forEach(k=>params.delete(k));writeLocation();render();};$('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);$('#copy').textContent=t('copied');}catch(e){$('#copy').textContent=t('copy');window.prompt(t('copy'),location.href);}};
}
function chart(m){
  const data=completeScoreHistory(m);
  if(!data.length)return `<p class="sub">${t('unknown')}</p>`;
  const W=640,H=190,L=60,R=16,T=12,B=32,maxT=Math.max(1,m.timelineDurationMs??(m.endMs-m.startMs),data.at(-1).timeMs);
  const {min,max,ticks}=scoreAxis(data),x=ms=>L+ms/maxT*(W-L-R),y=s=>H-B-(s-min)/(max-min)*(H-T-B);
  let svg='';
  for(const v of ticks){const yy=y(v);svg+=`<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="var(--border)"/><text class="score-tick" x="${L-10}" y="${yy+4}" text-anchor="end">${v}</text>`;}
  for(let i=0;i<5;i++){const t0=maxT*i/4;svg+=`<text x="${x(t0)}" y="${H-4}" text-anchor="${i===4?'end':i===0?'start':'middle'}">${time(t0/1000)}</text>`;}
  for(let p=0;p<2;p++){
    let d=`M ${x(data[0].timeMs)} ${y(data[0].scores[p])}`;
    for(const a of data.slice(1))d+=` H ${x(a.timeMs)} V ${y(a.scores[p])}`;
    d+=` H ${x(maxT)}`;
    const color=p?'var(--orange)':'var(--accent)',score=data.at(-1).scores[p];
    svg+=`<path data-player="${p}" d="${d}" fill="none" stroke="${color}" stroke-width="2.5"${p?' stroke-dasharray="6 3"':''}/><circle class="score-end" data-player="${p}" data-score="${score}" cx="${x(maxT)}" cy="${y(score)}" r="4" fill="${color}"><title>${esc(m.participants[p].name)}: ${score}</title></circle>`;
  }
  const result=m.participants.map((p,i)=>`${esc(p.name)}: ${data.at(-1).scores[i]}`).join(' · ');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${t('scoreProgress')}. ${result}"><title>${t('scoreProgress')}. ${result}</title>${svg}</svg><div class="legend">${m.participants.map((p,i)=>`<span>${esc(p.name)} — <b>${data.at(-1).scores[i]}</b></span>`).join('')}</div>`;
}
function compare(label,a,b){const total=(a||0)+(b||0),ratio=total?(a||0)/total*100:50;return `<div class="compare"><div class="compare-label"><b>${num(a)}</b><span>${esc(label)}</span><b>${num(b)}</b></div><svg class="bars" viewBox="0 0 100 5" preserveAspectRatio="none" aria-hidden="true"><rect width="${Math.max(0,ratio-.3)}" height="5" fill="var(--accent)"/><rect x="${ratio+.3}" width="${Math.max(0,100-ratio-.3)}" height="5" fill="var(--orange)"/></svg></div>`;}
function difficultyNote(m){
  const d=botDifficulty(m),i=m.participants.findIndex(p=>!p.isBot);
  if(!d.known&&(m.status!=='completed'||m.ratingExcluded||m.winnerIndex===null||matchPoints(m,i)!==null))return '';
  const attrs=link({view:'about',match:null,profile:null,kind:null,page:null},{hash:'#difficulty'});
  return `<div class="rating-context">${d.known?(lang==='ru'?`Средний скилл по времени: <b>${num(d.averageSkill,2)}</b> · K = <b>${num(d.factor,4)}</b> · База шкалы: ${d.reference}`:`Time-weighted skill: <b>${num(d.averageSkill,2)}</b> · K = <b>${num(d.factor,4)}</b> · Reference: ${d.reference}`):(lang==='ru'?'В записи не хватает данных о скилле бота для расчёта очков человека. Подтверждённый результат сохранён.':'The recording lacks reliable bot skill data for calculating human points. The confirmed result is retained.')} <a class="button-link" ${attrs}>${t('aboutRating')} →</a></div>`;
}
function matchDurationBlock(m){
  const duration=victoryDuration(m),full=duration.known,seconds=full?duration.seconds:m.recordedSeconds;
  const value=Number.isFinite(seconds)?`${Math.floor(seconds/60)} ${lang==='ru'?'мин':'min'} ${String(Math.floor(seconds%60)).padStart(2,'0')} ${lang==='ru'?'с':'s'}`:t('unknown');
  const label=full?(lang==='ru'?'Длительность матча':'Match duration'):(lang==='ru'?'Длительность записи':'Recording duration');
  const note=full?(lang==='ru'?'Игровое время без разминки и пауз':'Playing time without warmup or pauses'):(lang==='ru'?'Полная длительность матча не подтверждена':'Full match duration is not confirmed');
  return `<div class="match-duration" data-duration-kind="${full?'match':'recording'}"><span class="duration-label">${label}</span><strong class="duration-value">${value}</strong><span class="duration-note">${note}${full&&m.overtime?(lang==='ru'?' · Включая овертайм':' · Including overtime'):''}</span></div>`;
}
function durationAwardNote(m){
  const i=m.participants.findIndex(p=>!p.isBot);
  if(m.status!=='completed'||m.ratingExcluded||m.winnerIndex!==i)return '';
  const duration=victoryDuration(m),d=botDifficulty(m),attrs=link({view:'about',match:null,profile:null,kind:null,page:null},{hash:'#duration'});
  let text;
  if(!duration.known)text=lang==='ru'?'Полная длительность матча неизвестна: очки за победу не рассчитаны. Подтверждённая победа сохранена.':'Full match duration is unknown: win points could not be calculated. The confirmed win is retained.';
  else if(duration.basePoints===0)text=lang==='ru'?'Победа за матч короче 2 минут: 0 очков. Победа и завершённый матч остаются в статистике.':'Win in a match shorter than 2 minutes: 0 points. The win and completed match remain in the statistics.';
  else text=(lang==='ru'?`Очки за победу: <b>${num(duration.basePoints,4)}</b> за длительность`:`Win points: <b>${num(duration.basePoints,4)}</b> for duration`)+(d.known?` × ${num(d.factor,4)} (${lang==='ru'?'скилл':'skill'}) = <b>+${num(matchPoints(m,i),2)}</b>`:'');
  return `<div class="rating-context duration-award">${text} <a class="button-link" ${attrs}>${t('aboutRating')} →</a></div>`;
}

function playerDetail(p,m){return `<div class="player" data-player-kind="${p.isBot?'bot':'human'}"><span class="type">${p.isBot?t('botType'):t('human')}</span><div class="name">${esc(p.name)}</div>${badges(p)}${forfeitLoss(p,m)}<div class="meta">${p.isBot?`${t('skill')} <b>${esc(skill(p))}</b> · ${esc(p.styleVariable?t('variable'):(p.style||'—'))}`:t('human')}</div><div class="meta ping">${t('ping')}: ${p.ping?`${num(p.ping.averageMs,1)} ms`:'—'}</div></div>`;}
function weapons(m){const p=m.participants[selectedWeaponPlayer],columns=[{key:'name',label:t('weapons'),text:true,value:w=>item(w.name),render:w=>esc(item(w.name))},{key:'accuracy',label:t('accuracy'),value:w=>w.shots?w.hits/w.shots:(Number.isFinite(w.accuracyPercent)?w.accuracyPercent/100:null),render:w=>w.shots?num(w.hits/w.shots*100,1)+'%':Number.isFinite(w.accuracyPercent)?num(w.accuracyPercent)+'%':'—'},{key:'hits',label:t('hits'),value:w=>w.shots===null?null:[w.hits,w.shots],render:w=>w.hits===null||w.shots===null?'—':`${num(w.hits)} / ${num(w.shots)}`},...['kills','deaths','damageDealt','damageReceived'].map((key,i)=>({key,label:t(['kills','deaths','damage','received'][i]),value:w=>w[key],render:w=>num(w[key])}))];return `<div class="toggle">${m.participants.map((x,i)=>`<button data-weapon-player="${i}" class="${selectedWeaponPlayer===i?'active':''}">${esc(x.name)}</button>`).join('')}</div>`+renderTable('weapons'+selectedWeaponPlayer,columns,p.stats?.weapons||[],{params,lang,defaultKey:'name',defaultDir:'asc'});}
function botWinContext(m){
  if(!['completed','forfeit'].includes(m.status)||!Number.isInteger(m.winnerIndex)||m.ratingExcluded||!m.participants[m.winnerIndex].isBot)return '';
  const p=botWinAward(m),attrs=link({view:'about',match:null,profile:null,kind:null,page:null},{hash:'#bot-wins'});
  const text=p.known?(lang==='ru'?`Награда боту: <b>+${pointNum(p.points)}</b> = ${num(p.basePoints,4)} за длительность × ${num(p.averageSkill,2)} / ${p.maximumSkill} (скилл).`:`Bot win award: <b>+${pointNum(p.points)}</b> = ${num(p.basePoints,4)} for duration × ${num(p.averageSkill,2)} / ${p.maximumSkill} (skill).`):(lang==='ru'?'Не хватает данных о полном времени или скилле для начисления очков боту. Победа сохранена.':'Full duration or skill data is insufficient to calculate the bot award. The win is recorded.');
  return `<div class="rating-context bot-win-context">${text} <a ${attrs}>${t('aboutRating')} →</a></div>`;
}
function botLossContext(m){
  if(m.status!=='completed'||!Number.isInteger(m.winnerIndex)||m.ratingExcluded||m.participants[m.winnerIndex].isBot)return '';
  const p=botLossPenalty(m),attrs=link({view:'about',match:null,profile:null,kind:null,page:null},{hash:'#bot-loss'});
  const text=p.known?(lang==='ru'?`Штраф боту за поражение: <b>${num(p.points,4)}</b> · Средний скилл ${num(p.averageSkill,2)} из ${p.maximum}.`:`Bot loss penalty: <b>${num(p.points,4)}</b> · Average skill ${num(p.averageSkill,2)} out of ${p.maximum}.`):(lang==='ru'?'Не хватает данных о скилле для расчёта штрафа боту. Поражение сохранено; штраф не придуман.':'Skill data is insufficient to calculate the bot loss penalty. The loss is recorded; no penalty is guessed.');
  return `<div class="rating-context bot-loss-context">${text} <a ${attrs}>${t('aboutRating')} →</a></div>`;
}
function forfeitContext(m){
  if(m.status!=='forfeit')return '';
  const reasons=lang==='ru'?{restart:'Перезапуск матча',abort:'Отмена матча',map_change:'Досрочная смена карты',human_departure:'Выход игрока из матча'}:{restart:'Match restart',abort:'Match abort',map_change:'Early map change',human_departure:'Player left the match'};
  const reason=reasons[m.endReason]||(m.resultCorrection==='interrupted_as_forfeit'?(lang==='ru'?'Прерванная игра: forfeit по правилу BotStats':'Interrupted game: forfeit under BotStats rules'):null);
  return `<div class="warning forfeit-context">${reason?esc(reason)+'. ':''}${lang==='ru'?'Техническое поражение человека и победа бота независимо от счёта. Показан счёт до прерывания.':'The human forfeits and the bot wins regardless of the score. Scores are from before the interruption.'}</div>`;
}
async function detail(id,epoch){const m=await api('matches/'+encodeURIComponent(id));if(epoch!==renderEpoch)return;const [a,b]=m.participants;const controls=[...new Set(m.participants.flatMap(p=>p.stats?.control.map(x=>x.name)||[]))];const pickups=[...new Set(m.participants.flatMap(p=>p.stats?.pickups.map(x=>x.name)||[]))];const pick=(p,n)=>p.stats?(p.stats.pickups.find(x=>x.name===n)?.count??(p.stats.format==='legacy'?null:0)):null;
  $('#content').innerHTML=`<a class="back" ${link({match:null})}>${t('back')}</a><div class="detail-top"><div><div class="eyebrow">${esc(m.map)} · ${badge(m)}</div><h1>${t('match')} ${esc(date(m.startedAt))}</h1><div class="subtle">${m.modVersion?'OpenTDM-X Beta '+esc(m.modVersion):t('noVersion')} · ${lang==='ru'?'МСК':'MSK'}</div></div><a class="download" href="${base}/api/demos/${m.demo.sha256}">${t('download')}</a></div>${matchDurationBlock(m)}<section class="detail-score">${playerDetail(a,m)}${score(m)}${playerDetail(b,m)}</section>
  ${m.ratingExcluded?`<div class="warning">${t('opponentChanged')}</div>`:''}${m.overtime?`<div class="warning overtime-result">${t('overtimeResult')} · ${m.participants.map(p=>p.score).join(' : ')} · ${t(m.overtimeKind==='sudden_death'?'suddenDeath':'overtime')}</div>`:''}${forfeitContext(m)}${matchRatingAwards(m)}${botWinContext(m)}${botLossContext(m)}${durationAwardNote(m)}${difficultyNote(m)}${m.status==='interrupted'?`<div class="warning">${t('interruptedNote')}</div>`:''}${!m.statsComplete?`<div class="warning">${t('noStats')}</div>`:''}${!m.startObserved?`<div class="warning">${t('partial')}</div>`:''}${m.statsFormat==='legacy'?`<p class="footnote">${t('legacyStatsNote')}</p>`:''}
  <div class="detail-grid"><section class="panel"><h2>${t('scoreProgress')}</h2>${chart(m)}</section><section class="panel"><h2>${t('comparison')}</h2>${[['damage','damageDealt'],['received','damageReceived'],['kills','kills'],['deaths','deaths'],['suicides','suicides']].map(([label,k])=>compare(t(label),a.stats?.[k],b.stats?.[k])).join('')}<p class="sub">${t('damageNote')}</p></section></div>
  <section class="panel"><h2>${t('weapons')}</h2><div id="weapons">${weapons(m)}</div></section>
  <section class="panel"><h2>${t('control')}</h2><div class="legend"><span>${esc(a.name)}</span><span>${esc(b.name)}</span></div><div class="items">${controls.map(n=>compare(item(n),a.stats?.control.find(x=>x.name===n)?.pickups,b.stats?.control.find(x=>x.name===n)?.pickups)).join('')}</div><details class="pickup-details" ${params.get('pickups')==='1'?'open':''}><summary>${t('items')}</summary><div class="items">${pickups.map(n=>compare(item(n),pick(a,n),pick(b,n))).join('')}</div></details><p class="sub">${t(m.statsFormat==='legacy'?'legacyItemsNote':'itemsNote')}</p></section>
  <div class="detail-grid"><section class="panel"><h2>${t('settings')}</h2>${m.participants.filter(p=>p.isBot).map(p=>`<h3>${esc(p.profile)} · ${t('skillTimeline')} ${esc(skill(p))}</h3><div class="skill-timeline">${(p.skillTimeline||[]).map(s=>`<div class="skill-interval">${time(s.fromMs/1000)}–${time(s.toMs/1000)} <strong>${s.value}</strong></div>`).join('')}</div>${p.settingsHistory.filter(x=>x.kind==='style').map(x=>`<p class="sub">${time((x.matchMs??(x.timeMs-m.startMs))/1000)} · ${esc(x.value)}</p>`).join('')}`).join('')}<h3>${t('ping')}</h3>${m.participants.map(p=>`<p class="sub"><b>${esc(p.name)}</b>: ${p.ping?`${num(p.ping.averageMs,1)} ms · min ${p.ping.minMs} / max ${p.ping.maxMs}<br>${p.ping.samples} ${t('observed')} · ${num(p.ping.observedSeconds,1)} ${t('coverage')}`:t('noPing')}</p>`).join('')}<p class="sub">${t('pingNote')}</p></section><section class="panel"><h2>${t('events')}</h2><ol class="events">${m.events.map(e=>`<li><time>${time(e.timeMs/1000)}</time><span>${esc(e.text)}</span></li>`).join('')}</ol><p class="sub">${t('rawEvents')}</p></section></div>`;
  const pickupDetails=$('.pickup-details');if(pickupDetails)pickupDetails.ontoggle=()=>{if(!pickupDetails.isConnected)return;params.set('pickups',pickupDetails.open?'1':'0');writeLocation();};const hook=()=>document.querySelectorAll('[data-weapon-player]').forEach(x=>x.onclick=()=>{selectedWeaponPlayer=+x.dataset.weaponPlayer;params.set('weapon',selectedWeaponPlayer);writeLocation();$('#weapons').innerHTML=weapons(m);hook();});hook();
}
Object.assign(dict.ru,{ratingNote:'Forfeit всегда означает поражение человека и победу бота. Они уже входят в общие итоги; отдельная колонка показывает их количество. Овертайм — дополнительное время при равном счёте, включая Sudden Death. Средние очки за матч считаются только по играм, для которых удалось определить очки.'});
Object.assign(dict.en,{ratingNote:'A forfeit always means a human loss and a bot win. These are included in the totals and also shown in a separate column. Overtime is extra time after a tied score, including Sudden Death. Average points per match uses only games whose point award could be determined.'});
let renderEpoch=0;
async function render(){
  dynamicsCleanup();
  const epoch=++renderEpoch;requestId++;preferences();$('#content').setAttribute('aria-busy','true');
  try{
    if(view==='about'){$('#content').innerHTML=aboutPage(lang,link({view:null,match:null,profile:null,kind:null,page:null}));if(location.hash)document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();return;}
    awardCatalog=await api('achievements');if(epoch!==renderEpoch)return;
    if(view==='achievements'&&!params.has('match')&&!params.has('profile')){await showAchievements(epoch);return;}
    if(params.has('profile')&&!params.has('match')){await profile(epoch);if(epoch===renderEpoch&&location.hash==='#profile-achievements')document.getElementById('profile-achievements')?.scrollIntoView();return;}
    if(params.has('match')){await detail(params.get('match'),epoch);return;}
    const nextFacets=await api('facets');if(epoch!==renderEpoch)return;facets=nextFacets;
    $('#content').innerHTML=listShell();mountOverview();mountFilters();await refresh();
  }catch(e){if(epoch===renderEpoch){$('#content').innerHTML=`<div class="error">${t('error')}<br><button id="retry">${t('retry')}</button></div>`;$('#retry').onclick=render;}}
  finally{if(epoch===renderEpoch){mountAchievementBadges();$('#content').setAttribute('aria-busy','false');}}
}
document.addEventListener('click',e=>{
  const link=e.target.closest('[data-view]');if(!link||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button)return;
  e.preventDefault();view=link.dataset.view;params.set('view',view);for(const key of ['match','profile','kind','achievement','awardPlayer','awardPage','page'])params.delete(key);writeLocation('push');render();
});
let achievementSearchTimer;
async function showAchievements(epoch){
  const id=params.get('achievement');let body;
  if(id){let value;try{value=await api('achievements/'+encodeURIComponent(id)+'?'+new URLSearchParams({player:params.get('awardPlayer')||'',page:params.get('awardPage')||'1',sort_award_evidence:params.get('sort_award_evidence')||'date',dir_award_evidence:params.get('dir_award_evidence')||'asc',lang}));}catch(e){if(e.message!=='HTTP 404')throw e;value=null;}if(epoch!==renderEpoch)return;body=achievementPage(value,{lang,link,params});if(value)document.title=value.name[lang]+' · BotStats';}
  else body=achievementsPage(awardCatalog,{lang,link,params});
  $('#content').innerHTML=`<section class="workspace achievements-workspace"><div class="workspace-head">${navigation()}</div>${body}</section>`;
  const input=$('#achievement-search');if(input)input.oninput=()=>{clearTimeout(achievementSearchTimer);achievementSearchTimer=setTimeout(async()=>{const value=input.value,position=input.selectionStart;if(value)params.set('achievementSearch',value);else params.delete('achievementSearch');writeLocation();await render();const next=$('#achievement-search');if(next){next.focus({preventScroll:true});if(position!==null)next.setSelectionRange(position,position);}},250);};
}
writeLocation();
render();
