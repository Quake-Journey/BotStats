export function winBalance(summary,lang='ru'){
  const ru=lang==='ru',count=n=>Number.isFinite(n)&&n>=0?n:0;
  const humans=count(summary.humanWins),bots=count(summary.botWins),total=humans+bots;
  const share=total?humans/total*100:0,rounded=Math.round(share*10)/10;
  const percent=n=>new Intl.NumberFormat(ru?'ru-RU':'en-US',{maximumFractionDigits:1}).format(n)+'%';
  const humanPercent=total?percent(rounded):'—',botPercent=total?percent(100-rounded):'—';
  const humanLabel=ru?'Люди':'Humans',botLabel=ru?'Боты':'Bots';
  const note=total?(ru?'100% — сумма побед людей и ботов, включая технические. Для выбранных фильтров.':'100% is the sum of human and bot wins, including forfeits. For the selected filters.'):(ru?'Побед пока нет.':'No wins yet.');
  const accessible=`${humanLabel}: ${humanPercent}. ${botLabel}: ${botPercent}. ${note}`;
  return `<div class="win-balance" role="img" aria-label="${accessible}" title="${note}">
    <span class="win-balance-title" aria-hidden="true">${ru?'Соотношение побед':'Win ratio'}</span>
    <div class="win-balance-labels" aria-hidden="true"><span class="win-balance-human">${humanLabel} <b>${humanPercent}</b></span><span class="win-balance-bot">${botLabel} <b>${botPercent}</b></span></div>
    <svg class="win-balance-bar" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true" focusable="false">${total?`<rect class="win-balance-bot-fill" width="100" height="8"/><rect class="win-balance-human-fill" width="${share}" height="8"/>`:''}</svg>
  </div>`;
}
