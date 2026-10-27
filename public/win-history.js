import {winCount} from './count-context.js';

const validTime=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?Date.parse(value):null;

export function compactMatchDate(value){
  const ms=validTime(value);if(ms===null)return '—';
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'Europe/Moscow'}).formatToParts(new Date(ms)).map(p=>[p.type,p.value]));
  return `${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute}`;
}

export function timeWithoutWin(lastWinAt,asOf){
  const win=validTime(lastWinAt),now=validTime(asOf);
  if(win===null||now===null||win>now)return null;
  const hours=Math.floor((now-win)/3600000);
  return {days:Math.floor(hours/24),hours:hours%24};
}

export function winsWithHistory(row,{lang='ru',asOf}){
  const ru=lang==='ru',elapsed=timeWithoutWin(row.lastWinAt,asOf);
  const note=ru?'Для выбранных фильтров. Даты начала матчей, московское время. Срок без побед — до текущего обновления таблицы.':'For the selected filters. Match start dates in Moscow time. Time without a win is measured at this table update.';
  const values=[
    [ru?'Последняя победа:':'Last win:',compactMatchDate(row.lastWinAt)],
    [ru?'Последняя игра:':'Last match:',compactMatchDate(row.lastGameAt)],
    [ru?'Без побед:':'Without a win:',elapsed?`${elapsed.days} ${ru?'д':'d'} ${elapsed.hours} ${ru?'ч':'h'}`:'—']
  ];
  return `<span class="wins-info" title="${note}">${winCount(row,{lang})}<span class="wins-history">${values.map(([label,value])=>`<span class="wins-history-line"><span class="wins-history-label">${label}</span> <span class="wins-history-value">${value}</span></span>`).join('')}</span></span>`;
}
