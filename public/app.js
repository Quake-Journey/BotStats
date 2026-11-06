import {modeBadges,modesDetail} from './modes-ui.js';
import {gameplayDetail,mountGameplayDetails} from './gameplay-ui.js';
import {onlinePage,mountOnline} from './online-ui.js';
import {profileMatchQuery,matchPagination} from './pagination.js';
import {profileSummaryQuery,profileStanding} from './profile-rating.js';
import {mountProfileAwardMotion} from './profile-award-motion.js';
import {modeDifficulty} from './match-modes.js';
import {playersPage} from './players-ui.js';
import {performancePolicy} from './performance-rating.js';
import {createNavigation,profileSection} from './navigation.js';
import {botAvatar} from './bot-avatars.js';
import {aboutPage} from './about.js';
import {dynamicsPage,mountDynamics} from './dynamics-ui.js';
import {winsWithHistory,overviewHistory} from './win-history.js';
import {winBalance} from './win-balance.js';
import {winCount,winConditionsColumn,completedWithDuration} from './count-context.js';
import {achievementBadges,achievementProfile,achievementsPage,achievementPage,mountAchievementBadges} from './achievements-ui.js';
let awardCatalog={items:[]};
import {completeScoreHistory,scoreAxis} from './score-history.js';
import {renderTable,sortState,sortButton,compactSort} from './tables.js';
import {ratingPolicy,matchPoints,victoryPoints,victoryDuration,botDifficulty,botLossPenalty,botWinAward,rankParticipants,rankMaps} from './rating.js';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const currentPath=location.pathname.replace(/\/$/,''),base=currentPath.endsWith('/about')?currentPath.slice(0,-6):currentPath,params=new URLSearchParams(location.search);
if(currentPath.endsWith('/about'))params.set('view','about');
let lang=window.botstatsLang||'ru',theme=window.botstatsTheme||'auto',facets={},view=params.get('view')||(params.has('ranking')?'rating':'home'),selectedWeaponPlayer=Number(params.get('weapon'))===1?1:0;
const dict={
ru:{mainSite:'Основной сайт ↗',theme:'Тема',auto:'Системная',dark:'Тёмная',light:'Светлая',footer:'Реальные матчи. Статистика из MVD.',eyebrow:'Человек против бота',title:'Каждый матч.<br><span>В деталях.</span>',intro:'Кто точнее стрелял, кто забирал броню и как менялся счёт. Вся история противостояния с ботами Q2PRO-X.',latest:'Последний матч',matches:'Матчи',players:'Игроки',bots:'Боты',allMatches:'Всего матчей',humanWins:'Победы людей',botWins:'Победы ботов',gameTime:'Время в игре',minutes:'мин',finished:'завершённых',interruptedShort:'прервано',results:'матчей',all:'Все',search:'Игрок или бот',searchHint:'Ник, например q или David…',map:'Карта',bot:'Бот',style:'Стиль',skill:'Скилл',version:'Версия мода',status:'Результат',from:'С даты',to:'По дату',moreFilters:'Скилл, версия, даты и результат',reset:'Сбросить',copy:'Скопировать ссылку',copied:'Скопировано',apply:'Найти',match:'Матч',date:'Дата',duration:'Длительность',completed:'Завершён',forfeit:'Forfeit',interrupted:'Прерван',variable:'Переменный',empty:'По этим условиям матчей пока нет.',error:'Не удалось загрузить статистику.',retry:'Повторить',back:'← Все матчи',download:'↓ Скачать MVD',human:'Игрок',botType:'Бот',scoreProgress:'Как менялся счёт',comparison:'Итоги матча',damage:'Нанесённый урон',received:'Полученный урон',kills:'Убийства',deaths:'Смерти',suicides:'Самоубийства',telefrags:'Телефраги',weapons:'Оружие',accuracy:'Точность',hits:'Попадания / выстрелы',items:'Подборы предметов',control:'Контроль главных предметов',events:'События матча',settings:'Настройки бота по ходу матча',ping:'Средний пинг',pingNote:'По записям таблицы счёта; одно значение учитывается не дольше 5 секунд. Это не непрерывный сетевой замер.',observed:'наблюдений',coverage:'сек. наблюдения',noStats:'Подробная итоговая статистика урона, оружия и подборов в этой записи отсутствует или неполна. Это не мешает учитывать подтверждённый результат и рейтинг при достаточных данных для расчёта.',partial:'Начало матча в записи не подтверждено. Указана длительность записанного фрагмента.',interruptedNote:'Матч прерван. Показан последний зафиксированный счёт; победа по нему автоматически не начисляется.',noVersion:'Версия не записана',serverTime:'Время сервера · МСК',ratingNote:'Сортировка по победам. Процент побед — только по завершённым матчам. Прерванные игры сохраняются отдельно; очки Competition не применяются.',wins:'Победы',losses:'Поражения',winRate:'Победы, %',averageScore:'Средний счёт',averageDamage:'Средний урон',details:'Открыть матч',prev:'← Назад',next:'Далее →',page:'Страница',of:'из',unknown:'Нет данных',player:'Участник',fullStats:'с полной статистикой',itemsNote:'Количество фактических подборов, включая выпавшие предметы. Контроль — счётчики подбора предметов карты.',damageNote:'Полученный урон включает урон от собственных выстрелов по правилам серверной статистики.',skillTimeline:'Скилл',styleTimeline:'Изменения стиля',recorded:'записанный фрагмент',rawEvents:'Сообщения сервера приведены в оригинале.',allMaps:'Все карты',matchCount:'Матчей',showProfile:'Матчи участника',noPing:'Пинг не записан',loading:'Загрузка матчей…',json:'Скачать JSON',rounds:'За выбранный период'},
en:{mainSite:'Main website ↗',theme:'Theme',auto:'System',dark:'Dark',light:'Light',footer:'Real matches. Statistics from MVD.',eyebrow:'Human versus bot',title:'Every match.<br><span>Every detail.</span>',intro:'Accuracy, armor control and every turn of the score. Explore your matches against Q2PRO-X bots.',latest:'Latest match',matches:'Matches',players:'Players',bots:'Bots',allMatches:'Total matches',humanWins:'Human wins',botWins:'Bot wins',gameTime:'Time played',minutes:'min',finished:'finished',interruptedShort:'interrupted',results:'matches',all:'All',search:'Player or bot',searchHint:'Nickname, e.g. q or David…',map:'Map',bot:'Bot',style:'Style',skill:'Skill',version:'Mod version',status:'Result',from:'From date',to:'To date',moreFilters:'Skill, version, dates and result',reset:'Reset',copy:'Copy link',copied:'Copied',apply:'Search',match:'Match',date:'Date',duration:'Duration',completed:'Finished',forfeit:'Forfeit',interrupted:'Interrupted',variable:'Variable',empty:'No matches match these filters yet.',error:'Could not load statistics.',retry:'Retry',back:'← All matches',download:'↓ Download MVD',human:'Player',botType:'Bot',scoreProgress:'Score over time',comparison:'Match summary',damage:'Damage dealt',received:'Damage received',kills:'Kills',deaths:'Deaths',suicides:'Suicides',telefrags:'Telefrags',weapons:'Weapons',accuracy:'Accuracy',hits:'Hits / shots',items:'Item pickups',control:'Major item control',events:'Match events',settings:'Bot settings throughout the match',ping:'Average ping',pingNote:'From scoreboard observations; a value is held for at most 5 seconds. This is not a continuous network measurement.',observed:'observations',coverage:'seconds observed',noStats:'Detailed final damage, weapon and pickup statistics are missing or incomplete in this recording. A confirmed result can still count towards ratings when the required scoring data is available.',partial:'The start of this match is not confirmed in the recording. Duration refers to the recorded fragment.',interruptedNote:'The match was interrupted. This is the last recorded score; it does not automatically count as a win.',noVersion:'Version not recorded',serverTime:'Server time · MSK',ratingNote:'Sorted by wins. Win rate uses finished matches only. Interrupted matches are retained separately; Competition points are not applied.',wins:'Wins',losses:'Losses',winRate:'Win rate, %',averageScore:'Average score',averageDamage:'Average damage',details:'Open match',prev:'← Previous',next:'Next →',page:'Page',of:'of',unknown:'Unavailable',player:'Participant',fullStats:'with full stats',itemsNote:'Actual pickup counts, including dropped items. Control uses the server counters for map items.',damageNote:'Received damage includes self-damage, following the server statistics.',skillTimeline:'Skill',styleTimeline:'Style changes',recorded:'recorded fragment',rawEvents:'Server messages are shown in their original language.',allMaps:'All maps',matchCount:'Matches',showProfile:'Participant matches',noPing:'Ping not recorded',loading:'Loading matches…',json:'Download JSON',rounds:'For the selected period'}
};
Object.assign(dict.ru,{interrupted:'Нет результата',interruptedNote:'По правилу BotStats прерванная игра человека с ботом считается forfeit: техническое поражение человека и победа бота независимо от счёта.'});
Object.assign(dict.en,{interrupted:'No result',interruptedNote:'Under BotStats rules, an interrupted human-versus-bot game counts as a forfeit: the human loses and the bot wins regardless of the score.'});
Object.assign(dict.ru,{home:'Главная'});
Object.assign(dict.en,{home:'Home'});
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
function forfeitLoss(p,m,compact=false){
  if(p.isBot||m?.status!=='forfeit')return '';
  const index=m.participants.indexOf(p);
  const lost=Number.isInteger(m.winnerIndex)?m.winnerIndex!==index:m.forfeitBy===p.name;
  return lost?`<span class="badge forfeit participant-result" data-outcome="forfeit-loss"${compact?` title="${t('technicalLoss')}" aria-label="${t('technicalLoss')}"`: ''}>${compact?'forfeit':t('technicalLoss')}</span>`:'';
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
function rankingChoices(){if(overviewMobile.matches)return `<label class="ranking-picker">${t('rating')}<select data-ranking-choice>${['victory','average','forfeits','activity','maps'].map(mode=>`<option value="${mode}" ${rankingMode()===mode?'selected':''}>${t(mode==='forfeits'?'forfeitRanking':mode)}</option>`).join('')}</select></label>`;return `<nav class="ranking-choices" aria-label="${t('rating')}">${['victory','average','forfeits','activity','maps'].map(mode=>`<a ${link({view:'rating',ranking:mode,page:null})} aria-current="${rankingMode()===mode?'page':'false'}">${t(mode==='forfeits'?'forfeitRanking':mode)}</a>`).join('')}</nav>`;}

function ratingExplanation(bot,victory=false){const attrs=link({view:'about',match:null,profile:null,kind:null,page:null},{hash:bot?'#bot-wins':victory?'#duration':'#performance'});if(victory)return `<a class="button-link" ${attrs}>${t('aboutRating')} →</a>`;return (lang==='ru'?(bot?'Базовые очки ботов до поправки за режимы. На максимальном скилле: победа +0,1…+10; forfeit +0,05…+5. Награда растёт от 2 до 10 минут и умножается на долю скилла от собственного максимума. Поражение −0,01…−1.':'Индекс силы игры от 0 до 100, не процент побед и не сумма очков. Учитывает результаты против ботов и малое число игр. Forfeit — в отдельном антирейтинге.'):(bot?'Base bot points before mode adjustments. At maximum skill: win +0.1…+10; forfeit +0.05…+5. Rewards grow from 2 to 10 minutes and scale with skill relative to the bot’s own maximum. Loss −0.01…−1.':'Playing-strength index from 0 to 100, not a win percentage or accumulated points. It reflects results against bots with a small-sample adjustment. Forfeits have a separate anti-ranking.'))+` <a class="button-link" ${attrs}>${bot?(lang==='ru'?'Правила начисления ботам →':'Bot scoring rules →'):lang==='ru'?'Как рассчитывается оценка →':'How the estimate is calculated →'}</a>`;}

function periodSelect(){return field('period','period',`<select id="f-period" name="period">${[['all','periodAll'],['today','periodToday'],['three','periodThree'],['week','periodWeek'],['month','periodMonth'],['year','periodYear'],['custom','periodCustom']].map(([v,k])=>`<option value="${v}">${t(k)}</option>`).join('')}</select>`);}

const t=k=>dict[lang][k]||k,num=(v,d=0)=>v===null||v===undefined?'—':Number(v).toLocaleString(lang,{maximumFractionDigits:d}),item=n=>lang==='ru'?(itemRu[n]||n):n;
const time=s=>`${Math.floor(Math.max(0,s)/60)}:${String(Math.floor(Math.max(0,s)%60)).padStart(2,'0')}`;
const date=s=>s?new Intl.DateTimeFormat(lang,{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'}).format(new Date(s)):'—';
const skill=p=>p.skillVariable?t('variable'):num(p.skill);
function botSettings(p,highlight=false){
  const value=v=>highlight?`<b>${esc(v)}</b>`:esc(v);
  if(p.skillVariable&&p.styleVariable)return lang==='ru'?`Скилл и стиль: ${value('переменные')}`:`Skill and style: ${value('variable')}`;
  return `${t('skill')}: ${value(skill(p))} · ${t('style')}: ${esc(p.styleVariable?t('variable'):(p.style||'—'))}`;
}
const resultBadge=m=>`<span class="badge ${esc(m.status)}">${t(m.status)}</span>${m.overtime?` <span class="badge overtime">${t(m.overtimeKind==='sudden_death'?'suddenDeath':'overtime')}</span>`:''}`;
const badge=m=>`<span class="match-context">${resultBadge(m)}${modeBadges(m,lang)}</span>`;
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
function applyTheme(){document.documentElement.dataset.theme=theme==='auto'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):theme;try{localStorage.setItem('botstats.theme',theme);}catch(e){}syncJudgment();}
function preferences(){document.documentElement.lang=lang;document.title=(view==='about'?t('aboutRating')+' · ':view==='achievements'?t('achievements')+' · ':(view==='dynamics'||view==='charts')?t(view)+' · ':(defeatView()||view==='victims'||view==='players'||view==='bots'||view==='rating')?t(view)+' · ':'')+'BotStats · Q2PRO-X';routes.bind($('.brand'),{}, {home:true});routes.bind($('#about-link'),{view:'about',match:null,profile:null,kind:null,page:null});$('#about-link').setAttribute('aria-current',view==='about'?'page':'false');document.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=t(el.dataset.i18n));$('#theme').value=theme;$('#language').value=lang;for(const o of $('#theme').options)o.textContent=({auto:'◐ ',dark:'☾ ',light:'☀ ',judgment:'◉ '}[o.value])+t(o.value);}
$('#theme').onchange=e=>{theme=e.target.value;applyTheme();writeLocation();};
$('#language').onchange=e=>{lang=e.target.value;try{localStorage.setItem('botstats.lang',lang);}catch(err){}writeLocation();preferences();render();};
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(theme==='auto')applyTheme();});
window.addEventListener('popstate',()=>{[...params.keys()].forEach(k=>params.delete(k));new URLSearchParams(location.search).forEach((v,k)=>params.set(k,v));if(location.pathname.replace(/\/$/,'').endsWith('/about'))params.set('view','about');view=params.get('view')||(params.has('ranking')?'rating':'home');lang=['ru','en'].includes(params.get('lang'))?params.get('lang'):lang;theme=['auto','dark','light','judgment'].includes(params.get('theme'))?params.get('theme'):theme;selectedWeaponPlayer=Number(params.get('weapon'))===1?1:0;applyTheme();routes.sync(document);render();});
function options(values,label=t('all')){return `<option value="">${esc(label)}</option>`+values.map(v=>`<option value="${esc(v)}">${esc(v==='variable'?t('variable'):v)}</option>`).join('');}
function field(key,label,content){return `<div class="field"><label for="f-${key}">${t(label)}</label>${content}</div>`;}
function select(key,label,values){return field(key,label,`<select id="f-${key}" name="${key}">${options(values)}</select>`);}
const overviewMobile=matchMedia('(max-width:800px)');
function isHome(){return view==='home'&&!params.has('match')&&!params.has('profile')&&!params.has('achievement');}
function hero(){return `<section class="overview" aria-label="${t('overview')}"><div class="overview-fold"><div class="kpis" id="kpis"></div></div><div class="overview-fold"><div class="hero-card" id="latest"><div class="loading">${t('loading')}</div></div></div></section>`;}
overviewMobile.addEventListener('change',()=>render());
document.addEventListener('toggle',event=>{const info=event.target;if(!info.matches?.('.rating-explanation')||!info.isConnected)return;const value=info.open?'1':'0';if(params.get('ratingInfo')!==value){params.set('ratingInfo',value);writeLocation();}},true);
function navigation(){return `<nav class="tabs" aria-label="${t('matches')}">${['home','rating','matches','online','players','bots','defeats','victims','botdefeats','dynamics','charts','achievements'].map(v=>`<a class="tab" data-view="${v}" ${link({view:v,match:null,profile:null,kind:null,achievement:null,awardPlayer:null,awardPage:null,page:null},v==='home'?{home:true}:{})} aria-current="${view===v?'page':'false'}" aria-selected="${view===v}">${t(v)}</a>`).join('')}</nav>`;}
function badges(p){return achievementBadges(awardCatalog,p.isBot?(p.profile||p.name.replace(/(?:\[\d+\]|>\d+)$/,'')):p.name,{lang,link,kind:p.isBot?'bot':'human'});}
function listShell(){
  const trend=view==='dynamics',graphs=view==='charts';
  const optional=trend?'':field('overtime','overtimeFilter',`<select id="f-overtime" name="overtime"><option value="">${t('all')}</option><option value="1">${t('overtimeOnly')}</option></select>`)+select('skill','skill',[...(facets.skills||[]),'variable']);
  const status=trend||graphs||(view==='rating'&&rankingMode()==='forfeits')?'':field('status','status',`<select id="f-status" name="status"><option value="">${t('all')}</option>${['completed','forfeit','interrupted'].map(s=>`<option value="${s}">${t(s)}</option>`).join('')}</select>`);
  const advancedKeys=trend?['modVersion','from','to']:['skill','modVersion','status','from','to','overtime'];
  const mobileFilters=overviewMobile.matches,activeFilters=qfields.filter(k=>params.get(k)&&!(k==='period'&&params.get(k)==='all')).length;
  const filterStart=mobileFilters?`<details class="mobile-filters" ${params.get('filterPanel')==='1'?'open':''}><summary>${lang==='ru'?'Фильтры':'Filters'}${activeFilters?` <b>· ${activeFilters}</b>`:''}</summary>`:'',filterEnd=mobileFilters?'</details>':'';
  return `<section class="workspace ${graphs?'charts-workspace':''}">${filterStart}<form id="filters" class="filter-panel"><details class="primary-filters" ${params.get('filters')==='1'?'open':''}><summary>${t('mainFilters')}</summary><div class="filters">${periodSelect()}${field('q',view==='players'?(lang==='ru'?'Ник игрока':'Player name'):'search',`<input id="f-q" name="q" type="search" placeholder="${view==='players'?(lang==='ru'?'Ник, например pp или q':'Name, for example pp or q'):t('searchHint')}" maxlength="80" autocomplete="off">`)}${select('map','map',facets.maps||[])}${select('bot','bot',facets.bots||[])}${select('style','style',facets.styles||[])}</div></details><details class="advanced" ${(params.has('advanced')?params.get('advanced')==='1':advancedKeys.some(k=>params.has(k)))?'open':''}><summary>${trend?(lang==='ru'?'Версия и даты':'Version and dates'):t('moreFilters')}</summary><div class="filters">${optional}${select('modVersion','version',facets.versions||[])}${status}${field('from','from','<input id="f-from" name="from" type="date">')}${field('to','to','<input id="f-to" name="to" type="date">')}</div></details><div class="filter-bottom"><button type="submit">${t('apply')}</button><button type="button" id="reset">${t('reset')}</button><button type="button" id="copy">${t('copy')}</button><span class="sub">${t('periodNote')}</span><span class="result-count" id="count"></span></div></form>${filterEnd}<div id="results"><div class="loading">${t('loading')}</div></div></section>`;
}
function compactIdentity(p){return `<a class="compact-match-player" data-player-kind="${p.isBot?'bot':'human'}" title="${esc(p.name)}" ${link({view:p.isBot?'bots':'players',profile:p.isBot?(p.profile||p.name):p.name,kind:p.isBot?'bot':'human',match:null,achievement:null,awardPlayer:null,awardPage:null})}><span>${esc(p.name)}</span></a>`;}
function compactDuelCard({attrs,left,center,right,info,marker='',details,label}){
  const more=lang==='ru'?'Подробнее':'Details';
  return `<article class="match-row compact-match" ${attrs}><div class="compact-match-duel">${left}${center}${right}</div><details class="compact-match-details"><summary aria-label="${esc(label)}"><span class="compact-match-info">${info}</span>${marker}<span class="compact-match-more">${more}</span></summary><div class="compact-match-expanded">${details}</div></details></article>`;
}
function compactMatch(m,attrs,{humanFirst=false,extraDetails=''}={}){
  const ru=lang==='ru',seconds=m.durationSeconds??m.recordedSeconds;
  const participants=humanFirst?[...m.participants].sort((a,b)=>Number(a.isBot)-Number(b.isBot)):m.participants;
  const shown={...m,participants,winnerIndex:Number.isInteger(m.winnerIndex)?participants.indexOf(m.participants[m.winnerIndex]):null};
  const loser=m.participants.find(p=>forfeitLoss(p,m));
  const loss=loser?`<span class="compact-match-forfeit" data-outcome="forfeit-loss" data-player-kind="human" title="${esc(loser.name)}: ${t('technicalLoss')}" aria-label="${esc(loser.name)}: ${t('technicalLoss')}">${ru?'Тех. пор.':'Forfeit'}</span>`:'';
  const settings=participants.map(p=>`<div><dt>${p.isBot?t('botType'):t('human')}</dt><dd>${esc(p.name)}${p.isBot&&(p.skill!==undefined||p.style!==undefined)?`<br>${botSettings(p)}`:''}</dd></div>`).join('');
  return compactDuelCard({attrs:`data-match="${esc(m.id)}"`,left:compactIdentity(participants[0]),right:compactIdentity(participants[1]),
    center:`<a class="score-link" ${attrs} aria-label="${t('details')}">${score(shown)}</a>`,marker:loss,
    info:`<span class="compact-match-map" title="${t('map')}: ${esc(m.map)}">${esc(m.map)}</span><span class="compact-match-duration" title="${t('duration')}" aria-label="${t('duration')}: ${seconds==null?'—':time(seconds)}"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 4v4l3 2"/></svg>${seconds==null?'—':time(seconds)}</span>`,
    details:`<dl>${settings}<div><dt>${t('date')}</dt><dd>${esc(date(m.startedAt))}</dd></div><div><dt>${t('status')}</dt><dd>${resultBadge(m)}</dd></div><div><dt>${ru?'Режимы':'Modes'}</dt><dd>${modeBadges(m,lang)}</dd></div><div><dt>${t('version')}</dt><dd>${m.modVersion?'Beta '+esc(m.modVersion):'—'}</dd></div>${extraDetails}</dl><a class="button-link" ${attrs}>${t('details')} ↗</a>`,
    label:`${ru?'Подробнее о матче':'Match details'}: ${participants[0].name} — ${participants[1].name}`});
}
function evidenceMatchRow(m){
  const human={name:m.human,isBot:false,score:m.score[0]},bot={name:m.bot,profile:m.bot.replace(/(?:\[\d+\]|>\d+)$/,''),isBot:true,score:m.score[1]};
  // Evidence is already human-first; retain only the outcome confirmed by it.
  const winnerIndex=m.status==='forfeit'?1:m.status==='completed'&&human.score!==bot.score?(human.score>bot.score?0:1):null;
  return matchRow({...m,participants:[human,bot],winnerIndex});
}

