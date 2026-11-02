const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function winLabel(value,lang){
  if(lang!=='ru')return value===1?'win':'wins';
  const n=Math.abs(value),last=n%10,lastTwo=n%100;
  return last===1&&lastTwo!==11?'победа':last>=2&&last<=4&&(lastTwo<12||lastTwo>14)?'победы':'побед';
}
export function homePage(summary,{lang,link,badges}){
  const ru=lang==='ru',number=n=>new Intl.NumberFormat(lang).format(n);
  const to=(view,extra={})=>link({view,match:null,profile:null,kind:null,achievement:null,awardPlayer:null,awardPage:null,page:null,...extra});
  function roster(bot){
    const players=summary.players.filter(p=>p.isBot===bot).sort((a,b)=>b.wins-a.wins||b.matches-a.matches||a.name.localeCompare(b.name,lang));
    return `<section class="home-roster" id="home-${bot?'bots':'humans'}"><div class="home-section-head"><div><h2>${bot?(ru?'Боты-убийцы':'Bot killers'):(ru?'Люди на арене':'Humans in the arena')}</h2><p>${ru?'По числу побед, от большего к меньшему.':'Ordered by wins, highest first.'}${bot?(ru?' Включая forfeit.':' Including forfeits.'):''}</p></div><a ${to(bot?'bots':'players')}>${ru?'Все профили':'All profiles'} ↗</a></div><div class="home-participants">${players.length?players.map((p,i)=>`<article class="home-participant ${bot?'bot':'human'}" data-wins="${p.wins}"><div class="home-person-heading"><span class="home-place">${i+1}</span><a class="home-person-name" ${to(bot?'bots':'players',{profile:p.name,kind:bot?'bot':'human'})}>${esc(p.name)}</a><span class="home-person-wins"><b>${number(p.wins)}</b><span>${winLabel(p.wins,lang)}</span></span></div><div class="home-person-meta">${ru?'Матчей':'Matches'}: ${number(p.matches)}</div>${badges(p)||`<span class="home-no-awards">${ru?'Пока без достижений':'No achievements yet'}</span>`}</article>`).join(''):`<p class="empty">${ru?'Участников пока нет.':'No participants yet.'}</p>`}</div></section>`;
  }
  return `<section class="home-page">${roster(true)}${roster(false)}</section>`;
}
