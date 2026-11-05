import {sortRows} from './sort.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function sortState(id,columns,params,defaultKey,defaultDir='desc') {
  const key=columns.some(c=>c.key===params.get('sort_'+id))?params.get('sort_'+id):defaultKey;
  return {key,dir:['asc','desc'].includes(params.get('dir_'+id))?params.get('dir_'+id):defaultDir};
}
export function sortButton(id,column,state,lang) {
  const active=state.key===column.key,dir=active&&state.dir==='asc'?'desc':active?'asc':column.text?'asc':'desc';
  const title=lang==='ru'?`Сортировать: ${column.label}, ${dir==='asc'?'по возрастанию':'по убыванию'}`:`Sort ${column.label}, ${dir==='asc'?'ascending':'descending'}`;
  return `<button type="button" class="sort-button${active?' sorted':''}" data-sort-table="${esc(id)}" data-sort-key="${esc(column.key)}" data-sort-dir="${dir}" title="${esc(column.title||title)}" aria-label="${esc(title)}"><span class="column-label">${esc(column.label)}${column.hint?`<small class="column-hint">${esc(column.hint)}</small>`:''}</span><span class="sort-arrow" aria-hidden="true">${active?(state.dir==='asc'?'↑':'↓'):'↕'}</span></button>`;
}
export function compactSort(id,columns,state,lang) {
  const ru=lang==='ru',label=ru?'Сортировка':'Sort by',next=state.dir==='asc'?'desc':'asc';
  return `<div class="compact-sort"><label for="sort-${esc(id)}">${label}</label><select id="sort-${esc(id)}" data-sort-select="${esc(id)}">${columns.map(c=>`<option value="${esc(c.key)}" data-direction="${c.text?'asc':'desc'}" ${state.key===c.key?'selected':''}>${esc(c.label)}</option>`).join('')}</select><button type="button" data-sort-table="${esc(id)}" data-sort-key="${esc(state.key)}" data-sort-dir="${next}" aria-label="${ru?'Изменить порядок':'Reverse order'}: ${next==='asc'?(ru?'по возрастанию':'ascending'):(ru?'по убыванию':'descending')}">${state.dir==='asc'?'↑':'↓'}</button></div>`;
}
function compactRows(id,columns,rows,lang) {
  const ru=lang==='ru',cell=(c,r)=>c.render?c.render(r):esc(c.value(r)??'—');
  const labels=ru?{matches:'Матчи',normalWins:'Победы',wins:'Победы',forfeits:'Forfeit',points:'Очки',victoryPoints:'Очки побед',completedMatches:'Завершено',performance:'Индекс',performanceGames:'В расчёте',botWins:'Побед бота',botWinPercent:'Бот, %',humanScore:'Счёт',duration:'Время'}:{matches:'Games',normalWins:'Wins',wins:'Wins',forfeits:'Forfeit',points:'Points',victoryPoints:'Win points',completedMatches:'Finished',performance:'Index',performanceGames:'Rated',botWins:'Bot wins',botWinPercent:'Bot, %',humanScore:'Score',duration:'Time'};
  // Participants and pairs stay identifiable; secondary statistics remain available
  // on demand instead of making every person a full-screen table.
  const identities=columns.filter((c,i)=>i===0||(['bot','human'].includes(c.key)&&['victims','defeats','botdefeats'].includes(id)));
  const preferred=id==='players'?['matches','normalWins','forfeits']:id==='rating_bots'?['matches','wins','points']:id==='victims'?['botWins','matches','botWinPercent']:['defeats','botdefeats'].includes(id)?['humanScore','map','duration']:[];
  const metrics=preferred.length?preferred.map(k=>columns.find(c=>c.key===k)).filter(Boolean):columns.filter(c=>!identities.includes(c)).slice(0,3);
  const short=(c,r)=>{
    const v=c.value(r);
    if(['matches','normalWins','forfeits','wins','points','botWins','victoryPoints','completedMatches','performance'].includes(c.key)&&typeof v==='number')return esc(v.toLocaleString(lang,{maximumFractionDigits:2}));
    if(c.key==='completedMatches'&&Array.isArray(v))return esc(v[0]);
    return cell(c,r);
  };
  return `<div class="compact-rows" data-table="${esc(id)}">${rows.map(r=>`<article class="compact-row" data-kind="${r.isBot?'bot':'human'}"><div class="compact-identities">${identities.map(c=>`<div class="compact-identity">${cell(c,r)}</div>`).join('')}</div><div class="compact-metrics">${metrics.map(c=>`<div data-metric="${esc(c.key)}" title="${esc(c.label)}"><span>${esc(labels[c.key]||c.label)}</span><strong>${short(c,r)}</strong></div>`).join('')}</div><details class="compact-row-details"><summary>${ru?'Подробнее':'Details'}</summary><dl>${columns.filter(c=>!identities.includes(c)).map(c=>`<div><dt>${esc(c.label)}${c.hint?` <small>${esc(c.hint)}</small>`:''}</dt><dd>${cell(c,r)}</dd></div>`).join('')}</dl></details></article>`).join('')}</div>`;
}
export function renderTable(id,columns,rows,{params,lang,defaultKey=columns[0].key,defaultDir='desc',presorted=false,mobileRow=null}) {
  const state=sortState(id,columns,params,defaultKey,defaultDir),column=columns.find(c=>c.key===state.key);
  const sorted=presorted?rows:sortRows(rows,column.value,state.dir,lang);
  const mobile=globalThis.matchMedia?.('(max-width:800px)').matches;
  if(mobile&&mobileRow)return compactSort(id,columns,state,lang)+`<div class="match-list" data-table="${esc(id)}">${sorted.map(mobileRow).join('')}</div>`;
  if(mobile&&(columns.length>=5||id==='popularity'))return compactSort(id,columns,state,lang)+compactRows(id,columns,sorted,lang);
  return `${mobile?compactSort(id,columns,state,lang):''}<div class="table-wrap${mobile?' mobile-small-table':''}"><table class="data-table${columns.length>=12?' rating-table':''}" data-table="${esc(id)}"><thead><tr>${columns.map(c=>`<th scope="col"${c.cellClass?` class="${esc(c.cellClass)}"`:""} aria-sort="${state.key===c.key?(state.dir==='asc'?'ascending':'descending'):'none'}">${sortButton(id,c,state,lang)}</th>`).join('')}</tr></thead><tbody>${sorted.map(row=>`<tr>${columns.map(c=>`<td data-label="${esc(c.label+(c.hint?' ('+c.hint+')':''))}"${c.text||c.cellClass?` class="${esc([c.text?"text-cell":null,c.cellClass].filter(Boolean).join(" "))}"`:""}><span class="cell-value">${c.render?c.render(row):esc(c.value(row)??'—')}</span></td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
