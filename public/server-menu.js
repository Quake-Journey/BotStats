const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={
  ru:{title:'Серверы',loading:'Загрузка серверов…',failed:'Не удалось обновить список серверов.',retry:'Повторить',online:'Все серверы в разделе «Онлайн» ↗',public:'Публичный сервер',lan:'Локальная сеть / VPN',private:'Закрытый доступ',play:'Играть ↗',copy:'Копировать connect',copied:'Скопировано',copyFailed:'Не удалось скопировать',empty:'Серверы не настроены'},
  en:{title:'Servers',loading:'Loading servers…',failed:'Could not refresh the server list.',retry:'Retry',online:'All servers in Online ↗',public:'Public server',lan:'Local network / VPN',private:'Private access',play:'Play ↗',copy:'Copy connect',copied:'Copied',copyFailed:'Could not copy',empty:'No servers configured'}
};
const onlineRoute=id=>({view:'online',onlineServer:id||null,profile:null,kind:null,match:null,page:null,tv:null});

export function serverMenuHTML(servers,{lang,link}){
  const t=labels[lang]||labels.en;
  return servers.map(s=>{
    const m=s.metadata,connect=m.access==='public';
    return `<article class="server-menu-entry" data-server-entry="${esc(s.id)}"><a class="server-menu-name" ${link(onlineRoute(s.id))}>${esc(m.name)} ↗</a><span class="server-menu-address">${esc(m.address)}</span><span class="server-menu-access">${t[m.access]||t.private}</span>${connect?`<div class="server-menu-connect"><a href="quake2://${esc(m.address)}">${t.play}</a><button type="button" data-copy-address="${esc(m.address)}">${t.copy}</button></div>`:''}</article>`;
  }).join('')||`<p>${t.empty}</p>`;
}

export function mountServerMenu(root,{base,getLang,link,fetchImpl=fetch}){
  let servers=null,request,updatedAt=0,failed=false,stopped=false;
  const title=root.querySelector('[data-server-menu-title]'),count=root.querySelector('[data-server-menu-count]'),panel=root.querySelector('.server-menu-panel');
  function render(){
    const lang=getLang(),t=labels[lang]||labels.en;
    title.textContent=t.title;count.hidden=servers===null;count.textContent=servers===null?'':String(servers.length);
    panel.innerHTML=(failed?`<p class="server-menu-error" role="status">${t.failed} <button type="button" data-server-menu-retry>${t.retry}</button></p>`:'')+(servers?serverMenuHTML(servers,{lang,link}):failed?'':`<p role="status">${t.loading}</p>`)+`<a class="server-menu-all" ${link(onlineRoute())}>${t.online}</a>`;
    panel.querySelector('[data-server-menu-retry]')?.addEventListener('click',()=>refresh(true));
    for(const button of panel.querySelectorAll('[data-copy-address]'))button.onclick=async()=>{
      try{await navigator.clipboard.writeText('connect '+button.dataset.copyAddress);if(button.isConnected)button.textContent=t.copied;}
      catch{if(button.isConnected)button.textContent=t.copyFailed;}
    };
  }
  async function refresh(force=false){
    if(stopped||request||!force&&servers&&Date.now()-updatedAt<30000)return;
    const controller=new AbortController();request=controller;
    try{
      const r=await fetchImpl(base+'/api/online/servers',{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(9000)])});
      if(!r.ok)throw Error('No registry');const data=await r.json();
      if(!Array.isArray(data.servers)||data.servers.length>32||data.servers.some(s=>!s?.metadata||!s.id||!s.metadata.name||!s.metadata.address))throw Error('Invalid registry');
      if(stopped)return;servers=data.servers;updatedAt=Date.now();failed=false;
    }catch{if(stopped)return;failed=true;}
    finally{request=null;if(!stopped)render();}
  }
  const toggle=()=>{if(root.open)refresh();};
  const outside=e=>{if(root.open&&!root.contains(e.target))root.open=false;};
  const escape=e=>{if(e.key==='Escape'&&root.open){root.open=false;root.querySelector('summary').focus();}};
  const click=e=>{if(e.target.closest('a'))root.open=false;};
  root.addEventListener('toggle',toggle);root.addEventListener('click',click);document.addEventListener('click',outside);document.addEventListener('keydown',escape);
  render();refresh();
  return {render,close:()=>{root.open=false;},destroy:()=>{stopped=true;request?.abort();root.removeEventListener('toggle',toggle);root.removeEventListener('click',click);document.removeEventListener('click',outside);document.removeEventListener('keydown',escape);}};
}
