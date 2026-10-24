import {renderTable} from './tables.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=(s,lang,options={day:'numeric',month:'short',year:'numeric'})=>s?new Intl.DateTimeFormat(lang==='ru'?'ru-RU':'en-GB',{...options,timeZone:'UTC'}).format(new Date(s+'T12:00:00Z')):'—';
const range=(p,lang)=>p.from===p.to?date(p.from,lang):date(p.from,lang)+' — '+date(p.to,lang);
const num=(n,lang)=>new Intl.NumberFormat(lang,{maximumFractionDigits:1}).format(n);
const units={ru:{day:'По дням',week:'По неделям',month:'По месяцам',year:'По годам'},en:{day:'Daily',week:'Weekly',month:'Monthly',year:'Yearly'}};
function matchURL(p,url){return url({view:'matches',from:p.from,to:p.to,period:'custom',status:null,skill:null,overtime:null,match:null,profile:null,kind:null,page:null,trendPoint:null});}
function notes(data,ru){return `<p class="trend-note">${ru?'Одна победа — один матч, без коэффициентов скилла. Forfeit всегда учитывается как поражение человека и победа бота, независимо от счёта перед выходом. Даты — по началу матча, МСК. Ничьи и записи без подтверждённого результата не входят в кривые побед.':'One win means one match, without skill weighting. A forfeit always counts as a human loss and a bot win, regardless of the score at departure. Dates follow match start in Moscow time. Draws and recordings without a confirmed result are excluded from the win curves.'}${data.excluded.undated?` ${ru?'Матчей с результатом, но без даты:':'Results without a known date:'} ${data.excluded.undated}.`:''}</p>`;}

export function dynamicsPage(data,{lang,url,params}){
  const ru=lang==='ru',s=data.totals;
  const header=`<div class="trend-heading"><h1>${ru?'Динамика':'Trends'}</h1><p>${ru?'Как меняется соотношение побед людей и ботов за выбранный период. Все скиллы, включая матчи с forfeit.':'How human and bot wins change over the selected period. All skills, including forfeits.'}</p></div>`;
  if(data.invalidRange)return header+`<p class="empty">${ru?'Дата начала должна быть не позже даты окончания.':'The start date must not be after the end date.'}</p>`;
  const summary=`<div class="trend-summary"><div class="trend-stat"><span>${ru?'Победы ботов':'Bot wins'}</span><strong class="trend-bot">${num(s.botWins,lang)}</strong><small>${ru?'Из них по forfeit':'Including forfeits'}: ${num(s.botForfeitWins,lang)}</small></div><div class="trend-stat"><span>${ru?'Победы людей':'Human wins'}</span><strong class="trend-human">${num(s.humanWins,lang)}</strong><small>${ru?'Включая победы в овертайме':'Including overtime wins'}</small></div><div class="trend-stat"><span>${ru?'Доля побед ботов':'Bot win share'}</span><strong>${s.botWinPercent===null?'—':num(s.botWinPercent,lang)+'%'}</strong><small>${ru?'Матчей с победителем':'Matches with a winner'}: ${num(s.matches,lang)}</small></div></div>`;
  if(!s.matches)return header+summary+`<div class="empty">${ru?'За выбранный период нет матчей с подтверждённой победой.':'No confirmed wins in the selected period.'}</div>`+notes(data,ru);
  const columns=[{key:'date',label:ru?'Период · МСК':'Period · MSK',text:true,value:p=>p.key,render:p=>`<a href="${esc(matchURL(p,url))}">${esc(range(p,lang))} ↗</a>`},
    {key:'bot',label:ru?'Победы ботов':'Bot wins',value:p=>p.botWins,render:p=>`<b class="trend-bot">${p.botWins}</b>`},
    {key:'human',label:ru?'Победы людей':'Human wins',value:p=>p.humanWins,render:p=>`<b class="trend-human">${p.humanWins}</b>`},
    {key:'forfeits',label:ru?'Из них forfeit':'Of which forfeits',value:p=>p.forfeits},
    {key:'share',label:ru?'Доля побед ботов':'Bot win share',value:p=>p.botWinPercent,render:p=>p.botWinPercent===null?'—':num(p.botWinPercent,lang)+'%'}];
  return header+summary+`<section class="trend-panel"><div class="trend-chart-heading"><div><h2>${ru?'Победы за период':'Wins over time'}</h2><p>${esc(range(data,lang))} · ${units[lang][data.unit]}</p></div><div class="trend-legend"><span><i class="trend-swatch bot"></i>${ru?'Боты':'Bots'}</span><span><i class="trend-swatch human"></i>${ru?'Люди':'Humans'}</span></div></div><p class="trend-axis-label">${ru?'Количество побед':'Number of wins'}</p><div class="trend-chart" id="trend-chart"></div><p class="trend-hint">${ru?'Наведи курсор или нажми на график. Клавиши ← → переключают периоды.':'Hover or tap the chart. Use ← → to move between periods.'}</p><div id="trend-detail" aria-live="polite"></div></section>${notes(data,ru)}<details class="trend-table" ${params.get('trendTable')==='1'||params.has('sort_dynamics')?'open':''}><summary>${ru?'Данные по периодам':'Data by period'}</summary>${renderTable('dynamics',columns,data.points,{params,lang,defaultKey:'date',defaultDir:'asc'})}</details>`;
}

