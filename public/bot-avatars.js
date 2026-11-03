const names=['alexj','blaizz','damiah','david','god','human','mixedbot','myrmidon','noob','optimus','pacifist','polosatiy','purri','strange','syanid'];
const known=new Set(names);
export function botAvatarKey(name){
  const key=String(name??'').replace(/(?:\[\d+\]|>\d+)$/,'').replace(/-x$/i,'').toLowerCase();
  return known.has(key)?key:'mixedbot';
}
export function botAvatar(name,{size='inline',eager=false}={}){
  const key=botAvatarKey(name),large=size==='profile',pixels=large?144:size==='roster'?64:32;
  const asset=n=>new URL(`./avatars/bots/${key}-${n}.webp`,import.meta.url).href;
  return `<img class="bot-avatar bot-avatar--${large?'profile':size==='roster'?'roster':'inline'}" src="${asset(large?384:128)}" width="${pixels}" height="${pixels}" alt="" loading="${eager?'eager':'lazy'}" decoding="async">`;
}