function matchRow(m){const attrs=link({view:'matches',match:m.id,profile:null,achievement:null,awardPlayer:null,awardPage:null});if(overviewMobile.matches)return compactMatch(m,attrs);return `<div class="match-row"><div><a ${attrs}><div class="map-name ${esc(m.map)}">${esc(m.map)}</div><div class="date">${esc(date(m.startedAt))}</div></a></div><div class="duel">${person(m.participants[0],m)}<a class="score-link" ${attrs} aria-label="${t('details')}">${score(m)}</a>${person(m.participants[1],m)}</div><div class="status">${badge(m)}</div><div class="row-meta"><span>${time(m.durationSeconds??m.recordedSeconds)}</span><br><span>${m.modVersion?'Beta '+esc(m.modVersion):'—'}</span></div><div class="chevron"><a ${attrs} aria-label="${t('details')}">↗</a></div></div>`;}
function person(p,m){return `<span class="person" data-player-kind="${p.isBot?'bot':'human'}"><span class="person-name"><a ${link({view:p.isBot?'bots':'players',profile:p.isBot?p.profile:p.name,kind:p.isBot?'bot':'human',match:null,achievement:null,awardPlayer:null,awardPage:null})}>${p.isBot?botAvatar(p.profile||p.name):''}<span class="bot-name-text">${esc(p.name)}</span></a></span>${badges(p)}${forfeitLoss(p,m)}<small>${p.isBot?botSettings(p):t('human')}</small></span>`;}
function topKiller(s){
  const bot=(s.players||[]).filter(p=>p.isBot&&p.wins>0).sort((a,b)=>b.wins-a.wins||a.name.localeCompare(b.name,'en'))[0];
  const label=lang==='ru'?'Главный бот-убийца:':'Top bot killer:';
  return `<div class="kpi-killer"><span class="kpi-killer-heading"><span class="kpi-killer-label">${label}</span> ${bot?`<a class="kpi-killer-name" ${link({view:'bots',profile:bot.name,kind:'bot',match:null,achievement:null,awardPlayer:null,awardPage:null,page:null})} title="${lang==='ru'?'Побед над людьми':'Wins over humans'}: ${num(bot.wins)}">${esc(bot.name)}</a>`:'<span class="kpi-killer-name">—</span>'}</span>${bot?badges({isBot:true,profile:bot.name,name:bot.name}):''}</div>`;
}
function compactKpis(s){
  const metric=(key,value)=>`<div class="kpi-metric" data-kpi="${key}"><span class="label">${key==='gameTime'?(lang==='ru'?'Время, мин':'Time, min'):t(key)}</span><span class="value">${num(value)}</span></div>`;
  return `<div class="kpi compact-kpi">${metric('allMatches',s.matches)}${metric('gameTime',s.minutes)}</div><div class="kpi compact-kpi">${metric('humanWins',s.humanWins)}${metric('botWins',s.botWins)}</div>`;
}
function compactLatest(m){
  const name=p=>`<a class="compact-latest-person ${p.isBot?'bot':'human'}" ${link({view:p.isBot?'bots':'players',profile:p.isBot?(p.profile||p.name):p.name,kind:p.isBot?'bot':'human',match:null,achievement:null,awardPlayer:null,awardPage:null})}>${esc(p.name)}</a>`;
  const seconds=m.durationSeconds??m.recordedSeconds;
  return `<div class="compact-latest-head"><b>${t('latest')}</b><span>${esc(m.map)}</span></div><div class="compact-latest-score">${name(m.participants[0])}<div><a class="score-link" ${link({view:'matches',match:m.id,profile:null,kind:null,achievement:null,awardPlayer:null,awardPage:null})} aria-label="${t('details')}">${score(m)} <span class="compact-latest-arrow">↗</span></a></div>${name(m.participants[1])}</div><div class="compact-latest-meta"><span>${esc(date(m.startedAt))}</span><span class="compact-latest-result">${resultBadge(m)}</span><span>${t('duration')}: ${seconds==null?'—':time(seconds)}</span></div>${modeBadges(m,lang)}`;
}
function kpis(s){if(overviewMobile.matches)return compactKpis(s);return [['allMatches',s.matches,`${s.fullStats} ${t('fullStats')}`],['gameTime',`${num(s.minutes)} <small>${t('minutes')}</small>`,t('rounds')],['humanWins',s.humanWins,lang==='ru'?'Включая победы в овертайме':'Including overtime wins'],['botWins',s.botWins,lang==='ru'?'Включая технические победы':'Including forfeit wins']].map(([label,val,note])=>`<div class="kpi" data-kpi="${label}"><span class="label">${t(label)}</span><span class="value">${typeof val==='number'?num(val):val}</span><span class="note">${esc(note)}</span>${overviewHistory(s,label,lang,link)}${label==='gameTime'?winBalance(s,lang):label==='allMatches'?topKiller(s):''}</div>`).join('');}
function rankTable(rows,map=false,id=map?'maps':'rating'){
  if(rows.some(r=>!r.isBot)||(!rows.length&&view!=='bots'))return averageTable(rows,map,id);
  const data=rows.map((r,i)=>({...r,rank:id==='profile'?r.rank:i+1}));
  const onlyBots=rows.length?rows.every(r=>r.isBot):view==='bots';
  const columns=[{key:map?'map':'name',label:t(map?'map':'player'),text:true,value:r=>map?r.map:r.name,render:r=>map?esc(r.map):`<span class="rank">${r.rank??'—'}</span><a ${link({profile:r.name,kind:r.isBot?'bot':'human',match:null})}>${r.isBot?botAvatar(r.name):''}${esc(r.name)}</a>${badges(r)}`},
    ...[['points',rows.some(r=>!r.isBot)?'averagePoints':'points'],['matches','matchCount'],['wins','wins'],['losses','losses'],['forfeitWins','forfeitWins'],['forfeits','forfeits'],['overtimeWins','overtimeWins'],['overtimeLosses','overtimeLosses'],['winRate','winRate'],['pointsPerMatch','pointsPerMatch']].filter(([key])=>key==='pointsPerMatch'&&id==='profile'?false:key==='forfeitWins'?onlyBots:key==='forfeits'?!onlyBots:true).map(([key,label])=>({key,label:t(label),value:r=>r[key],render:r=>key==='points'?`<b class="${r.points>=0?'positive':'negative'}">${r.points>0?'+':''}${pointNum(r.points)}</b>`:key==='pointsPerMatch'?pointNum(r[key]):num(r[key],key==='winRate'?1:0)})),
    {key:'averageScore',label:t('averageResult'),value:r=>[r.averageScore,r.averageOpponentScore],render:r=>`${num(r.averageScore,1)} : ${num(r.averageOpponentScore,1)}`},
    {key:'averageFragDifference',label:t('averageDifference'),value:r=>r.averageFragDifference,render:r=>num(r.averageFragDifference,1)}];
  return renderTable(id,columns,data,{params,lang,defaultKey:map?'map':'points',defaultDir:map?'asc':'desc'});
}
function averageTable(rows,map,id){
  const data=rows.map((r,i)=>({...r,rank:id==='profile'?r.rank:i+1}));
  const columns=[{key:map?'map':'name',label:t(map?'map':'player'),text:true,value:r=>map?r.map:r.name,render:r=>map?esc(r.map):`<span class="rank">${r.performance?.provisional?'—':r.rank??'—'}</span><a ${link({profile:r.name,kind:'human',match:null})}>${esc(r.name)}</a>${badges(r)}`},
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
    ...keys.map(key=>({key,label:t(key),hint:key==='completedMatches'?t('noForfeit'):null,value:r=>r[key],render:r=>key==='victoryPoints'?`<b class="positive">${num(r[key],2)}</b>`:key==='completedMatches'?completedWithDuration(r,{lang}):key==='normalWins'?(mode==='victory'?winsWithHistory(r,{lang,asOf}):winCount(r,{lang})):num(r[key])})),winConditionsColumn(lang)];
  return renderTable(id,columns,data,{params,lang,defaultKey:mode==='activity'?'completedMatches':'victoryPoints'});
}
function popularityTable(s){
  const rows=rankMaps(s.byMap).map((r,i)=>({...r,rank:i+1,share:s.completedMatches?r.completedMatches/s.completedMatches*100:0}));
  const columns=[{key:'map',label:t('map'),text:true,value:r=>r.map,render:r=>`<span class="rank">${r.rank}</span><a ${link({map:r.map,view:'matches',page:null})}>${esc(r.map)}</a>`},
    {key:'completedMatches',label:t('completedMatches'),hint:t('noForfeit'),value:r=>r.completedMatches,render:r=>completedWithDuration(r,{lang})},
    {key:'share',label:t('share'),value:r=>r.share,render:r=>num(r.share,1)+'%'}];
  return renderTable('popularity',columns,rows,{params,lang,defaultKey:'completedMatches'})+(!rows.length?`<div class="empty">${lang==='ru'?'Нет завершённых матчей без forfeit.':'No completed matches without forfeits.'}</div>`:'');
}
function ratingLeaders(s){
  const bot=view==='bots',mode=bot?'average':rankingMode();
  const heading=`${bot?'':rankingChoices()}<div class="ranking-intro"><h2>${t(bot?'botRating':mode==='forfeits'?'forfeitRanking':mode)}</h2>${overviewMobile.matches?`<details class="rating-explanation" ${params.get('ratingInfo')==='1'?'open':''}><summary>${lang==='ru'?'Как считается рейтинг':'How the ranking works'}</summary><p>${bot?ratingExplanation(true):t(mode+'Note')}</p></details>`:`<p>${bot?ratingExplanation(true):t(mode+'Note')}</p>`}</div>`;
  if(mode==='maps')return heading+popularityTable(s);
  const eligible=rows=>rankParticipants(rows.filter(p=>p.isBot===bot&&(mode!=='activity'||p.completedMatches>0)&&(mode!=='victory'||p.normalWins>0)&&(bot||mode!=='average'||p.performance?.value!=null)&&(mode!=='forfeits'||p.forfeits>0)),mode);
  const rows=eligible(s.players),id=bot?'rating_bots':'rating_'+mode;
  const table=mode==='forfeits'?forfeitTable(rows,id):mode==='average'?rankTable(rows,false,id):victoryTable(rows,id,mode,s.asOf);
  const note=mode==='victory'?ratingExplanation(false,true):mode==='average'?ratingExplanation(bot)+(bot?'<br>'+t('ratingNote'):''):'';
  return heading+table+(mode==='victory'?unscoredWarning(rows):'')+(!rows.length?`<div class="empty">${mode==='victory'?(lang==='ru'?'В выбранных матчах нет побед человека.':'No human wins in the selected matches.'):mode==='activity'?(lang==='ru'?'Нет завершённых матчей без forfeit.':'No completed matches without forfeits.'):t('empty')}</div>`:'')+`<p class="footnote">${note}</p><div class="map-leaders">${s.byMap.map(m=>{
    const leaders=eligible(m.players).filter(p=>bot||mode!=='average'||!p.performance.provisional).slice(0,3);if(!leaders.length)return '';
    const key=mode==='activity'?'completedMatches':mode==='forfeits'?'forfeitRate':mode==='average'?(bot?'points':'performance'):'victoryPoints';
    return `<section class="map-leader"><a class="map-name ${esc(m.map)}" ${link({map:m.map,view:bot?'bots':'rating'})}>${esc(m.map)}</a><div class="map-leader-heading"><span>№</span><span>${t(bot?'botType':'human')}</span><span>${t(mode==='activity'?'matches':mode==='victory'?'victoryPoints':mode==='forfeits'?'forfeitRate':bot?'points':'averagePoints')}</span></div>${leaders.map((p,i)=>`<div><span class="rank">${i+1}</span><span class="leader-identity"><a ${link({profile:p.name,kind:bot?'bot':'human'})}>${bot?botAvatar(p.name):''}${esc(p.name)}</a>${badges(p)}</span><b>${mode==='activity'?num(p[key]):(key==='performance'?num(p.performance.value,2):pointNum(p[key]))+(mode==='forfeits'?'%':'')}</b></div>`).join('')}</section>`;
  }).join('')}</div>`;
}