function svg(data,lang,width){
  const height=340,left=48,right=20,top=18,bottom=48,w=width-left-right,h=height-top-bottom,points=data.points;
  const max=points.reduce((n,p)=>Math.max(n,p.botWins,p.humanWins),1),raw=max/4,pow=10**Math.floor(Math.log10(raw));
  const step=Math.max(1,[1,2,5,10].find(n=>n*pow>=raw)*pow),ceiling=Math.ceil(max/step)*step;
  const x=i=>points.length===1?left+w/2:left+w*i/(points.length-1),y=n=>top+h-h*n/ceiling;
  const lines=[];for(let value=0;value<=ceiling;value+=step)lines.push(`<line class="trend-grid" x1="${left}" x2="${width-right}" y1="${y(value)}" y2="${y(value)}"/><text class="trend-tick" x="${left-10}" y="${y(value)+5}" text-anchor="end">${num(value,lang)}</text>`);
  const labelCount=Math.max(2,Math.floor(w/110)),labelStep=Math.max(1,Math.ceil((points.length-1)/(labelCount-1))),labels=new Set([0,points.length-1]);
  for(let i=labelStep;i<points.length-1;i+=labelStep)if(x(points.length-1)-x(i)>=85)labels.add(i);
  for(const i of [...labels].sort((a,b)=>a-b)){
    const p=points[i],label=data.unit==='year'?p.key.slice(0,4):date(p.from,lang,data.unit==='month'?{month:'short',year:'2-digit'}:{day:'numeric',month:'short'});
    lines.push(`<text class="trend-tick" x="${x(i)}" y="${height-15}" text-anchor="${points.length===1?'middle':i===0?'start':i===points.length-1?'end':'middle'}">${esc(label)}</text>`);
  }
  const paths=['bot','human'].map(who=>`<polyline class="trend-line ${who}" points="${points.map((p,i)=>`${x(i)},${y(p[who+'Wins'])}`).join(' ')}"/>`).join('');
  const targets=points.map((p,i)=>{
    const gap=points.length===1?w:w/(points.length-1),a=i===0?left:x(i)-gap/2,b=i===points.length-1?width-right:x(i)+gap/2;
    const label=`${range(p,lang)}: ${lang==='ru'?'победы ботов':'bot wins'} ${p.botWins}, ${lang==='ru'?'победы людей':'human wins'} ${p.humanWins}`;
    return `<g class="trend-target" data-trend-index="${i}" tabindex="-1" role="button" aria-label="${esc(label)}"><line class="trend-focus-line" x1="${x(i)}" x2="${x(i)}" y1="${top}" y2="${top+h}"/><circle class="trend-dot human" cx="${x(i)}" cy="${y(p.humanWins)}" r="4"/><circle class="trend-dot bot" cx="${x(i)}" cy="${y(p.botWins)}" r="2.5"/><rect x="${a}" y="${top-5}" width="${Math.max(1,b-a)}" height="${h+10}" fill="transparent"/></g>`;
  }).join('');
  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="group" aria-label="${lang==='ru'?'Победы ботов и людей по времени':'Bot and human wins over time'}">${lines.join('')}${paths}${targets}</svg>`;
}

function pointDetails(p,lang,url,i,last){
  const ru=lang==='ru';
  return `<div class="trend-selection"><button type="button" data-trend-step="-1" ${i===0?'disabled':''} aria-label="${ru?'Предыдущий период':'Previous period'}">←</button><strong>${esc(range(p,lang))}</strong><button type="button" data-trend-step="1" ${i===last?'disabled':''} aria-label="${ru?'Следующий период':'Next period'}">→</button></div><div class="trend-values"><span><i class="trend-swatch bot"></i>${ru?'Победы ботов':'Bot wins'} <b>${p.botWins}</b></span><span><i class="trend-swatch human"></i>${ru?'Победы людей':'Human wins'} <b>${p.humanWins}</b></span><span>${ru?'Из них forfeit':'Of which forfeits'} <b>${p.forfeits}</b></span><a class="button-link" href="${esc(matchURL(p,url))}">${ru?'Матчи за этот период':'Matches in this period'} →</a></div>`;
}

export function mountDynamics(root,data,{lang,url,params,onSelect,onTable}){
  const chart=root.querySelector('#trend-chart'),detail=root.querySelector('#trend-detail'),table=root.querySelector('.trend-table');
  if(!chart)return ()=>{};
  let chosen=data.points.findIndex(p=>p.key===params.get('trendPoint'));
  if(chosen<0)chosen=data.points.findLastIndex(p=>p.matches>0);
  if(chosen<0)chosen=0;
  let shown=chosen,lastWidth=0;
  function show(index,commit=false){
    shown=Math.max(0,Math.min(data.points.length-1,index));
    if(commit){chosen=shown;onSelect(data.points[chosen].key);}
    chart.querySelectorAll('[data-trend-index]').forEach((el,i)=>{el.classList.toggle('selected',i===shown);el.setAttribute('tabindex',i===chosen?'0':'-1');});
    detail.innerHTML=pointDetails(data.points[shown],lang,url,shown,data.points.length-1);
  }
  function draw(){const width=Math.max(260,Math.floor(chart.clientWidth));if(width===lastWidth)return;lastWidth=width;chart.innerHTML=svg(data,lang,width);show(shown);}
  const observer=new ResizeObserver(draw);observer.observe(chart);draw();
  chart.onpointermove=e=>{if(e.pointerType==='touch')return;const el=e.target.closest('[data-trend-index]');if(el&&Number(el.dataset.trendIndex)!==shown)show(Number(el.dataset.trendIndex));};
  chart.onpointerleave=()=>show(chosen);
  chart.onclick=e=>{const el=e.target.closest('[data-trend-index]');if(el)show(Number(el.dataset.trendIndex),true);};
  chart.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End','Enter',' '].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?data.points.length-1:e.key==='ArrowLeft'?shown-1:e.key==='ArrowRight'?shown+1:shown;show(next,true);chart.querySelector(`[data-trend-index="${chosen}"]`)?.focus({preventScroll:true});};
  detail.onclick=e=>{const button=e.target.closest('[data-trend-step]');if(button){show(shown+Number(button.dataset.trendStep),true);detail.querySelector(`[data-trend-step="${button.dataset.trendStep}"]`)?.focus({preventScroll:true});}};
  if(table)table.ontoggle=()=>onTable(table.open);
  return ()=>{observer.disconnect();chart.onpointermove=chart.onpointerleave=chart.onclick=chart.onkeydown=null;detail.onclick=null;if(table)table.ontoggle=null;};
}
