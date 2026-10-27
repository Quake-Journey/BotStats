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
export function renderTable(id,columns,rows,{params,lang,defaultKey=columns[0].key,defaultDir='desc',presorted=false}) {
  const state=sortState(id,columns,params,defaultKey,defaultDir),column=columns.find(c=>c.key===state.key);
  const sorted=presorted?rows:sortRows(rows,column.value,state.dir,lang);
  return `<div class="table-wrap"><table class="data-table${columns.length>=12?' rating-table':''}" data-table="${esc(id)}"><thead><tr>${columns.map(c=>`<th scope="col"${c.cellClass?` class="${esc(c.cellClass)}"`:""} aria-sort="${state.key===c.key?(state.dir==='asc'?'ascending':'descending'):'none'}">${sortButton(id,c,state,lang)}</th>`).join('')}</tr></thead><tbody>${sorted.map(row=>`<tr>${columns.map(c=>`<td data-label="${esc(c.label+(c.hint?' ('+c.hint+')':''))}"${c.text||c.cellClass?` class="${esc([c.text?"text-cell":null,c.cellClass].filter(Boolean).join(" "))}"`:""}><span class="cell-value">${c.render?c.render(row):esc(c.value(row)??'—')}</span></td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