function profileControls(){const fields=`<div class="profile-period filters">${periodSelect()}${field('from','from','<input id="f-from" type="date">')}${field('to','to','<input id="f-to" type="date">')}</div>`;return overviewMobile.matches?`<details class="profile-filters" ${params.get('profileFilters')==='1'?'open':''}><summary>${lang==='ru'?'Фильтры':'Filters'}</summary>${fields}</details>`:fields;}
function mountProfilePeriod(){const fold=$('.profile-filters');if(fold)fold.ontoggle=()=>{if(fold.isConnected){params.set('profileFilters',fold.open?'1':'0');writeLocation();}};for(const k of ['period','from','to'])$('#f-'+k).value=params.get(k)||(k==='period'?'all':'');for(const k of ['period','from','to'])$('#f-'+k).onchange=e=>{if(k==='period'){params.set('period',e.target.value);if(e.target.value!=='custom'){params.delete('from');params.delete('to');}}else{params.set('period','custom');if(e.target.value)params.set(k,e.target.value);else params.delete(k);}params.delete('profilePage');writeLocation();render();};}

function profileRating(standing,kind){
  const {value,rank,provisional,games}=standing,ru=lang==='ru';
  if(value===null)return '';
  const destination=link({view:kind==='bot'?'bots':'rating',ranking:'average',profile:null,kind:null,match:null,profilePage:null,page:null,q:null,bot:null,sort_rating_bots:null,dir_rating_bots:null,sort_rating_average:null,dir_rating_average:null});
  const label=rank!==null?(ru?'Место в рейтинге':'Leaderboard rank'):(ru?'Рейтинг':'Rating');
  const position=rank!==null?`<a class="profile-rating-place" ${destination} aria-label="${label}: ${num(rank)}"><span class="profile-rank-prefix" aria-hidden="true">${ru?'№':'#'}</span><b><span class="profile-rank-digit">${num(rank)}</span></b><span class="profile-rank-arrow" aria-hidden="true">↗</span></a>`:provisional?`<strong class="profile-rating-unranked">${ru?'Вне рейтинга':'Unranked'}</strong>`:'';
  const score=`<div class="profile-rating-score"><span>${ru?'Очки':'Points'}:</span> <strong class="profile-rating-value">${kind==='bot'?pointNum(value):num(value,2)}</strong></div>`;
  const note=provisional?`<span class="profile-rating-pending">${t('provisional')} · ${num(games)}/${performancePolicy.minimumGames}</span>`:'';
  return `<div class="profile-rating ${kind}${value<0?' negative':''}"><span class="label">${label}</span>${position}${score}${note}</div>`;
}
function profileScope(){
  const ru=lang==='ru',map=params.get('map'),period=params.get('period');
  const named=(ru?{today:'за сегодня',three:'за последние 3 дня',week:'за последние 7 дней',month:'за последние 30 дней',year:'за последние 365 дней'}:{today:'for today',three:'for the last 3 days',week:'for the last 7 days',month:'for the last 30 days',year:'for the last 365 days'})[period];
  let when=named||(ru?'за всё время существования статистики':'for the entire history of these statistics');
  if(!named){
    const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')&&Number.isFinite(Date.parse(value))?value:null;
    const from=validDate(params.get('from')),to=validDate(params.get('to'));
    const format=value=>ru?value.split('-').reverse().join('.'):value;
    if(from||to)when=[from?(ru?'с ':'from ')+format(from):'',to?(ru?'по ':'to ')+format(to):''].filter(Boolean).join(' ');
  }
  return `${ru?'Данные предоставлены':'Data is shown'} ${when}${map?(ru?' по карте ':' on map ')+esc(map):''}`;
}
function profileRecord(p,kind){
  if(!p)return '';
  const rate=p.winRate==null?'—':`${num(p.winRate,1)}<small>%</small>`;
  return `<div class="profile-record ${kind}"><span class="label">${lang==='ru'?'Победы':'Wins'}</span><strong class="profile-winrate">${rate}</strong><div class="profile-record-counts"><span>${lang==='ru'?'Матчей':'Matches'}: <b>${num(p.matches)}</b></span><span aria-hidden="true">·</span><span>${lang==='ru'?'Побед':'Wins'}: <b>${num(p.wins)}</b></span></div></div>`;
}
function profileKpis(p,kind){
  if(!overviewMobile.matches)return '';
  const metrics=kind==='human'?[['victoryTotal',num(p.victoryPoints,2)],['averageTotal',num(p.performance?.value,2)+(p.performance?.provisional?` <small>${t('provisional')}</small>`:'')],['completedMatches',p.completedMatches],['forfeitRate',num(p.forfeitRate,2)+'%']]:[['points',pointNum(p.points)],['matchCount',p.matches],['winRate',num(p.winRate,1)+'%'],['wins',p.wins]];
  return `<div class="kpis profile-mobile-kpis">${metrics.map(([label,value])=>`<div class="kpi"><span class="label">${t(label)}</span><span class="value">${value}</span></div>`).join('')}</div>`;
}
function profileHeading(name,kind,standing,p){return `<div class="detail-top profile-heading${kind==='bot'?' bot-profile-heading':''}" data-podium="${standing.rank>=1&&standing.rank<=3?standing.rank:''}">${kind==='bot'?botAvatar(name,{size:'profile',eager:true}):''}<div class="profile-heading-name"><div class="eyebrow">${kind==='bot'?t('botType'):t('profile')}</div><h1 data-name="${esc(name)}" aria-label="${esc(name)}"><span class="profile-name-text">${esc(name)}</span></h1></div><div class="profile-highlights">${profileRating(standing,kind)}${profileRecord(p,kind)}</div><span class="subtle profile-scope">${profileScope()}</span></div>`;}
async function profile(epoch){const name=params.get('profile'),kind=params.get('kind')==='bot'?'bot':'human',q=profileMatchQuery(params);const [s,r]=await Promise.all([api('summary?'+profileSummaryQuery(params)),api('matches?'+q)]),standing=profileStanding(s.players,name,kind),p=s.players.find(p=>p.name===name&&p.isBot===(kind==='bot'));if(epoch!==renderEpoch)return;if(!p){$('#content').innerHTML=`<a class="back" ${link({view:kind==='bot'?'bots':'players',profile:null,kind:null,profilePage:null})}>${kind==='bot'?(lang==='ru'?'← К списку ботов':'← Bot directory'):(lang==='ru'?'← К списку игроков':'← Player directory')}</a>${profileHeading(name,kind,standing,p)}${achievementProfile(awardCatalog,name,{lang,link,kind})}${profileControls()}<div class="empty">${t('empty')}</div>`;mountProfilePeriod();return;}const maps=s.byMap.filter(m=>m.players.some(p=>p.name===name&&p.isBot===(kind==='bot'))).map(m=>({map:m.map,...m.players.find(p=>p.name===name&&p.isBot===(kind==='bot'))}));$('#content').innerHTML=`<a class="back" ${link({view:kind==='bot'?'bots':'players',profile:null,kind:null,profilePage:null})}>${kind==='bot'?(lang==='ru'?'← К списку ботов':'← Bot directory'):(lang==='ru'?'← К списку игроков':'← Player directory')}</a>${profileHeading(name,kind,standing,p)}${achievementProfile(awardCatalog,name,{lang,link,kind})}${profileControls()}${profileKpis(p,kind)}<section class="panel"><h2>${t('profileSummary')}</h2>${rankTable([{...p,rank:standing.rank}],false,'profile')}${unscoredWarning([p])}<p class="sub">${ratingExplanation(kind==='bot')}${kind==='bot'?'<br>'+t('ratingNote'):''}</p><div class="kpis">${[['averageKills',p.averageKills],['averageDeaths',p.averageDeaths],['averageKD',p.averageKillDeathDifference],['averageDamage',p.averageDamage],['overtimeForfeits',p.overtimeForfeits]].map(([label,value])=>`<div class="kpi"><span class="label">${t(label)}</span><span class="value">${num(value,1)}</span></div>`).join('')}</div><p class="sub">${t('meanNote')}</p></section><section class="panel"><h2>${t('mapBreakdown')}</h2>${kind==='human'?profileVictories(maps):''}${rankTable(maps,true)}<h3>${t('averages')}</h3>${mapAverages(maps)}</section><section class="panel" id="profile-matches"><h2>${t('matches')} · ${num(r.total)}</h2>${matchHeaders()}${matchPagination(r,{lang,profile:true})}${r.items.map(matchRow).join('')}${matchPagination(r,{lang,profile:true})}</section>`;mountProfilePeriod();document.querySelectorAll('[data-profile-page]').forEach(button=>button.onclick=async()=>{params.set('profilePage',button.dataset.profilePage);writeLocation('push');await render();document.getElementById('profile-matches')?.scrollIntoView({block:'start'});});}
function profileVictories(rows){
  const columns=[{key:'map',label:t('map'),text:true,value:r=>r.map},...['victoryPoints','completedMatches'].map(key=>({key,label:t(key),hint:key==='completedMatches'?t('noForfeit'):null,value:r=>r[key],render:r=>key==='completedMatches'?completedWithDuration(r,{lang}):num(r[key],2)}))];
  return `<h3>${t('victory')}</h3>`+renderTable('profile_victory_maps',columns,rows,{params,lang,defaultKey:'victoryPoints'})+`<h3>${t('average')}</h3>`;
}
const pointNum=v=>num(v,v&&Math.abs(v)<0.01?Math.min(12,Math.ceil(-Math.log10(Math.abs(v)))+1):2);
function matchRatingAwards(m){
  const award=(p,i,fn)=>`${esc(p.name)} <b>${fn(m,i)===null?'—':(fn(m,i)>0?'+':'')+pointNum(fn(m,i))}</b>`;
  return `<p class="footnote">${t('victory')}: ${m.participants.map((p,i)=>p.isBot?'':award(p,i,victoryPoints)).filter(Boolean).join(' · ')}<br>${t('average')}: ${m.status==='forfeit'?(lang==='ru'?'forfeit не участвует в расчёте':'forfeit excluded from calculation'):(lang==='ru'?'пересчитывается по всем подходящим матчам игрока, без фиксированной прибавки за одну игру':'recalculated across eligible games, with no fixed award per game')}<br>${t('botRating')}: ${m.participants.map((p,i)=>p.isBot?award(p,i,matchPoints):'').filter(Boolean).join(' · ')}</p>`;
}
function mapAverages(rows){const columns=[{key:'map',label:t('map'),text:true,value:r=>r.map},...['averageKills','averageDeaths','averageKillDeathDifference','averageDamage','statsMatches'].map((key,i)=>({key,label:t(['averageKills','averageDeaths','averageKD','averageDamage','fullStats'][i]),value:r=>r[key],render:r=>num(r[key],key==='statsMatches'?0:1)}))];return renderTable('averages',columns,rows,{params,lang,defaultKey:'map',defaultDir:'asc'});}

