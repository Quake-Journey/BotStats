const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const strings={
  ru:{title:'Онлайн',intro:'Что происходит на игровых серверах прямо сейчас',loading:'Получаем данные сервера…',live:'Сервер онлайн',stale:'Данные устарели',unavailable:'Мониторинг временно недоступен',missing:'Сервер не отвечает в мониторинге',players:'Состав сервера',name:'Игрок',score:'Счёт',ping:'Пинг, мс',spectator:'Зритель',empty:'На сервере пока никого нет',settings:'Настройки сервера',map:'Карта',time:'Время до конца',warmup:'Разминка',mod:'Мод',updated:'Данные сервера',checked:'Проверено',refresh:'Обновить',auto:'Обновление',off:'Вручную',seconds:'с',hidden:'Обновление приостановлено, пока вкладка скрыта',staleNote:'Показан последний полученный снимок. Он может отличаться от текущей игры.',watch:'▶ Смотреть Q2TV',close:'Закрыть плеер',fullscreen:'На весь экран',player:'Плеер',automatic:'Автоматически',desktop:'Десктоп',mobile:'Мобильный',playerTitle:'Прямой эфир · Q2TV',playerLoading:'Загрузка Q2TV…',playerSlow:'Q2TV ещё загружается. Подожди или перезапусти плеер.',retry:'Перезапустить',playerHelp:'Нажми внутри плеера для управления и звука. Esc освобождает курсор. Для телефона удобнее горизонтальная ориентация.',copy:'Копировать connect',copied:'Скопировано',join:'Играть',delta:'Изменение счёта с прошлого обновления',unknown:'Нет данных',version:'Версия',hardcore:'Hardcore',training:'Training',yes:'Вкл',no:'Выкл'},
  en:{title:'Online',intro:'Live activity on the game servers',loading:'Loading server status…',live:'Server online',stale:'Outdated data',unavailable:'Monitoring temporarily unavailable',missing:'Server is not responding in monitoring',players:'Players on the server',name:'Player',score:'Score',ping:'Ping, ms',spectator:'Spectator',empty:'Nobody is on the server yet',settings:'Server settings',map:'Map',time:'Time remaining',warmup:'Warmup',mod:'Mod',updated:'Server data',checked:'Checked',refresh:'Refresh',auto:'Refresh',off:'Manual',seconds:'s',hidden:'Updates are paused while this tab is hidden',staleNote:'Showing the last received snapshot. It may differ from the current game.',watch:'▶ Watch Q2TV',close:'Close player',fullscreen:'Fullscreen',player:'Player',automatic:'Automatic',desktop:'Desktop',mobile:'Mobile',playerTitle:'Live · Q2TV',playerLoading:'Loading Q2TV…',playerSlow:'Q2TV is still loading. Please wait or restart the player.',retry:'Restart',playerHelp:'Click inside the player for controls and sound. Landscape orientation works best on a phone.',copy:'Copy connect',copied:'Copied',join:'Play',delta:'Score change since the last update',unknown:'Unknown',version:'Version',hardcore:'Hardcore',training:'Training',yes:'On',no:'Off'}
};

Object.assign(strings.ru,{unknownRole:'Роль не передана',servers:'Сервер',offline:'Сервер не отвечает на запрос',public:'Публичный доступ',lan:'Локальная сеть / VPN',private:'Закрытый доступ',noTV:'Q2TV для этого сервера не настроен',noLiveTV:'Q2TV доступен при свежем статусе онлайн',noConnect:'Публичное подключение недоступно',received:'Отчёт получен',missing:'Статус ещё не получен',unavailable:'Не удалось проверить статус'});
Object.assign(strings.en,{unknownRole:'Role not reported',servers:'Server',offline:'No response from the game server',public:'Public access',lan:'Local network / VPN',private:'Private access',noTV:'Q2TV is not configured for this server',noLiveTV:'Q2TV requires a fresh online status',noConnect:'Public connection unavailable',received:'Report received',missing:'No status received yet',unavailable:'Could not verify status'});

Object.assign(strings.ru,{name:'Участник',connections:'Подключено',playing:'Игроки',inGame:'В игре',spectators:'Зрители',unknownRole:'Роль неизвестна'});
Object.assign(strings.en,{name:'Name',players:'Server roster',connections:'Connected',playing:'Players',inGame:'Playing',spectators:'Spectators',unknownRole:'Role unknown'});

