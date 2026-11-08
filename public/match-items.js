const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const groups=[
  ['armor','Броня','Armor',['Body Armor','Combat Armor','Jacket Armor','Armor Shard','Power Shield','Power Screen']],
  ['health','Здоровье','Health',['Mega Health','Adrenaline','Health 25','Health 10','Stimpack']],
  ['weapons','Оружие','Weapons',['Blaster','Shotgun','Super Shotgun','Machinegun','Chaingun','Grenade Launcher','Rocket Launcher','HyperBlaster','Railgun','BFG10K']],
  ['ammo','Боеприпасы','Ammunition',['Shells','Bullets','Grenades','Rockets','Cells','Slugs']],
  ['equipment','Снаряжение и усиления','Equipment and power-ups',['Ammo Pack','Bandolier','Quad Damage','Invulnerability','Silencer','Rebreather','Environment Suit']],
  ['other','Другие предметы','Other items',[]]
];
const names=new Map(groups.flatMap(g=>g[3]).map(n=>[n.toLowerCase(),n]));
for(const [alias,name]of Object.entries({'MegaHealth':'Mega Health','S.Shotgun':'Super Shotgun','M.Gun':'Machinegun','C.Gun':'Chaingun','G.Launch':'Grenade Launcher','R.Launch':'Rocket Launcher','H.Blaster':'HyperBlaster','H.Grenade':'Grenades','BFG':'BFG10K'}))names.set(alias.toLowerCase(),name);
export const canonicalItemName=n=>names.get(String(n).trim().toLowerCase())||String(n).trim();
const valid=n=>Number.isInteger(n)&&n>=0;
function lookup(rows,name,key){
  const entries=(rows||[]).filter(x=>canonicalItemName(x.name)===name&&valid(x[key]));
  // Aliases describe the same counter, not additional pickups to add together.
  return (entries.find(x=>x.name===name)||entries[0])?.[key]??null;
}
export function pickupGroups(match){
  const participants=match.participants||[];
  const items=[...new Set(participants.flatMap(p=>[...(p.stats?.pickups||[]),...(p.stats?.control||[])].map(x=>canonicalItemName(x.name))))];
  const rows=items.map(name=>({name,counts:participants.map(p=>{
    const stats=p.stats;if(!stats)return null;
    const count=lookup(stats.pickups,name,'count');if(count!==null)return count;
    const full=Array.isArray(stats.pickups)&&stats.format!=='legacy'&&match.statsFormat!=='legacy';
    return full?0:lookup(stats.control,name,'pickups');
  }),mapCounts:participants.map(p=>lookup(p.stats?.control,name,'pickups'))}));
  const known=new Set(groups.flatMap(g=>g[3]));
  return groups.map(([id,ru,en,order])=>({id,ru,en,items:rows.filter(x=>id==='other'?!known.has(x.name):order.includes(x.name))
    .sort((a,b)=>id==='other'?a.name.localeCompare(b.name):order.indexOf(a.name)-order.indexOf(b.name))})).filter(g=>g.items.length);
}
export const participantColor=p=>p?.isBot?'var(--duel-bot)':'var(--duel-human)';
export const participantClass=p=>p?.isBot?'duel-bot':'duel-human';
export function comparisonBar(label,a,b,participants,{format=n=>n??'—',itemName=null}={}){
  const total=valid(a)&&valid(b)?a+b:0,ratio=total?a/total*100:0;
  return `<div class="compare"${itemName?` data-item="${esc(itemName)}"`:''}><div class="compare-label"><b class="${participantClass(participants[0])}">${esc(format(a))}</b><span>${esc(label)}</span><b class="${participantClass(participants[1])}">${esc(format(b))}</b></div><svg class="bars" viewBox="0 0 100 5" preserveAspectRatio="none" aria-hidden="true"><rect width="${total?Math.max(0,ratio-(b>0?.3:0)):0}" height="5" fill="${participantColor(participants[0])}"/><rect x="${ratio+(a>0?.3:0)}" width="${total?Math.max(0,100-ratio-(a>0?.3:0)):0}" height="5" fill="${participantColor(participants[1])}"/></svg></div>`;
}
export function participantLegend(participants,lang){
  return `<div class="legend duel-legend">${participants.map(p=>`<span class="${participantClass(p)}">${esc(p.name)} <small>· ${p.isBot?(lang==='ru'?'бот':'bot'):(lang==='ru'?'игрок':'player')}</small></span>`).join('')}</div>`;
}
export function itemPickups(match,{lang='ru',expanded=false,label=n=>n,format=n=>n??'—'}={}){
  const ru=lang==='ru',data=pickupGroups(match),main=data.filter(g=>['armor','health'].includes(g.id)),more=data.filter(g=>!main.includes(g));
  const render=items=>`<div class="pickup-groups">${items.map(g=>`<section class="pickup-group" data-item-group="${g.id}"><h3>${esc(ru?g.ru:g.en)}</h3>${g.items.map(row=>{
    const bar=comparisonBar(label(row.name),...row.counts,match.participants,{format,itemName:row.name});
    const difference=row.mapCounts.some((v,i)=>v!==null&&v!==row.counts[i]);
    const caption=difference?`<div class="pickup-map-counts"><span>${ru?'Из них с карты':'From map spawns'}:</span> ${row.mapCounts.map((v,i)=>`<b class="${participantClass(match.participants[i])}">${esc(format(v))}</b>`).join(' / ')}</div>`:'';
    return `<div class="pickup-row">${bar}${caption}</div>`;
  }).join('')}</section>`).join('')}</div>`;
  const note=match.statsFormat==='legacy'?
    (ru?'Показаны доступные счётчики из итоговой таблицы сервера. В старых записях полный список подборов может отсутствовать.':'Available counters from the server’s final table. Older recordings may not contain a full pickup list.'):
    (ru?'Все подборы, включая выпавшие предметы. Если счётчик подборов с карты отличается, он указан отдельно под строкой.':'All pickups, including dropped items. Map-spawn counts are shown below a row when they differ.');
  return `<section class="panel pickups-panel"><h2>${ru?'Подборы предметов':'Item pickups'}</h2>${participantLegend(match.participants,lang)}${data.length?
    (main.length?render(main)+(more.length?`<details class="pickup-details"${expanded?' open':''}><summary>${ru?'Оружие, боеприпасы и другие предметы':'Weapons, ammunition and other items'}</summary>${render(more)}</details>`:''):render(more)):
    `<p class="sub">${ru?'Данные о подборах отсутствуют.':'Pickup data is unavailable.'}</p>`}<p class="sub">${note}</p></section>`;
}