function compactVictim(r,columns){
  const ru=lang==='ru',last=r.botWins%10,lastTwo=r.botWins%100;
  const winWord=ru?(last===1&&lastTwo!==11?'победа':last>=2&&last<=4&&(lastTwo<12||lastTwo>14)?'победы':'побед'):(r.botWins===1?'win':'wins');
  return compactDuelCard({attrs:`data-pair="${esc(r.bot+' / '+r.human)}"`,
    left:compactIdentity({name:r.bot,profile:r.bot,isBot:true}),right:compactIdentity({name:r.human,isBot:false}),
    center:`<span class="compact-pair-wins" title="${t('pairBotWins')}"><b>${num(r.botWins)}</b> <small>${winWord}</small></span>`,
    info:`<span class="compact-pair-matches">${ru?'Матчи':'Matches'}: <b>${num(r.matches)}</b></span>`,
    marker:`<span class="compact-pair-rate" title="${t('pairBotPercent')}" aria-label="${t('pairBotPercent')}: ${num(r.botWinPercent,1)}%">${num(r.botWinPercent,1)}%</span>`,
    details:`<dl>${columns.map(c=>`<div><dt>${c.label}</dt><dd>${['bot','human'].includes(c.key)?esc(c.value(r)):c.render?c.render(r):esc(c.value(r))}</dd></div>`).join('')}</dl>`,
    label:`${ru?'Подробнее о паре':'Pair details'}: ${r.bot} — ${r.human}`});
}
function victimResults(result){
  const identity=(name,isBot)=>`<a ${link({view:isBot?'bots':'players',profile:name,kind:isBot?'bot':'human',match:null})}>${isBot?botAvatar(name):''}${esc(name)}</a>${badges({name,profile:isBot?name:null,isBot})}`;
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
  return `<div class="defeat-intro"><h2>${t('victimsTitle')}</h2><p>${lang==='ru'?'Топ пар бот–человек по числу побед бота, включая forfeit.':'Bot–human pairs ranked by bot wins, including forfeits.'}</p><details class="victim-rules"><summary>${lang==='ru'?'Как считаются показатели':'How these metrics are calculated'}</summary><p>${note}</p></details></div>`+(result.items.length?renderTable('victims',columns,result.items,{params,lang,defaultKey:'botWins',defaultDir:'desc',mobileRow:r=>compactVictim(r,columns)}):`<div class="empty">${t('empty')}</div>`);
}