export function rosterCounts(players) {
  const counts={clients:players.length,players:0,spectators:0,unknown:0};
  for(const p of players)counts[p.spectator===true?'spectators':p.spectator===false?'players':'unknown']++;
  return counts;
}

export function rosterCountsHTML(players,lang) {
  const t=strings[lang]||strings.en,counts=rosterCounts(players);
  return `<div class="online-roster-counts">${[['players','playing'],['spectators','spectators'],['unknown','unknownRole']].filter(([key])=>key!=='unknown'||counts.unknown).map(([key,label])=>`<span data-roster-count="${key}">${t[label]}: <b>${counts[key]}</b></span>`).join('')}</div>`;
}

export function scoreChanges(previous,next) {
  const changes=new Map();
  if(!previous||previous.address!==next.address||previous.info.mapname!==next.info.mapname||previous.info.time_remaining==='WARMUP'&&next.info.time_remaining!=='WARMUP'||previous.info.time_remaining!=='WARMUP'&&next.info.time_remaining==='WARMUP')return changes;
  const total=s=>s.players.reduce((a,p)=>a+(p.spectator===true?0:p.score||0),0);
  if(total(previous)>10&&total(next)<total(previous)*0.35)return changes;
  const old=new Map(previous.players.map(p=>[p.name,p]));
  for(const p of next.players){const before=old.get(p.name);if(p.spectator!==true&&before?.spectator===p.spectator&&p.score!==null&&before?.score!=null&&p.score!==before.score)changes.set(p.name,p.score-before.score);}
  return changes;
}

export function playerVariant(choice,navigatorInfo={}) {
  if(['desktop','mobile'].includes(choice))return choice;
  return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigatorInfo.userAgent||'') || navigatorInfo.platform==='MacIntel'&&navigatorInfo.maxTouchPoints>1 ? 'mobile':'desktop';
}

