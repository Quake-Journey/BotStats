import {botAvatar} from './bot-avatars.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function winLabel(value,lang){
  if(lang!=='ru')return value===1?'win':'wins';
  const n=Math.abs(value),last=n%10,lastTwo=n%100;
  return last===1&&lastTwo!==11?'победа':last>=2&&last<=4&&(lastTwo<12||lastTwo>14)?'победы':'побед';
}
export function recentAwards(catalog){
  const grants=(catalog?.items||[]).flatMap(award=>(award.holders||[]).map(holder=>({award,holder})));
  const dated=grants.filter(({holder})=>Number.isFinite(Date.parse(holder.earnedAt)));
  dated.sort((a,b)=>Date.parse(b.holder.earnedAt)-Date.parse(a.holder.earnedAt)||a.award.id.localeCompare(b.award.id)||a.holder.name.localeCompare(b.holder.name));
  return {total:grants.length,items:dated.slice(0,4)};
}
export function homePage(summary,{lang,link,badges,catalog}){
  const ru=lang==='ru',number=n=>new Intl.NumberFormat(lang).format(n),percent=n=>new Intl.NumberFormat(lang,{style:'percent',maximumFractionDigits:1}).format(n);
  const to=(view,extra={})=>link({view,match:null,profile:null,kind:null,achievement:null,awardPlayer:null,awardPage:null,page:null,...extra});
  const more=(shown,total,destination,label)=>`<div class="home-section-more"><span class="home-shown">${ru?'Показано':'Showing'} ${number(shown)} ${ru?'из':'of'} ${number(total)}</span><a ${destination}>${label} ↗</a></div>`;
  const awards=recentAwards(catalog),asset=file=>new URL('./'+file,import.meta.url).href;
  const when=value=>new Intl.DateTimeFormat(lang,{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Moscow'}).format(new Date(value));
  const intro=`<section class="home-intro" aria-labelledby="home-awards-title"><div class="home-awards-heading"><h3 id="home-awards-title">${ru?'Последние достижения':'Latest achievements'}</h3>${more(awards.items.length,awards.total,to('achievements',{awardKind:null,achievementSearch:null}),ru?'Все достижения':'All achievements')}</div><div class="home-recent-awards">${awards.items.length?awards.items.map(({award,holder})=>{
    const bot=(holder.kind||award.audience)==='bot';
    return `<article class="home-award ${bot?'bot':'human'}"><a class="home-award-heading" ${to('achievements',{achievement:award.id,awardPlayer:holder.name})}><img src="${esc(asset(award.icon))}" width="80" height="80" alt="" loading="lazy"><h4>${esc(award.name[lang])}</h4></a><div class="home-award-holder"><span>${bot?(ru?'Бот':'Bot'):(ru?'Игрок':'Player')}</span><a ${to(bot?'bots':'players',{profile:holder.name,kind:bot?'bot':'human'})}>${esc(holder.name)}</a></div><time datetime="${esc(holder.earnedAt)}">${esc(when(holder.earnedAt))} · ${ru?'МСК':'MSK'}</time></article>`;
  }).join(''):`<p class="home-awards-empty">${awards.total?(ru?'Даты получения достижений неизвестны.':'Achievement dates are unknown.'):(ru?'Ни одного достижения ещё не получено. Играйте больше, чтобы открыть скрытое достижение!':'No achievements have been earned yet. Play more to unlock a hidden achievement!')}</p>`}</div></section>`;
  function roster(bot){
    const players=summary.players.filter(p=>p.isBot===bot).sort((a,b)=>b.wins-a.wins||b.matches-a.matches||a.name.localeCompare(b.name,lang));
    return `<section class="home-roster" id="home-${bot?'bots':'humans'}"><div class="home-section-head"><div><h3>${bot?(ru?'Боты-убийцы':'Bot killers'):(ru?'Люди на арене':'Humans in the arena')}</h3><p>${ru?'По числу побед, от большего к меньшему.':'Ordered by wins, highest first.'}${bot?(ru?' Включая forfeit.':' Including forfeits.'):''}</p></div>${more(Math.min(12,players.length),players.length,to(bot?'bots':'players'),ru?'Все профили':'All profiles')}</div><div class="home-participants">${players.length?players.slice(0,12).map((p,i)=>`<article class="home-participant ${bot?'bot':'human'}" data-wins="${p.wins}"><div class="home-person-heading">${bot?`<a class="home-portrait" ${to('bots',{profile:p.name,kind:'bot'})} aria-label="${esc(p.name)}">${botAvatar(p.name,{size:'roster'})}<span class="home-place">${i+1}</span></a>`:`<span class="home-place">${i+1}</span>`}<a class="home-person-name" ${to(bot?'bots':'players',{profile:p.name,kind:bot?'bot':'human'})}>${esc(p.name)}</a><span class="home-person-wins"><b>${number(p.wins)}</b><span>${winLabel(p.wins,lang)}</span></span></div><div class="home-person-meta"><span>${ru?'Матчей':'Matches'}: ${number(p.matches)}</span><span class="home-person-winrate" title="${ru?'Доля побед во всех матчах, включая forfeit.':'Share of wins across all matches, including forfeits.'}">${percent(p.matches?p.wins/p.matches:0)} ${ru?'побед':'wins'}</span></div>${badges(p)||`<span class="home-no-awards">${ru?'Пока без достижений':'No achievements yet'}</span>`}</article>`).join(''):`<p class="empty">${ru?'Участников пока нет.':'No participants yet.'}</p>`}</div></section>`;
  }
  return `<div class="home-page"><section class="home-ai" aria-labelledby="home-ai-title"><header class="home-ai-heading"><img class="home-ai-icon" src="${esc(asset('achievements/bots/terminator.svg'))}" width="68" height="68" alt=""><div><h2 id="home-ai-title">AI-Powered <span>bots</span></h2><p id="home-mod-version" role="status">${ru?'Версия мода: загрузка…':'Mod version: loading…'}</p></div></header><div class="home-ai-body">${intro}${roster(true)}${roster(false)}</div></section></div>`;
}

let versionCache;
export function mountHomeVersion(element,{base,lang}){
  const ru=lang==='ru';let stopped=false,request,timer;
  function draw(data){
    const label=ru?'Версия мода: ':'Mod version: ';
    element.textContent=label+(data?.version?`${data.mod} · ${data.version}${data.state==='online'?'':(ru?' · данные устарели':' · outdated data')}`:(ru?'нет данных':'unavailable'));
  }
  async function refresh(){
    clearTimeout(timer);if(stopped||document.hidden||request)return;
    if(versionCache&&Date.now()-versionCache.at<30000){draw(versionCache.data);timer=setTimeout(refresh,60000);return;}
    request=new AbortController();
    try{
      const response=await fetch(base+'/api/online/version',{cache:'no-store',signal:AbortSignal.any([request.signal,AbortSignal.timeout(9000)])});
      if(!response.ok)throw new Error('Version unavailable');const data=await response.json();
      if(!stopped){versionCache={data,at:Date.now()};draw(data);}
    }catch{if(!stopped)draw(versionCache?.data?{...versionCache.data,state:'unavailable'}:null);}
    finally{request=null;if(!stopped&&!document.hidden)timer=setTimeout(refresh,60000);}
  }
  function visibility(){if(document.hidden){clearTimeout(timer);request?.abort();}else refresh();}
  document.addEventListener('visibilitychange',visibility);refresh();
  return ()=>{stopped=true;clearTimeout(timer);request?.abort();document.removeEventListener('visibilitychange',visibility);};
}