function defeatResults(r){
  const botLoss=view==='botdefeats';
  const human=m=>m.participants.find(p=>!p.isBot),bot=m=>m.participants.find(p=>p.isBot),matchLink=m=>link({match:m.id});
  const columns=[
    {key:'human',label:t('human'),text:true,value:m=>human(m).name,render:m=>`<a ${link({profile:human(m).name,kind:'human',match:null})}>${esc(human(m).name)}</a>${badges(human(m))}${forfeitLoss(human(m),m)}`},
    {key:'bot',label:t('botType'),text:true,value:m=>bot(m).name,render:m=>`<a ${link({profile:bot(m).profile,kind:'bot',match:null})}>${botAvatar(bot(m).profile||bot(m).name)}${esc(bot(m).name)}</a>${badges(bot(m))}${bot(m).skillVariable?`<div>${t('skill')}: ${t('variable')} · ${lang==='ru'?'средний':'average'} ${num(m.rating?.difficulty.averageSkill,2)}</div>`:''}`},
    {key:'humanScore',label:t('scoreLabel'),value:m=>human(m).score,render:m=>`<a ${matchLink(m)}>${human(m).score} : ${bot(m).score} ↗</a>`},
    {key:'margin',label:t(botLoss?'humanMargin':'margin'),value:m=>botLoss?human(m).score-bot(m).score:bot(m).score-human(m).score,render:m=>`<b>${num(botLoss?human(m).score-bot(m).score:bot(m).score-human(m).score)}</b>`},
    {key:'map',label:t('map'),text:true,value:m=>m.map},
    {key:'date',label:t('date'),value:m=>m.startedAt,render:m=>esc(date(m.startedAt))},
    {key:'duration',label:t('duration'),value:m=>m.durationSeconds??m.recordedSeconds,render:m=>time(m.durationSeconds??m.recordedSeconds)},
    {key:'status',label:t('status'),text:true,value:m=>m.status,render:m=>badge(m)}
  ];
  const rows=overviewMobile.matches
    ?compactSort(view,columns,sortState(view,columns,params,'margin','desc'),lang)+`<div class="match-list" data-table="${view}">${r.items.map(m=>compactMatch(m,matchLink(m),{humanFirst:true,extraDetails:`<div><dt>${t(botLoss?'humanMargin':'margin')}</dt><dd>${num(botLoss?human(m).score-bot(m).score:bot(m).score-human(m).score)}</dd></div>`})).join('')}</div>`
    :renderTable(view,columns,r.items,{params,lang,defaultKey:'margin',defaultDir:'desc',presorted:true});
  return `<div class="defeat-intro"><h2>${t(overviewMobile.matches?(botLoss?'botdefeats':'defeats'):(botLoss?'botDefeatTitle':'defeatTitle'))}</h2>${overviewMobile.matches?`<details class="section-info"><summary>${lang==='ru'?'Как считаются показатели':'How these metrics are calculated'}</summary><p>${t(botLoss?'botDefeatNote':'defeatNote')}</p></details>`:`<p>${t(botLoss?'botDefeatNote':'defeatNote')}</p>`}</div>`+(r.items.length?rows+`${matchPagination(r,{lang})}`:`<div class="empty">${t('empty')}</div>`);
}

