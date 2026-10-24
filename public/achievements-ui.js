import {renderTable} from './tables.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const asset=file=>new URL('./'+file,import.meta.url).href;
const when=(s,lang)=>s?new Intl.DateTimeFormat(lang,{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Moscow'}).format(new Date(s)):'—';
const duration=s=>s==null?'—':`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
const playerPlural=new Intl.PluralRules('ru');
function holdersText(n,lang){
  if(lang!=='ru')return `Earned by ${n} ${n===1?'player':'players'}`;
  const form=playerPlural.select(n);
  return `${form==='one'?'Обладает':'Обладают'} ${n} ${{one:'игрок',few:'игрока',many:'игроков',other:'игрока'}[form]}`;
}
const awardLink=(link,id,player=null)=>link({view:'achievements',achievement:id,awardPlayer:player,awardPage:null,match:null,profile:null,kind:null,page:null});
export function achievementBadges(catalog,name,{lang,link,large=false}={}){
  const items=(catalog?.items||[]).filter(a=>a.holders.some(p=>p.name===name));
  if(!items.length)return '';
  return `<span class="achievement-badges${large?' large':''}" aria-label="${lang==='ru'?'Достижения':'Achievements'}">${items.map(a=>`<a class="achievement-mini" ${awardLink(link,a.id,name)} title="${esc(a.name[lang])}" aria-label="${esc(a.name[lang])}"><img src="${esc(asset(large?a.icon:a.icon.replace('.webp','-mini.webp')))}" width="${large?80:36}" height="${large?80:36}" alt="${esc(a.name[lang])}" loading="${large?'eager':'lazy'}"></a>`).join('')}</span>`;
}
export function achievementProfile(catalog,name,options){
  const ru=options.lang==='ru',badges=achievementBadges(catalog,name,{...options,large:true});
  return `<section class="panel profile-achievements"><div class="achievement-section-title"><h2>${ru?'Достижения':'Achievements'}</h2><a ${awardLink(options.link,null)}>${ru?'Все достижения →':'All achievements →'}</a></div>${badges||`<p class="sub">${ru?'У этого игрока пока нет достижений.':'This player has no achievements yet.'}</p>`}<p class="sub">${ru?'Награды за всю историю игр. Нажми на значок, чтобы открыть условия и подтверждающие матчи.':'Awards across the entire match history. Select a badge to see its rules and qualifying matches.'}</p></section>`;
}
function holder(p,id,{lang,link}){
  return `<span class="achievement-holder"><a ${link({view:'players',profile:p.name,kind:'human',match:null,achievement:null,awardPlayer:null,awardPage:null})}>${esc(p.name)}</a><a class="award-proof-link" ${awardLink(link,id,p.name)} aria-label="${esc((lang==='ru'?'Подтверждающие матчи: ':'Qualifying matches: ')+p.name)}" title="${lang==='ru'?'Подтверждающие матчи':'Qualifying matches'}">↗</a></span>`;
}
export function achievementsPage(catalog,options){
  const {lang,link,params}=options,ru=lang==='ru',query=params.get('achievementSearch')||'';
  const rows=catalog.items.filter(a=>!query||[a.name[lang],...a.holders.map(h=>h.name)].some(x=>x.toLocaleLowerCase().includes(query.toLocaleLowerCase())));
  const head=`<div class="achievement-heading"><div class="eyebrow">Q2PRO-X · BOTSTATS</div><h1>${ru?'Достижения':'Achievements'}</h1><p>${ru?'За каждым значком — история матча. Открывай награды, собирай коллекцию и оставляй свой след на арене.':'Every badge tells a match story. Unlock awards, build your collection and leave your mark on the arena.'}</p><span class="achievement-count">${ru?'Открыто достижений':'Achievements unlocked'} <b>${catalog.items.length}</b></span></div>`;
  if(!catalog.items.length)return head+`<div class="achievement-empty"><span aria-hidden="true">◇</span><p>${ru?'Ни одного достижения ещё не получено. Играйте больше, чтобы открыть скрытое достижение!':'No achievements have been earned yet. Play more to unlock a hidden achievement!'}</p></div>`;
  const columns=[
    {key:'name',label:ru?'Достижение':'Achievement',text:true,value:a=>a.name[lang],render:a=>`<div class="achievement-caption"><a class="achievement-art" ${awardLink(link,a.id)} aria-label="${esc(a.name[lang])}"><img src="${esc(asset(a.icon))}" alt="" width="128" height="128" loading="lazy"></a><div><h2><a ${awardLink(link,a.id)}>${esc(a.name[lang])}</a></h2><p>${esc(a.description[lang])}</p>${a.revocable?`<span class="badge award-revocable">${ru?'Может быть отозвано':'Can be revoked'}</span>`:''}</div></div>`},
    {key:'holders',label:ru?'Обладатели':'Award holders',value:a=>a.holders.length,render:a=>`<div class="achievement-holders">${a.holders.map(p=>holder(p,a.id,options)).join('')}</div>`},
    {key:'date',label:ru?'Впервые получено · МСК':'First earned · MSK',value:a=>a.holders[0].earnedAt,render:a=>`<span class="achievement-first-date">${esc(when(a.holders[0].earnedAt,lang))}</span><span class="achievement-holder-count">${holdersText(a.holders.length,lang)}</span>`}
  ];
  return head+`<div class="achievement-toolbar"><label for="achievement-search">${ru?'Поиск достижения или игрока':'Find an achievement or player'}</label><input type="search" id="achievement-search" maxlength="100" value="${esc(query)}" placeholder="${ru?'Название или ник…':'Title or nickname…'}"></div><div class="achievement-list">${rows.length?renderTable('achievements',columns,rows,{params,lang,defaultKey:'date'}):`<div class="empty">${ru?'По этому запросу ничего не найдено.':'Nothing matches this search.'}</div>`}</div>`+generalRules(lang);
}
function generalRules(lang){const ru=lang==='ru';return `<details class="achievement-rules"><summary>${ru?'Как выдаются достижения':'How achievements are awarded'}</summary><p>${ru?'Достижения считаются за всё время и не добавляют очки рейтинга. Неоткрытые награды скрыты. Для условий «200+» скилл должен быть не ниже 200 весь матч, для «ниже 100» — оставаться ниже 100 весь матч; шкала Human-X не пересчитывается. Если нужных данных нет, награда не выдаётся по предположению.':'Achievements cover all recorded history and do not add rating points. Locked awards are hidden. For “200+”, skill must remain at least 200 throughout the match; for “below 100”, it must stay below 100 throughout. Human-X skill is not rescaled. Missing required data is never guessed.'}</p><p>${ru?'Forfeit учитывается только там, где это прямо указано. Для серий важен порядок матчей; forfeit пропускается, прерванная запись разрывает серию. Награды сохраняются после дальнейших поражений, кроме явно отмеченной отзываемой награды. Изменение или удаление исходной статистики приводит к перерасчёту.':'Forfeits count only when a rule explicitly allows them. Streaks follow match order: forfeits are skipped, interrupted recordings break the streak. Later losses do not remove awards unless marked revocable. Corrected or deleted source statistics are recalculated.'}</p></details>`;}
export function achievementPage(a,options){
  const {lang,link,params}=options,ru=lang==='ru';
  if(!a)return `<a class="back" ${awardLink(link,null)}>${ru?'← Все достижения':'← All achievements'}</a><div class="empty">${ru?'Это достижение ещё не открыто или недоступно.':'This achievement is still locked or unavailable.'}</div>`;
  const selected=a.evidence?.player;
  const columns=[{key:'name',label:ru?'Игрок':'Player',text:true,value:p=>p.name,render:p=>holder(p,a.id,options)},
    {key:'date',label:ru?'Получено · МСК':'Earned · MSK',value:p=>p.earnedAt,render:p=>esc(when(p.earnedAt,lang))},
    {key:'metric',label:ru?'Результат':'Result',value:p=>p.metric,render:p=>a.revocable?`${p.losses} − ${p.wins} = <b>${p.metric}</b>`:`<a class="button-link" ${awardLink(link,a.id,p.name)}>${ru?'Посмотреть матчи':'View matches'} →</a>`}];
  let evidence='';
  if(a.evidence){const e=a.evidence;
    const cols=[{key:'date',label:ru?'Дата · МСК':'Date · MSK',value:m=>m.startedAt,render:m=>esc(when(m.startedAt,lang))},
      {key:'map',label:ru?'Карта':'Map',text:true,value:m=>m.map},
      {key:'bot',label:ru?'Соперник':'Opponent',text:true,value:m=>m.bot},
      {key:'score',label:ru?'Счёт игрока : бота':'Player : bot score',value:m=>m.score,render:m=>`<a ${link({view:'matches',match:m.id,profile:null,achievement:null,awardPlayer:null,awardPage:null})}>${m.score[0]} : ${m.score[1]} ↗</a>`},
      {key:'duration',label:ru?'Длительность':'Duration',value:m=>m.durationSeconds,render:m=>duration(m.durationSeconds)}];
    evidence=`<section class="panel award-evidence" id="evidence"><h2>${ru?'Подтверждающие матчи':'Qualifying matches'} · ${esc(selected)}</h2><p class="sub">${ru?'Матчей':'Matches'}: ${e.total}</p>${renderTable('award_evidence',cols,e.matches,{params,lang,defaultKey:'date',defaultDir:'asc',presorted:true})}${e.pages>1?`<nav class="pagination">${e.page>1?`<a class="button-link" ${link({awardPage:e.page-1})}>←</a>`:''}<span>${e.page} / ${e.pages}</span>${e.page<e.pages?`<a class="button-link" ${link({awardPage:e.page+1})}>→</a>`:''}</nav>`:''}</section>`;
  }
  return `<a class="back" ${awardLink(link,null)}>${ru?'← Все достижения':'← All achievements'}</a><section class="achievement-detail"><img class="achievement-detail-art" src="${esc(asset(a.icon))}" width="240" height="240" alt=""><div><div class="eyebrow">${ru?'Достижение':'Achievement'}</div><h1>${esc(a.name[lang])}</h1><p>${esc(a.description[lang])}</p><span class="achievement-count">${ru?'Обладателей':'Award holders'} <b>${a.holders.length}</b></span>${a.revocable?`<p class="award-revocable">${ru?'Текущая награда: может быть отозвана и получена снова.':'A current award: it can be revoked and earned again.'}</p>`:''}</div></section><section class="panel"><h2>${ru?'Обладатели':'Award holders'}</h2>${renderTable('award_holders',columns,a.holders,{params,lang,defaultKey:'date',defaultDir:'asc'})}</section>${evidence}${generalRules(lang)}`;
}
