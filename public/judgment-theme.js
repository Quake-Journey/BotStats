let controller=null,currentKey='',loaded=null,sequence=0,headerObserver=null;
export function clearJudgment(){sequence++;controller?.abort();controller=null;headerObserver?.disconnect();headerObserver=null;document.getElementById('judgment-scene')?.remove();currentKey='';loaded=null;}
export async function updateJudgment({base,params,summary=null}){
  if(document.documentElement.dataset.theme!=='judgment')return;
  if(!document.getElementById('judgment-css')){const css=document.createElement('link');css.id='judgment-css';css.rel='stylesheet';css.href=new URL('./judgment.css',import.meta.url);document.head.append(css);}
  if(!document.getElementById('judgment-scene')){
    const scene=document.createElement('div');scene.id='judgment-scene';scene.setAttribute('aria-hidden','true');scene.innerHTML='<div class="judgment-base"></div><div class="judgment-machines"></div><div class="judgment-person"></div><div class="judgment-shade"></div><div class="judgment-vignette"></div>';document.body.prepend(scene);
    const header=document.querySelector('header');headerObserver=new ResizeObserver(()=>scene.style.setProperty('--header-height',header.getBoundingClientRect().height+'px'));headerObserver.observe(header);
  }
  const q=new URLSearchParams();for(const k of ['period','from','to','map','q','bot','style','skill','modVersion','overtime'])if(params.has(k))q.set(k,params.get(k));
  if(params.has('profile')){q.set('identity',params.get('profile'));q.set('kind',params.get('kind')||'human');}
  const key=q.toString();
  function paint(data){
    const h=data.totals.humanWins,b=data.totals.botWins,n=h+b,share=n?b/n:0.5,scene=document.getElementById('judgment-scene');if(!scene)return;
    scene.style.setProperty('--machine-share',String(share));scene.style.setProperty('--machine-shade',String(.65*(1-share)));scene.dataset.botShare=n?String(share):'unknown';scene.dataset.person=share>=.6?'weary':'hopeful';
  }
  if(summary){controller?.abort();controller=null;sequence++;currentKey=key;if(summary){loaded={data:{totals:summary},at:Date.now()};paint(loaded.data);}else if(loaded)paint(loaded.data);return;}
  if(currentKey===key&&loaded&&Date.now()-loaded.at<20000){paint(loaded.data);return;}
  if(currentKey===key&&controller&&!controller.signal.aborted)return;
  controller?.abort();controller=new AbortController();const own=++sequence;currentKey=key;
  try{const response=await fetch(base+'/api/charts/balance?'+q,{signal:controller.signal});if(!response.ok)throw new Error('Balance unavailable');const data=await response.json();if(own!==sequence||document.documentElement.dataset.theme!=='judgment')return;loaded={data,at:Date.now()};paint(data);}catch(e){/* Keep the current scene if the balance is temporarily unavailable. */}finally{if(own===sequence)controller=null;}
}