export function liveModesHTML(modes,lang){
  const t=strings[lang]||strings.en;
  const labels=lang==='ru'?{checked:'Режимы проверены',unavailable:'Текущие режимы недоступны'}:{checked:'Modes checked',unavailable:'Current modes unavailable'};
  const values=['hardcore','training'].map(key=>{
    const value=modes?.[key],state=value===1?'on':value===0?'off':'unknown';
    return `<span class="online-mode" data-online-mode="${key}" data-state="${state}"><span>${t[key]}</span><strong>${value===1?t.yes:value===0?t.no:t.unknown}</strong></span>`;
  }).join('');
  const stamp=Date.parse(modes?.checkedAt);
  const checked=Number.isFinite(stamp)?new Date(stamp).toLocaleTimeString(lang==='ru'?'ru-RU':'en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):null;
  return `<div class="online-modes" data-state="${esc(modes?.state||'unknown')}">${values}<span class="online-mode-time">${modes?.state==='current'&&checked?labels.checked+': '+checked:labels.unavailable}</span></div>`;
}

export function onlinePage(lang,navigation) {
  const t=strings[lang]||strings.en,compact=globalThis.matchMedia?.('(max-width:800px)').matches;
  const variant=`<label>${t.player}<select id="online-variant"><option value="auto">${t.automatic}</option><option value="desktop">${t.desktop}</option><option value="mobile">${t.mobile}</option></select></label>`;
  const watch=`<div class="online-watch-controls"><button id="online-watch" class="online-primary" type="button" aria-expanded="false" aria-controls="online-player" disabled>${t.watch}</button>${compact?'':variant}</div>`;
  const toolbar=`<div class="online-toolbar"><label>${t.auto}<select id="online-refresh">${[5,10,30,60,0].map(n=>`<option value="${n}">${n?n+' '+t.seconds:t.off}</option>`).join('')}</select></label><button id="online-reload" type="button">↻ ${t.refresh}</button>${compact?variant:''}</div>`;
  return `<section class="workspace online-workspace${compact?' online-compact':''}">${navigation?`<div class="workspace-head">${navigation}</div>`:''}<div class="online-body">
    <div class="online-heading"><div>${compact?'':'<div class="eyebrow">Q2PRO-X · LIVE</div>'}<h1>${t.title}</h1>${compact?'':`<p>${t.intro}</p>`}</div><span class="online-state" id="online-state" role="status">${t.loading}</span></div>
    <label class="online-server-picker">${t.servers}<select id="online-server-select" aria-label="${t.servers}"><option>${t.loading}</option></select></label>
    ${compact?watch:toolbar}
    <p id="online-availability" class="online-availability"></p>
    <p class="online-updated" id="online-updated"></p>
    ${compact?`<details class="online-options"><summary>${lang==='ru'?'Обновление и плеер':'Refresh and player options'}</summary>${toolbar}</details>`:''}
    <p id="online-warning" class="online-warning" hidden></p>
    <section id="online-server" class="online-server" aria-label="${t.players}"><div class="loading">${t.loading}</div></section>
    ${compact?'':watch}
    <section id="online-player" class="online-player" hidden aria-label="Q2TV"><div class="online-player-toolbar"><h2>${t.playerTitle}</h2><div><button id="online-restart" type="button">${t.retry}</button><button id="online-fullscreen" type="button">⛶ ${t.fullscreen}</button><button id="online-close" type="button">✕ ${t.close}</button></div></div><div class="online-screen" id="online-screen"><div class="online-player-progress" id="online-progress" role="status">${t.playerLoading}</div><div id="online-frame"></div></div><p>${t.playerHelp}</p></section>
  </div></section>`;
}

export function mountOnline(root,{base,lang,params,onState}) {
  const t=strings[lang]||strings.en,$=s=>root.querySelector(s),compact=!!root.querySelector('.online-compact');
  let selected=params.get('onlineServer'),servers=[];
  let stopped=false,timer,request,latest,previous,changes=new Map(),iframe,loadTimer,observer,settingsOpen=params.has('onlineSettings')?params.get('onlineSettings')==='1':!compact;
  let period=[0,5,10,30,60].includes(Number(params.get('onlineRefresh')))&&params.has('onlineRefresh')?Number(params.get('onlineRefresh')):10;
  let variant=['auto','desktop','mobile'].includes(params.get('onlinePlayer'))?params.get('onlinePlayer'):'auto';
  let sort=['name','score','ping'].includes(params.get('sort_online'))?params.get('sort_online'):'score';
  let direction=params.get('dir_online')==='asc'?'asc':'desc';
  const update=(key,value)=>onState(key,value);
  const time=v=>v?new Date(v).toLocaleString(lang==='ru'?'ru-RU':'en-GB',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}):t.unknown;
  function header(){
    if(!latest)return;
    $('#online-state').textContent=latest.state==='online'?t.live:(t[latest.state]||t.unknown);$('#online-state').dataset.state=latest.state;
    $('#online-updated').textContent=`${t.updated}: ${time(latest.server?.updatedAt)} · ${t.checked}: ${time(latest.checkedAt)}${latest.receivedAt?' · '+t.received+': '+time(latest.receivedAt):''}`;
    const warning=$('#online-warning');warning.hidden=latest.state==='online'&&!document.hidden;
    warning.textContent=document.hidden?t.hidden:latest.server?t.staleNote:(t[latest.state]||t.unknown);
    $('#online-watch').disabled=!latest.players||latest.state!=='online';
    $('#online-availability').textContent=!latest.players?t.noTV:latest.state!=='online'?t.noLiveTV:'';
  }
  function draw(){
    header();
    $('#online-server-select').innerHTML=servers.map(s=>`<option value="${esc(s.id)}" ${s.id===selected?'selected':''}>${esc(s.metadata.name)} · ${s.state==='online'?t.live:t[s.state]||t.unknown}</option>`).join('');
    const meta=latest?.metadata;
    const serverHead=meta?`<div class="online-server-head"><h2>${esc(meta.name)}</h2><div class="online-address"><span>${esc(meta.address)}</span><strong>${t[meta.access]||t.unknown}</strong>${meta.access==='public'?`<button id="online-copy" type="button">${t.copy}</button><a href="quake2://${esc(meta.address)}">${t.join} ↗</a>`:`<button type="button" disabled>${t.noConnect}</button>`}</div></div>`:'';
    const bindCopy=()=>{if($('#online-copy'))$('#online-copy').onclick=async()=>{try{await navigator.clipboard.writeText('connect '+meta.address);if($('#online-copy'))$('#online-copy').textContent=t.copied;}catch{}};};
    const s=latest?.server;if(!s){$('#online-server').innerHTML=serverHead+`<p class="online-empty">${t[latest?.state]||t.loading}</p>`;bindCopy();return;}
    const inf=s.info;
    const currentDetails=$('#online-settings');if(currentDetails)settingsOpen=currentDetails.open;
    const compare=(a,b)=>{if(a[sort]==null)return b[sort]==null?0:1;if(b[sort]==null)return -1;const diff=sort==='name'?a.name.localeCompare(b.name,lang):a[sort]-b[sort];return (direction==='asc'?1:-1)*diff;};
    const roleOrder=p=>p.spectator===false?0:p.spectator===true?1:2;
    const rows=[...s.players].sort((a,b)=>roleOrder(a)-roleOrder(b)||compare(a,b)).map(p=>{
      const d=changes.get(p.name)||0;
      return `<tr data-online-role="${p.spectator===true?'spectator':p.spectator===false?'player':'unknown'}"><td class="online-name">${esc(p.name)}<small>${p.spectator===true?t.spectator:p.spectator===false?t.inGame:t.unknownRole}</small></td><td class="online-score">${p.score??'—'}${d?`<small class="online-delta ${d>0?'up':'down'}" title="${t.delta}">${d>0?'▲ +':'▼ '}${d}</small>`:''}</td><td class="online-ping ${p.ping!==null&&p.ping<60?'low':''}">${p.ping??'—'}</td></tr>`;
    }).join('');
    const skip=new Set(['hostname','sv_hostname','mapname','map','maxclients','max_clients','gamename','serverIp','serverPort','time_remaining','sv_hardcore','sv_training','sv_bots_training_mode']);
    const entries=Object.entries(inf).filter(([k])=>!skip.has(k)).sort(([a],[b])=>a.localeCompare(b));
    const modes=liveModesHTML(latest?.modes,lang);
    $('#online-server').innerHTML=`${serverHead}
      <div class="online-metrics"><div><span>${t.map}</span><strong>${esc(inf.mapname||inf.map||'—')}</strong></div><div><span>${t.time}</span><strong>${inf.time_remaining==='WARMUP'?t.warmup:esc(inf.time_remaining||'—')}</strong></div><div data-online-connections><span>${t.connections}</span><strong>${s.players.length}<small> / ${esc(inf.maxclients||inf.max_clients||'—')}</small></strong></div><div><span>${t.mod}</span><strong class="online-mod">${esc(inf.gamename||inf.game||'—')}</strong><small>${esc(latest.version?.version||t.unknown)}</small></div></div>${modes}
      <div class="online-columns"><section class="online-roster"><h3>${t.players}</h3>${rosterCountsHTML(s.players,lang)}${rows?`<table class="online-table"><thead><tr>${['name','score','ping'].map(k=>`<th aria-sort="${sort===k?(direction==='asc'?'ascending':'descending'):'none'}"><button data-online-sort="${k}" type="button">${t[k]} ${sort===k?(direction==='asc'?'↑':'↓'):'↕'}</button></th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`:`<p class="online-empty">${t.empty}</p>`}</section>
      <details id="online-settings" class="online-settings" ${settingsOpen?'open':''}><summary>${t.settings}<span>${entries.length}</span></summary><dl>${entries.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></details></div>`;
    $('#online-settings').ontoggle=e=>{if(e.target.isConnected){settingsOpen=e.target.open;update('onlineSettings',settingsOpen?'1':'0');}};
    for(const button of root.querySelectorAll('[data-online-sort]'))button.onclick=()=>{const key=button.dataset.onlineSort;direction=key===sort?(direction==='asc'?'desc':'asc'):(key==='name'?'asc':'desc');sort=key;update('sort_online',sort);update('dir_online',direction);draw();};
    bindCopy();
  }
  function schedule(){clearTimeout(timer);if(!stopped&&period&&!document.hidden)timer=setTimeout(refresh,period*1000);}
  async function refresh(){
    if(stopped||request)return;clearTimeout(timer);const controller=new AbortController();request=controller;$('#online-reload').disabled=true;
    try{
      const r=await fetch(base+'/api/online/servers',{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(11000)])});if(!r.ok)throw new Error();const data=await r.json();if(stopped||request!==controller)return;
      servers=data.servers;
      const entry=servers.find(s=>s.id===(selected||data.defaultServerId))||servers[0];
      if(!entry)throw new Error();
      if(selected!==entry.id){if(latest&&latest.id!==entry.id)closePlayer();selected=entry.id;previous=null;changes=new Map();update('onlineServer',selected);}
      if(entry.server&&entry.state==='online'&&(!previous||entry.server.updatedAt!==previous.updatedAt||JSON.stringify(entry.server.players)!==JSON.stringify(previous.players))){changes=scoreChanges(previous,entry.server);previous=entry.server;}
      if(entry.state!=='online'){changes=new Map();previous=null;}
      latest=entry;draw();
      if(params.get('tv')==='1'&&!iframe&&latest.state==='online')openPlayer(false);
    }catch(e){if(!stopped&&request===controller){latest={...latest,state:'unavailable',modes:null};changes=new Map();previous=null;draw();}}
    finally{if(request===controller){request=null;if(!stopped){$('#online-reload').disabled=false;schedule();}}}
  }
  function selectServer(id){
    if(id===selected)return;request?.abort();request=null;closePlayer();selected=id;previous=null;changes=new Map();latest=servers.find(s=>s.id===id);update('onlineServer',id);draw();refresh();
  }

  function fit(){if(iframe?.contentWindow)iframe.contentWindow.postMessage({type:'q2tv-fit',w:iframe.clientWidth,h:iframe.clientHeight},location.origin);}
  function closePlayer(save=true){clearTimeout(loadTimer);observer?.disconnect();observer=null;try{iframe?.contentWindow?.q2tvClose?.();}catch{}iframe?.remove();iframe=null;$('#online-player').hidden=true;$('#online-watch').setAttribute('aria-expanded','false');$('#online-watch').textContent=t.watch;$('#online-player').classList.remove('online-expanded');if(save)update('tv',null);}
  function openPlayer(scroll=true){
    if(!latest?.players||latest.state!=='online')return;closePlayer(false);update('tv','1');$('#online-player').hidden=false;$('#online-watch').setAttribute('aria-expanded','true');$('#online-watch').textContent=t.close;
    // A click that opens the player must not leave Enter/Space bound to the
    // same button after its label and action have changed to Close.
    if(document.activeElement?.closest('.online-watch-controls,.online-player-toolbar'))document.activeElement.blur();
    const progress=$('#online-progress');progress.hidden=false;progress.textContent=t.playerLoading;
    iframe=document.createElement('iframe');iframe.title='Q2TV · '+latest.address;iframe.allow='autoplay; fullscreen; cross-origin-isolated; screen-wake-lock';iframe.setAttribute('allowfullscreen','');
    iframe.src=latest.players[playerVariant(variant,navigator)];iframe.onload=fit;$('#online-frame').append(iframe);observer=new ResizeObserver(fit);observer.observe($('#online-screen'));
    loadTimer=setTimeout(()=>{progress.textContent=t.playerSlow;},60000);if(scroll)$('#online-player').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
  }
  function message(event){
    if(!iframe||event.source!==iframe.contentWindow||event.origin!==location.origin)return;
    if(event.data==='q2tv-loaded'){clearTimeout(loadTimer);$('#online-progress').hidden=true;fit();iframe.contentWindow.focus();iframe.contentWindow.postMessage('q2tv-focus-canvas',location.origin);}
    else if(event.data?.type==='q2tv-progress'){const p=Number(event.data.pct);if(Number.isFinite(p))$('#online-progress').textContent=t.playerLoading+' '+Math.max(0,Math.min(100,Math.round(p)))+'%';}
  }
  function visibility(){if(document.hidden)clearTimeout(timer);else refresh();header();}
  $('#online-server-select').onchange=e=>selectServer(e.target.value);
  $('#online-refresh').value=String(period);$('#online-refresh').onchange=e=>{period=Number(e.target.value);update('onlineRefresh',String(period));schedule();};
  $('#online-variant').value=variant;$('#online-variant').onchange=e=>{variant=e.target.value;update('onlinePlayer',variant);if(iframe)openPlayer(false);};
  $('#online-reload').onclick=refresh;$('#online-watch').onclick=()=>iframe?closePlayer():openPlayer();$('#online-close').onclick=()=>closePlayer();$('#online-restart').onclick=()=>openPlayer(false);
  $('#online-fullscreen').onclick=async()=>{const panel=$('#online-player');if(document.fullscreenElement){await document.exitFullscreen();return;}try{if(panel.requestFullscreen)await panel.requestFullscreen();else panel.classList.toggle('online-expanded');}catch{panel.classList.toggle('online-expanded');}fit();};
  const escape=e=>{if(e.key==='Escape')$('#online-player').classList.remove('online-expanded');};
  window.addEventListener('message',message);document.addEventListener('visibilitychange',visibility);document.addEventListener('keydown',escape);
  refresh();
  return ()=>{stopped=true;clearTimeout(timer);request?.abort();closePlayer(false);window.removeEventListener('message',message);document.removeEventListener('visibilitychange',visibility);document.removeEventListener('keydown',escape);};
}
