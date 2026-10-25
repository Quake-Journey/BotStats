import {renderTable} from './tables.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function playersPage(summary,{lang,params,link,badges}){
  const ru=lang==='ru',num=(n,d=0)=>n==null?'—':n.toLocaleString(lang,{maximumFractionDigits:d});
  const date=s=>s?new Intl.DateTimeFormat(lang,{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'}).format(new Date(s)):'—';
  const rows=summary.players.filter(p=>!p.isBot).sort((a,b)=>a.name.localeCompare(b.name,lang));
  const columns=[
    {key:'name',label:ru?'Игрок':'Player',text:true,value:p=>p.name,render:p=>`<a class="player-directory-name" ${link({view:'players',profile:p.name,kind:'human',match:null,page:null})}>${esc(p.name)}</a>${badges(p)}`},
    ...[['matches',ru?'Всего матчей':'Recorded games'],['normalWins',ru?'Победы':'Wins'],['normalLosses',ru?'Поражения без forfeit':'Losses without forfeits'],['forfeits','Forfeit'],['draws',ru?'Ничьи':'Draws'],['completedWinRate',ru?'Победы без forfeit, %':'Wins excluding forfeits, %']].map(([key,label])=>({key,label,value:p=>p[key],render:p=>num(p[key],key==='completedWinRate'?1:0)})),
    {key:'lastGameAt',label:ru?'Последняя игра · МСК':'Last game · MSK',value:p=>p.lastGameAt,render:p=>p.lastGameAt&&p.lastGameMatchId?`<a class="player-directory-last" title="${ru?'Открыть матч':'Open match'}" ${link({view:'matches',match:p.lastGameMatchId,profile:null,kind:null,page:null})}>${esc(date(p.lastGameAt))} ↗</a>`:esc(date(p.lastGameAt))}
  ];
  return `<div class="ranking-intro"><h2>${ru?'Игроки':'Players'}</h2><p>${ru?'Все участники выбранных матчей, включая игроков без побед. Открой профиль по нику или последний матч по дате.':'Everyone in the selected matches, including players without wins. Open a profile by name or the latest match by date.'}</p></div>`+
    (rows.length?renderTable('players',columns,rows,{params,lang,defaultKey:'name',defaultDir:'asc'}):`<div class="empty">${ru?'По этим условиям игроков пока нет.':'No players match these filters.'}</div>`)+
    `<p class="footnote">${ru?'По умолчанию игроки расположены по алфавиту. «Всего матчей» включает forfeit и записи без подтверждённого результата. Победы, обычные поражения, ничьи и процент побед — без forfeit; технические поражения показаны отдельно. Период, карта и остальные фильтры применяются к статистике. Достижения возле ника — за всё время.':'Players are listed alphabetically by default. Recorded games include forfeits and recordings without a confirmed result. Wins, normal losses, draws and win percentage exclude forfeits; technical losses are shown separately. Period, map and other filters apply to statistics. Achievements beside names cover all time.'}</p>`;
}