function matchHeaders(){const columns=[['map','map',true],['date','date',false],['match','match',true],['score','scoreLabel',false],['status','status',true],['duration','duration',false],['version','version',true]].map(([key,label,text])=>({key,label:t(label),text})),state=sortState('matches',columns,params,'date','desc');if(overviewMobile.matches)return compactSort('matches',columns,state,lang);return `<div class="match-sort" aria-label="${t('sortHint')}">${columns.map(c=>sortButton('matches',c,state,lang)).join('')}</div>`;}
async function changeSort(id,key,dir){
  params.set('sort_'+id,key);params.set('dir_'+id,dir);
  if(id==='award_evidence')params.delete('awardPage');
  if(['matches','defeats','botdefeats'].includes(id)){params.delete('page');params.delete('profilePage');}
  writeLocation();const y=scrollY;
  if(['matches','defeats','botdefeats','victims'].includes(id)&&!params.has('profile')&&!params.has('match'))await refresh();else await render();
  window.scrollTo(0,y);
  const focus=overviewMobile.matches?`[data-sort-select="${id}"]`:`[data-sort-table="${id}"][data-sort-key="${key}"]`;
  document.querySelector(focus)?.focus({preventScroll:true});
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-sort-table]');if(b)changeSort(b.dataset.sortTable,b.dataset.sortKey,b.dataset.sortDir);});
document.addEventListener('change',e=>{if(e.target.matches('[data-ranking-choice]')){params.set('ranking',e.target.value);params.delete('page');writeLocation('push');render();return;}const s=e.target.closest('[data-sort-select]');if(s)changeSort(s.dataset.sortSelect,s.value,s.selectedOptions[0].dataset.direction);});
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

async function refresh(){const overviewEpoch=renderEpoch;await refreshOverview(overviewEpoch);if(overviewEpoch!==renderEpoch)return;syncJudgment();if(view==='charts')return refreshCharts();if(view==='dynamics')return refreshDynamics();const request=++requestId,q=new URLSearchParams();for(const k of qfields)if(params.has(k))q.set(k,params.get(k));if(view==='rating'&&rankingMode()==='forfeits')q.delete('status');if(view==='players')q.set('playerSearch','1');if(defeatView()){q.set(view==='botdefeats'?'botDefeats':'humanDefeats','1');q.set('sort_matches',params.get('sort_'+view)||'margin');q.set('dir_matches',params.get('dir_'+view)||'desc');}try{const [r,s,v]=await Promise.all([api('matches?'+q),api('summary?'+q),view==='victims'?api('victims?'+q):null]);if(request!==requestId||!$('#results'))return;$('#count').textContent=view==='players'?`${num(s.players.filter(p=>!p.isBot).length)} ${lang==='ru'?'участников':'players'}`:v?`${num(v.total)} ${t('pairs')}`:`${num(r.total)} ${t('results')}`;
  $('#results').innerHTML=view==='players'?playersPage(s,{lang,params,link,badges}):view==='victims'?victimResults(v):defeatView()?defeatResults(r):view==='matches'?(r.items.length?`<div class="match-list">${matchHeaders()}${r.items.map(matchRow).join('')}</div>${matchPagination(r,{lang})}`:`<div class="empty">${t('empty')}</div>`):ratingLeaders(s);
  document.querySelectorAll('button[data-page]').forEach(b=>b.onclick=()=>{params.set('page',b.dataset.page);writeLocation('push');refresh();});
  mountAchievementBadges();
}catch(e){if($('#results'))$('#results').innerHTML=`<div class="error">${t('error')} <button id="retry">${t('retry')}</button></div>`;if($('#retry'))$('#retry').onclick=refresh;}}
function mountFilters(){for(const [selector,key] of [['.mobile-filters','filterPanel'],['.primary-filters','filters'],['.advanced','advanced']]){const section=$(selector);if(!section)continue;section.ontoggle=()=>{if(!section.isConnected)return;params.set(key,section.open?'1':'0');writeLocation();};}for(const k of qfields){const input=$('#f-'+k);if(input)input.value=params.get(k)||(k==='period'?'all':'');}let debounce;
  const submit=()=>{for(const [k,v]of new FormData($('#filters'))){if(v)params.set(k,v);else params.delete(k);}params.delete('page');if(view==='charts')resetChartSelection();const summary=$('.mobile-filters>summary');if(summary){const n=qfields.filter(k=>params.get(k)&&!(k==='period'&&params.get(k)==='all')).length;summary.textContent=(lang==='ru'?'Фильтры':'Filters')+(n?' · '+n:'');}writeLocation();refresh();};
  $('#filters').onsubmit=e=>{e.preventDefault();clearTimeout(debounce);submit();};$('#filters').onchange=e=>{if(e.target.id==='f-q')return;clearTimeout(debounce);if(e.target.id==='f-period'&&e.target.value!=='custom'){$('#f-from').value='';$('#f-to').value='';}if(e.target.id==='f-from'||e.target.id==='f-to')$('#f-period').value='custom';submit();};$('#f-q').oninput=()=>{clearTimeout(debounce);debounce=setTimeout(submit,300);};
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
  else text=(lang==='ru'?`Очки за победу: <b>${num(duration.basePoints,4)}</b> за длительность`:`Win points: <b>${num(duration.basePoints,4)}</b> for duration`)+(d.known?` × ${num(d.factor,4)} (${lang==='ru'?'скилл':'skill'}) × ${num(modeDifficulty(m).factor,4)} (${lang==='ru'?'режимы':'modes'}) = <b>+${num(matchPoints(m,i),2)}</b>`:'');
  return `<div class="rating-context duration-award">${text} <a class="button-link" ${attrs}>${t('aboutRating')} →</a></div>`;
}

