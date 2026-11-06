// Animate only hovered profile icons. No polling, timers or rendering loop.
const desktopMotion='(min-width:801px) and (hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)';
const pose=angle=>`perspective(450px) rotateY(${angle}deg)`;
const cycle=8400;

export function mountProfileAwardMotion(root){
  const tiles=[...root.querySelectorAll('#profile-achievements .achievement-badges.large>.achievement-mini')];
  if(!tiles.length||!Element.prototype.animate)return ()=>{};
  const media=matchMedia(desktopMotion),listeners=new AbortController(),states=[];
  function cancel(state){
    if(state.animation){state.animation.onfinish=null;state.animation.cancel();state.animation=null;}
  }
  function reset(state){cancel(state);state.hovered=false;state.icon.style.removeProperty('will-change');}
  function current(state){
    const matrix=new DOMMatrixReadOnly(getComputedStyle(state.icon).transform);
    const angle=(Math.atan2(-matrix.m13,matrix.m11)*180/Math.PI+360)%360;
    const phase=(Number(state.animation?.currentTime)||0)%cycle;
    return {angle:angle<.01||angle>359.99?0:angle,direction:state.mode==='cycle'?(phase<4200?1:-1):state.direction};
  }
  function startCycle(state){
    cancel(state);state.mode='cycle';state.icon.style.willChange='transform';
    state.animation=state.icon.animate([
      {transform:pose(0),offset:0,easing:'ease-in-out'},
      {transform:pose(360),offset:1200/cycle},
      {transform:pose(360),offset:4200/cycle,easing:'ease-in-out'},
      {transform:pose(0),offset:5400/cycle},
      {transform:pose(0),offset:1}
    ],{duration:cycle,iterations:Infinity});
    state.animation.id='profile-award-cycle';
  }
  function finishTurn(state,angle,direction){
    cancel(state);state.mode='settle';state.direction=direction;
    const target=direction>0?360:0,distance=Math.abs(target-angle);
    state.icon.style.willChange='transform';
    const animation=state.icon.animate([{transform:pose(angle)},{transform:pose(target)}],{
      duration:Math.max(500,Math.min(1600,200+distance/360*1400)),
      easing:'cubic-bezier(.2,.7,.3,1)',fill:'forwards'
    });
    state.animation=animation;animation.id='profile-award-settle';
    animation.onfinish=()=>{
      if(state.animation!==animation)return;
      if(state.hovered&&media.matches&&!document.hidden)startCycle(state);
      else reset(state);
    };
  }
  for(const tile of tiles){
    const icon=tile.querySelector('img');if(!icon)continue;
    const state={icon,animation:null,hovered:false,mode:'cycle',direction:1};states.push(state);
    tile.addEventListener('pointerenter',()=>{
      if(!media.matches||document.hidden)return;
      state.hovered=true;
      // Re-entry during braking continues from the same angle without a jump.
      if(state.animation)return;
      startCycle(state);
    },{signal:listeners.signal});
    tile.addEventListener('pointerleave',()=>{
      state.hovered=false;if(!state.animation||state.mode==='settle')return;
      const {angle,direction}=current(state);
      if(!angle){reset(state);return;}
      finishTurn(state,angle,direction);
    },{signal:listeners.signal});
  }
  const resetAll=()=>states.forEach(reset);
  media.addEventListener('change',()=>{if(!media.matches)resetAll();},{signal:listeners.signal});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)resetAll();},{signal:listeners.signal});
  return ()=>{listeners.abort();resetAll();};
}
