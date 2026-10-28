export function profileMatchQuery(params) {
  const q=new URLSearchParams({identity:params.get('profile')||'',kind:params.get('kind')==='bot'?'bot':'human'});
  for(const key of ['period','from','to','overtime','map','style','skill','modVersion','status','sort_matches','dir_matches'])if(params.has(key))q.set(key,params.get(key));
  q.set('page',String(Math.max(1,Math.min(10000,Math.floor(Number(params.get('profilePage'))||1)))));
  return q;
}

export function matchPagination(result,{lang='ru',profile=false}={}) {
  const ru=lang==='ru',page=Math.max(1,Math.floor(Number(result.page)||1)),pages=Math.max(1,Math.floor(Number(result.pages)||1));
  const total=Math.max(0,Number(result.total)||0),start=total?(page-1)*20+1:0,end=Math.min(page*20,total);
  const attr=profile?'data-profile-page':'data-page';
  return `<nav class="pagination" aria-label="${ru?'Страницы матчей':'Match pages'}"><button type="button" ${attr}="${page-1}" ${page<=1?'disabled':''}>${ru?'← Назад':'← Previous'}</button><span>${ru?'Страница':'Page'} ${page} ${ru?'из':'of'} ${pages}<small class="pagination-range">${ru?'Матчи':'Matches'} ${start}–${end} / ${total}</small></span><button type="button" ${attr}="${page+1}" ${page>=pages?'disabled':''}>${ru?'Далее →':'Next →'}</button></nav>`;
}