function playerDetail(p,m){return `<div class="player" data-player-kind="${p.isBot?'bot':'human'}">${p.isBot?botAvatar(p.profile||p.name,{size:'roster',eager:true}):''}<span class="type">${p.isBot?t('botType'):t('human')}</span><div class="name">${esc(p.name)}</div>${badges(p)}${forfeitLoss(p,m)}<div class="meta">${p.isBot?botSettings(p,true):t('human')}</div><div class="meta ping">${t('ping')}: ${p.ping?`${num(p.ping.averageMs,1)} ms`:'—'}</div></div>`;}
function weapons(m){const p=m.participants[selectedWeaponPlayer],columns=[{key:'name',label:t('weapons'),text:true,value:w=>item(w.name),render:w=>esc(item(w.name))},{key:'accuracy',label:t('accuracy'),value:w=>w.shots?w.hits/w.shots:(Number.isFinite(w.accuracyPercent)?w.accuracyPercent/100:null),render:w=>w.shots?num(w.hits/w.shots*100,1)+'%':Number.isFinite(w.accuracyPercent)?num(w.accuracyPercent)+'%':'—'},{key:'hits',label:t('hits'),value:w=>w.shots===null?null:[w.hits,w.shots],render:w=>w.hits===null||w.shots===null?'—':`${num(w.hits)} / ${num(w.shots)}`},...['kills','deaths','damageDealt','damageReceived'].map((key,i)=>({key,label:t(['kills','deaths','damage','received'][i]),value:w=>w[key],render:w=>num(w[key])}))];return `<div class="toggle">${m.participants.map((x,i)=>`<button data-weapon-player="${i}" class="${selectedWeaponPlayer===i?'active':''}">${esc(x.name)}</button>`).join('')}</div>`+renderTable('weapons'+selectedWeaponPlayer,columns,p.stats?.weapons||[],{params,lang,defaultKey:'name',defaultDir:'asc'});}
function botWinContext(m){
  if(!['completed','forfeit'].includes(m.status)||!Number.isInteger(m.winnerIndex)||m.ratingExcluded||!m.participants[m.winnerIndex].isBot)return '';
  const p=botWinAward(m),attrs=link({view:'about',match:null,profile:null,kind:null,page:null},{hash:'#bot-wins'});
  const text=p.known?(lang==='ru'?`Награда боту: <b>+${pointNum(p.points)}</b> = ${num(p.basePoints,4)} за длительность × ${num(p.averageSkill,2)} / ${p.maximumSkill} (скилл) × ${num(p.modeFactor,4)} (режимы).`:`Bot win award: <b>+${pointNum(p.points)}</b> = ${num(p.basePoints,4)} for duration × ${num(p.averageSkill,2)} / ${p.maximumSkill} (skill) × ${num(p.modeFactor,4)} (modes).`):(lang==='ru'?'Не хватает данных о полном времени или скилле для начисления очков боту. Победа сохранена.':'Full duration or skill data is insufficient to calculate the bot award. The win is recorded.');
  return `<div class="rating-context bot-win-context">${text} <a ${attrs}>${t('aboutRating')} →</a></div>`;
}
function botLossContext(m){
  if(m.status!=='completed'||!Number.isInteger(m.winnerIndex)||m.ratingExcluded||m.participants[m.winnerIndex].isBot)return '';
  const p=botLossPenalty(m),attrs=link({view:'about',match:null,profile:null,kind:null,page:null},{hash:'#bot-loss'});
  const text=p.known?(lang==='ru'?`Штраф боту за поражение: <b>${num(p.points,4)}</b> · Средний скилл ${num(p.averageSkill,2)} из ${p.maximum} · Поправка режимов ×${num(p.modeFactor,4)}.`:`Bot loss penalty: <b>${num(p.points,4)}</b> · Average skill ${num(p.averageSkill,2)} out of ${p.maximum} · Mode factor ×${num(p.modeFactor,4)}.`):(lang==='ru'?'Не хватает данных о скилле для расчёта штрафа боту. Поражение сохранено; штраф не придуман.':'Skill data is insufficient to calculate the bot loss penalty. The loss is recorded; no penalty is guessed.');
  return `<div class="rating-context bot-loss-context">${text} <a ${attrs}>${t('aboutRating')} →</a></div>`;
}
function forfeitContext(m){
  if(m.status!=='forfeit')return '';
  const reasons=lang==='ru'?{restart:'Перезапуск матча',abort:'Отмена матча',map_change:'Досрочная смена карты',human_departure:'Выход игрока из матча'}:{restart:'Match restart',abort:'Match abort',map_change:'Early map change',human_departure:'Player left the match'};
  const reason=reasons[m.endReason]||(m.resultCorrection==='interrupted_as_forfeit'?(lang==='ru'?'Прерванная игра: forfeit по правилу BotStats':'Interrupted game: forfeit under BotStats rules'):null);
  return `<div class="warning forfeit-context">${reason?esc(reason)+'. ':''}${lang==='ru'?'Техническое поражение человека и победа бота независимо от счёта. Показан счёт до прерывания.':'The human forfeits and the bot wins regardless of the score. Scores are from before the interruption.'}</div>`;
}
async function detail(id,epoch){const m=await api('matches/'+encodeURIComponent(id));if(epoch!==renderEpoch)return;const [a,b]=m.participants;const controls=[...new Set(m.participants.flatMap(p=>p.stats?.control.map(x=>x.name)||[]))];const pickups=[...new Set(m.participants.flatMap(p=>p.stats?.pickups.map(x=>x.name)||[]))];const pick=(p,n)=>p.stats?(p.stats.pickups.find(x=>x.name===n)?.count??(p.stats.format==='legacy'?null:0)):null;
  $('#content').innerHTML=`<a class="back" ${link({match:null})}>${t('back')}</a><div class="detail-top"><div><div class="eyebrow">${esc(m.map)} · ${resultBadge(m)}</div><h1>${t('match')} ${esc(date(m.startedAt))}</h1><div class="subtle">${m.modVersion?'OpenTDM-X Beta '+esc(m.modVersion):t('noVersion')} · ${lang==='ru'?'МСК':'MSK'}</div></div>${m.previewExample?'':`<a class="download" href="${base}/api/demos/${m.demo.sha256}">${t('download')}</a>`}</div>${matchDurationBlock(m)}<section class="detail-score">${playerDetail(a,m)}${score(m)}${playerDetail(b,m)}</section>
  ${modesDetail(m,lang,link({view:'about',match:null,profile:null},{hash:'#modes'}))}${m.ratingExcluded?`<div class="warning">${t('opponentChanged')}</div>`:''}${m.overtime?`<div class="warning overtime-result">${t('overtimeResult')} · ${m.participants.map(p=>p.score).join(' : ')} · ${t(m.overtimeKind==='sudden_death'?'suddenDeath':'overtime')}</div>`:''}${forfeitContext(m)}${matchRatingAwards(m)}${botWinContext(m)}${botLossContext(m)}${durationAwardNote(m)}${difficultyNote(m)}${m.status==='interrupted'?`<div class="warning">${t('interruptedNote')}</div>`:''}${!m.statsComplete?`<div class="warning">${t('noStats')}</div>`:''}${!m.startObserved?`<div class="warning">${t('partial')}</div>`:''}${m.statsFormat==='legacy'?`<p class="footnote">${t('legacyStatsNote')}</p>`:''}
  <div class="detail-grid"><section class="panel"><h2>${t('scoreProgress')}</h2>${chart(m)}</section><section class="panel"><h2>${t('comparison')}</h2>${[['damage','damageDealt'],['received','damageReceived'],['kills','kills'],['deaths','deaths'],['suicides','suicides']].map(([label,k])=>compare(t(label),a.stats?.[k],b.stats?.[k])).join('')}<p class="sub">${t('damageNote')}</p></section></div>
  <section class="panel"><h2>${t('weapons')}</h2><div id="weapons">${weapons(m)}</div></section>
  <section class="panel"><h2>${t('control')}</h2><div class="legend"><span>${esc(a.name)}</span><span>${esc(b.name)}</span></div><div class="items">${controls.map(n=>compare(item(n),a.stats?.control.find(x=>x.name===n)?.pickups,b.stats?.control.find(x=>x.name===n)?.pickups)).join('')}</div><details class="pickup-details" ${params.get('pickups')==='1'?'open':''}><summary>${t('items')}</summary><div class="items">${pickups.map(n=>compare(item(n),pick(a,n),pick(b,n))).join('')}</div></details><p class="sub">${t(m.statsFormat==='legacy'?'legacyItemsNote':'itemsNote')}</p></section>
  <div class="detail-grid"><section class="panel"><h2>${t('settings')}</h2>${m.participants.filter(p=>p.isBot).map(p=>`<h3>${esc(p.profile)} · ${t('skillTimeline')} ${esc(skill(p))}</h3><div class="skill-timeline">${(p.skillTimeline||[]).map(s=>`<div class="skill-interval">${time(s.fromMs/1000)}–${time(s.toMs/1000)} <strong>${s.value}</strong></div>`).join('')}</div>${p.styleVariable?`<h3>${t('styleTimeline')}</h3><div class="skill-timeline style-timeline">${(p.styleTimeline||[]).map(s=>`<div class="skill-interval">${time(s.fromMs/1000)}–${time(s.toMs/1000)} <strong>${esc(s.value??'—')}</strong></div>`).join('')}</div>`:''}`).join('')}<h3>${t('ping')}</h3>${m.participants.map(p=>`<p class="sub"><b>${esc(p.name)}</b>: ${p.ping?`${num(p.ping.averageMs,1)} ms · min ${p.ping.minMs} / max ${p.ping.maxMs}<br>${p.ping.samples} ${t('observed')} · ${num(p.ping.observedSeconds,1)} ${t('coverage')}`:t('noPing')}</p>`).join('')}<p class="sub">${t('pingNote')}</p></section><section class="panel"><h2>${t('events')}</h2><ol class="events">${m.events.map(e=>`<li><time>${time(e.timeMs/1000)}</time><span>${esc(e.text)}</span></li>`).join('')}</ol><p class="sub">${t('rawEvents')}</p></section></div>`;
  $('.modes-panel').insertAdjacentHTML('afterend',gameplayDetail(m,lang));mountGameplayDetails($('#content'),m,lang);
  if(m.previewExample)$('#content').insertAdjacentHTML('afterbegin',`<p class="warning">${lang==='ru'?'Проверочный пример: техническая запись или синтетический сценарий. Не результат игры пользователя; в публичную статистику не загружается.':'Test example: a technical recording or synthetic scenario. Not a user game result; not uploaded to public statistics.'}</p>`);
  const pickupDetails=$('.pickup-details');if(pickupDetails)pickupDetails.ontoggle=()=>{if(!pickupDetails.isConnected)return;params.set('pickups',pickupDetails.open?'1':'0');writeLocation();};const hook=()=>document.querySelectorAll('[data-weapon-player]').forEach(x=>x.onclick=()=>{selectedWeaponPlayer=+x.dataset.weaponPlayer;params.set('weapon',selectedWeaponPlayer);writeLocation();$('#weapons').innerHTML=weapons(m);hook();});hook();
}
Object.assign(dict.ru,{ratingNote:'Forfeit всегда означает поражение человека и победу бота. Они уже входят в общие итоги; отдельная колонка показывает их количество. Овертайм — дополнительное время при равном счёте, включая Sudden Death. Средние очки за матч считаются только по играм, для которых удалось определить очки.'});
Object.assign(dict.en,{ratingNote:'A forfeit always means a human loss and a bot win. These are included in the totals and also shown in a separate column. Overtime is extra time after a tied score, including Sudden Death. Average points per match uses only games whose point award could be determined.'});
Object.assign(dict.ru,{online:'Онлайн'});Object.assign(dict.en,{online:'Online'});

