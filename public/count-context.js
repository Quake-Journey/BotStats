// Display context is independent of the existing numeric count sort keys.
const number=(value,lang,digits=0)=>Number.isFinite(value)?new Intl.NumberFormat(lang,{maximumFractionDigits:digits}).format(value):'—';
const duration=value=>{
  if(!Number.isFinite(value)||value<=0)return '—';
  const seconds=Math.round(value);
  return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
};
export function winCount(row,{lang='ru'}={}){
  return `<span class="wins-value">${number(row.normalWins,lang)}</span>`;
}
export function winConditions(row,{lang='ru'}={}){
  const ru=lang==='ru',total=row.normalWins??0;
  const ping=value=>Number.isFinite(value)?`${number(value,lang,1)} ${ru?'мс':'ms'}`:'—';
  const entries=[
    [ru?'Скилл бота':'Bot skill',number(row.averageWinBotSkill,lang,1),row.winBotSkillMatches??0],
    [ru?'Пинг бота':'Bot ping',ping(row.averageWinBotPingMs),row.winBotPingMatches??0],
    [ru?'Пинг игрока':'Player ping',ping(row.averageWinHumanPingMs),row.winHumanPingMatches??0]
  ];
  return `<span class="win-conditions">${entries.map(([label,value,known],i)=>{
    const detail=i===0?(ru?'Смены скилла внутри матча учитываются по времени.':'Skill changes within each game are time-weighted.'):(ru?'По наблюдениям таблицы счёта, а не непрерывному сетевому замеру.':'Scoreboard observations, not continuous network measurements.');
    const title=ru?`Среднее по победам без forfeit. Данные: ${known} из ${total} побед. ${detail}`:`Mean across wins excluding forfeits. Data: ${known} of ${total} wins. ${detail}`;
    return `<span class="win-condition" title="${title}"><span class="win-condition-label">${label}:</span> <strong class="win-condition-value">${value}</strong></span>`;
  }).join('')}</span>`;
}
export function winConditionsColumn(lang='ru'){
  const ru=lang==='ru';
  return {key:'averageWinBotSkill',label:ru?'Средние в победах':'Averages in wins',hint:ru?'сортировка по скиллу':'sort by skill',cellClass:'win-conditions-cell',value:r=>r.averageWinBotSkill,render:r=>winConditions(r,{lang})};
}
export function completedWithDuration(row,{lang='ru'}={}){
  const ru=lang==='ru',value=duration(row.averageCompletedDurationSeconds);
  const known=row.completedDurationMatches??0,total=row.completedMatches??0;
  const title=ru?`Средняя длительность завершённого матча, мин:сек. Включая овертайм, без пауз и forfeit. Данные: ${known} из ${total} матчей; фрагменты записей не заменяют полную длительность.`:`Average completed match duration, min:sec. Includes overtime, excludes pauses and forfeits. Data: ${known} of ${total} games; recording fragments do not replace full duration.`;
  return `<span class="completed-info"><b class="positive completed-value">${number(row.completedMatches,lang)}</b><span class="completed-average" title="${title}">${ru?'Среднее время:':'Average time:'} <strong>${value}</strong></span></span>`;
}