Object.assign(dict.ru,{charts:'Графики',judgment:'Судный день'});Object.assign(dict.en,{charts:'Charts',judgment:'Judgment Day'});
let homeData=null,overviewCache=null,awardsCache=null,overviewRequest=0;
const overviewKeys=['q','map','bot','style','skill','modVersion','status','from','to','period','overtime'];
function overviewQuery(){const q=new URLSearchParams();for(const k of overviewKeys)if(params.has(k))q.set(k,params.get(k));return q;}
function mountSharedShell(){
  const shell=$('#shared-shell');
  if(!shell.firstElementChild)shell.innerHTML='<div class="workspace-head shared-tabs"></div>'+hero();
  shell.querySelector('.overview').hidden=!isHome();
  shell.querySelector('.shared-tabs').innerHTML=navigation()+`<span class="refresh">${t('serverTime')}</span>`;

}
async function refreshOverview(epoch){
  const serial=++overviewRequest,q=overviewQuery(),key=q.toString(),now=Date.now();
  const [data,awards]=await Promise.all([
    overviewCache?.key===key&&now-overviewCache.at<20000?overviewCache.data:api('home?'+q),
    awardsCache&&now-awardsCache.at<30000?awardsCache.data:api('achievements')
  ]);
  if(epoch!==renderEpoch||serial!==overviewRequest)return;
  overviewCache={key,data,at:now};awardsCache={data:awards,at:now};homeData=data;awardCatalog=awards;
  $('#kpis').innerHTML=kpis(data);
  const latest=data.latest;
  $('#latest').innerHTML=latest&&overviewMobile.matches?compactLatest(latest):latest?`<div class="mini-label latest-heading"><span>${t('latest')}</span><span class="latest-result">${resultBadge(latest)}</span><span class="latest-map">${esc(latest.map)}</span></div><div class="latest-match"><div class="hero-score">${person(latest.participants[0],latest)}<a class="score-link" ${link({match:latest.id})} aria-label="${t('details')}">${score(latest)}</a>${person(latest.participants[1],latest)}</div><div class="mini-label"><span>${esc(date(latest.startedAt))}</span>${modeBadges(latest,lang)}</div></div>`:`<p>${t('empty')}</p>`;
  mountAchievementBadges();syncJudgment();
}
let homeCleanup=()=>{};
async function showHome(epoch){
  const module=await import('./home-ui.js');if(epoch!==renderEpoch)return;
  if(!document.getElementById('home-css')){const css=document.createElement('link');css.id='home-css';css.rel='stylesheet';css.href=new URL('./home.css',import.meta.url);document.head.append(css);}
  $('#content').innerHTML=module.homePage(homeData,{lang,link,badges,catalog:awardCatalog,compact:overviewMobile.matches});syncJudgment();
  if(!overviewMobile.matches)homeCleanup=module.mountHomeVersion($('#home-mod-version'),{base,lang});
}
let themeModule=null;
function syncJudgment(){
  if(theme!=='judgment'){themeModule?.clearJudgment();return;}
  import('./judgment-theme.js').then(module=>{themeModule=module;if(theme==='judgment')module.updateJudgment({base,params,summary:homeData});});
}
let chartsCleanup=()=>{},chartsAbort=null,chartsRequest=0,chartsModule=null,chartLast=null;
const chartQueryKeys=['period','from','to','q','map','bot','style','skill','modVersion','overtime','chartResults'];
function resetChartSelection(){for(const k of ['bucket','bucketFrom','bucketTo','chartOutcome','chartPage','chartPoint'])params.delete(k);}
async function refreshCharts(){
  const serial=++chartsRequest;chartsAbort?.abort();const controller=new AbortController();chartsAbort=controller;
  const signal=controller.signal;
  try{
    chartsModule=await import('./charts-ui.js');if(serial!==chartsRequest||view!=='charts')return;
    if(!document.getElementById('charts-css')){const css=document.createElement('link');css.id='charts-css';css.rel='stylesheet';css.href=new URL('./charts.css',import.meta.url);document.head.append(css);}
    const type=Object.hasOwn(chartsModule.chartNames.en,params.get('chart'))?params.get('chart'):'duration',q=new URLSearchParams();
    for(const k of chartQueryKeys)if(params.has(k))q.set(k,params.get(k));
    const key=type+'?'+q;
    let data;
    if(chartLast?.key===key&&Date.now()-chartLast.at<20000)data=chartLast.data;
    else{const response=await fetch(base+'/api/charts/'+type+'?'+q,{signal});if(!response.ok)throw new Error('Chart unavailable');data=await response.json();chartLast={key,data,at:Date.now()};}
    if(serial!==chartsRequest||view!=='charts'||!$('#results'))return;
    chartsCleanup();$('#count').textContent=`${data.totals.matches} ${lang==='ru'?'матчей':'games'}`;$('#results').innerHTML=chartsModule.chartsPage(data,{lang,params,link});
    const controls=$('#results .chart-controls'),mobileFilters=$('.mobile-filters');
    if(mobileFilters){mobileFilters.querySelector(':scope>.chart-controls')?.remove();if(controls)mobileFilters.insertBefore(controls,$('#filters'));}
    chartsCleanup=chartsModule.mountCharts($('#results'),{params,data,lang,controls,onChoices:open=>{params.set('chartChoices',open?'1':'0');writeLocation();},
      onChange:(k,v)=>{params.set(k,v);if(k==='chartResults')resetChartSelection();writeLocation();refreshCharts();},
      onPoint:value=>{params.set('chartPoint',value);params.delete('bucket');params.delete('bucketFrom');params.delete('bucketTo');writeLocation();refreshCharts();},
      onNavigate:u=>{[...params.keys()].forEach(k=>params.delete(k));u.searchParams.forEach((v,k)=>params.set(k,v));writeLocation('push');refreshCharts();}
    });
    if(params.has('bucket')&&type!=='items'){
      const area=$('#chart-drilldown');area.textContent=lang==='ru'?'Загрузка матчей…':'Loading games…';
      const selection=new URLSearchParams(q);for(const k of ['bucket','bucketFrom','bucketTo','chartOutcome','chartPage'])if(params.has(k))selection.set(k,params.get(k));
      const response=await fetch(base+'/api/chart-matches/'+type+'?'+selection,{signal});if(!response.ok)throw new Error('Selection unavailable');const games=await response.json();
      if(serial!==chartsRequest||!area.isConnected)return;
      area.innerHTML=`<div class="chart-drill-title"><h3>${lang==='ru'?'Матчи выбранной группы':'Selected games'} · ${games.total}</h3><button id="chart-clear">${lang==='ru'?'Закрыть':'Close'}</button></div><div class="chart-drill-list">${games.items.length?games.items.map(matchRow).join(''):`<p class="empty">${t('empty')}</p>`}</div>${games.pages>1?`<div class="chart-drill-pager"><button data-chart-page="${games.page-1}" ${games.page<=1?'disabled':''}>←</button><span>${games.page} / ${games.pages}</span><button data-chart-page="${games.page+1}" ${games.page>=games.pages?'disabled':''}>→</button></div>`:''}`;
      $('#chart-clear').onclick=()=>{resetChartSelection();writeLocation();refreshCharts();};
      area.querySelectorAll('[data-chart-page]').forEach(b=>b.onclick=()=>{params.set('chartPage',b.dataset.chartPage);writeLocation();refreshCharts();});
      mountAchievementBadges();
    }
  }catch(e){if(e.name==='AbortError'||serial!==chartsRequest)return;if($('#results')){$('#results').innerHTML=`<div class="chart-error">${t('error')} <button id="chart-retry">${t('retry')}</button></div>`;$('#chart-retry').onclick=refreshCharts;}}
}

let renderEpoch=0,onlineCleanup=()=>{},profileAwardCleanup=()=>{};
window.addEventListener('pagehide',()=>{onlineCleanup();homeCleanup();profileAwardCleanup();});
window.addEventListener('pageshow',event=>{if(event.persisted)render();});
async function render(){
  const section=profileSection(params);if(section){view=section;if(params.get('view')!==section){params.set('view',section);writeLocation();}}
  document.documentElement.dataset.page=isHome()?'home':'inner';
  chartsAbort?.abort();chartsRequest++;chartsCleanup();chartsCleanup=()=>{};
  dynamicsCleanup();
  onlineCleanup();onlineCleanup=()=>{};
  profileAwardCleanup();profileAwardCleanup=()=>{};
  homeCleanup();homeCleanup=()=>{};
  const epoch=++renderEpoch;requestId++;preferences();$('#content').setAttribute('aria-busy','true');
  try{
    mountSharedShell();await refreshOverview(epoch);if(epoch!==renderEpoch)return;
    if(view==='about'){$('#content').innerHTML=aboutPage(lang,link({view:null,match:null,profile:null,kind:null,page:null}));if(location.hash)document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();return;}
    if(view==='online'&&!params.has('match')&&!params.has('profile')){document.title=t('online')+' · BotStats · Q2PRO-X';$('#content').innerHTML=onlinePage(lang,'');onlineCleanup=mountOnline($('#content'),{base,lang,params,onState:(key,value)=>{if(value===null)params.delete(key);else params.set(key,value);writeLocation();}});return;}
    if(isHome()){await showHome(epoch);return;}
    if(view==='achievements'&&!params.has('match')&&!params.has('profile')){await showAchievements(epoch);return;}
    if(params.has('profile')&&!params.has('match')){await profile(epoch);if(epoch===renderEpoch&&location.hash==='#profile-achievements')document.getElementById('profile-achievements')?.scrollIntoView();return;}
    if(params.has('match')){await detail(params.get('match'),epoch);return;}
    const nextFacets=await api('facets');if(epoch!==renderEpoch)return;facets=nextFacets;
    $('#content').innerHTML=listShell();mountFilters();await refresh();
  }catch(e){if(epoch===renderEpoch){$('#content').innerHTML=`<div class="error">${t('error')}<br><button id="retry">${t('retry')}</button></div>`;$('#retry').onclick=render;}}
  finally{if(epoch===renderEpoch){mountAchievementBadges();profileAwardCleanup=mountProfileAwardMotion($('#content'));$('#content').setAttribute('aria-busy','false');}}
}
document.addEventListener('click',e=>{
  const link=e.target.closest('[data-view]');if(!link||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button)return;
  e.preventDefault();const target=new URL(link.href);[...params.keys()].forEach(k=>params.delete(k));target.searchParams.forEach((v,k)=>params.set(k,v));view=params.get('view')||'home';writeLocation('push');render();
});
let achievementSearchTimer;
async function showAchievements(epoch){
  const id=params.get('achievement');let body;
  if(id){let value;try{value=await api('achievements/'+encodeURIComponent(id)+'?'+new URLSearchParams({player:params.get('awardPlayer')||'',page:params.get('awardPage')||'1',sort_award_evidence:params.get('sort_award_evidence')||'date',dir_award_evidence:params.get('dir_award_evidence')||'asc',lang}));}catch(e){if(e.message!=='HTTP 404')throw e;value=null;}if(epoch!==renderEpoch)return;body=achievementPage(value,{lang,link,params,renderMatch:evidenceMatchRow});if(value)document.title=value.name[lang]+' · BotStats';}
  else body=achievementsPage(awardCatalog,{lang,link,params});
  $('#content').innerHTML=`<section class="workspace achievements-workspace">${body}</section>`;
  const input=$('#achievement-search');if(input)input.oninput=()=>{clearTimeout(achievementSearchTimer);achievementSearchTimer=setTimeout(async()=>{const value=input.value,position=input.selectionStart;if(value)params.set('achievementSearch',value);else params.delete('achievementSearch');writeLocation();await render();const next=$('#achievement-search');if(next){next.focus({preventScroll:true});if(position!==null)next.setSelectionRange(position,position);}},250);};
}
writeLocation();
render();
