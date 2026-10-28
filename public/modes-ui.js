import {modeState,modeLabel,modeDifficulty} from './match-modes.js';

const clock=ms=>`${Math.floor(ms/60000)}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}`;
const n=(value,lang)=>new Intl.NumberFormat(lang,{maximumFractionDigits:4}).format(value);
const modes=[['hardcore','Hardcore'],['training','Training']];

export function modeBadges(match,lang='ru'){
  return `<span class="match-modes" aria-label="${lang==='ru'?'Режимы матча':'Match modes'}">${modes.map(([key,name])=>`<span class="mode-tag mode-${modeState(match.modes?.[key])}" data-mode="${key}">${name}: <strong>${modeLabel(match.modes?.[key],lang)}</strong></span>`).join('')}</span>`;
}

export function modesDetail(match,lang,aboutLink){
  const ru=lang==='ru',k=modeDifficulty(match),unknown=modes.some(([key])=>typeof match.modes?.[key]?.initial!=='boolean');
  const history=modes.map(([key,name])=>{
    const m=match.modes?.[key],rows=m?.timeline||[];
    if(!rows.length||rows.every(x=>x.value===null))return '';
    return `<div class="mode-history"><b>${name}</b><ol>${rows.map(x=>`<li><time>${clock(x.fromMs)}</time> <span>${modeLabel({initial:x.value},lang)}</span></li>`).join('')}</ol></div>`;
  }).join('');
  const changed=modes.some(([key])=>match.modes?.[key]?.changed===true);
  const factors=k.factor===1?(ru?'Общий коэффициент режимов — ×1. Очки и штрафы без поправки за режимы.':'Combined mode factor: ×1. No mode adjustment to awards or penalties.'):
    (ru?`Победа человека ×${n(k.factor,lang)}, штраф человека ×${n(1/k.factor,lang)}. Победа бота ×${n(1/k.factor,lang)}, штраф бота ×${n(k.factor,lang)}.`:`Human win ×${n(k.factor,lang)}, human penalty ×${n(1/k.factor,lang)}. Bot win ×${n(1/k.factor,lang)}, bot penalty ×${n(k.factor,lang)}.`);
  return `<section class="panel modes-panel"><div class="modes-heading"><h2>${ru?'Режимы матча':'Match modes'}</h2>${modeBadges(match,lang)}</div><p>${factors}</p>${unknown?`<p class="sub">${ru?'Неизвестный режим не меняет очки. Это не означает, что он был выключен.':'An unknown mode does not affect points. This does not mean it was disabled.'}</p>`:''}${changed?`<p class="sub">${ru?'Для режима, который менялся относительно начала матча, используется 1,1 вместо 1,2, даже если затем вернули исходное значение.':'A mode changed from its initial state uses 1.1 instead of 1.2, even if it later returned to its initial value.'}</p>`:''}${history?`<details class="mode-history-fold"><summary>${ru?'Настройки по ходу матча':'Settings during the match'}</summary><p class="sub">${ru?'Время от начала игры, без пауз. Показано, когда значение зафиксировано в записи; изменение через RCON могло произойти раньше следующего снимка.':'Active time from the start, excluding pauses. Times show when a value was recorded; an RCON change may have happened before the next snapshot.'}</p><div class="mode-histories">${history}</div></details>`:''}<a class="button-link" ${aboutLink}>${ru?'Как режимы влияют на рейтинг →':'How modes affect ratings →'}</a></section>`;
}

export function modesGuide(lang){
  const ru=lang==='ru';
  return `<section id="modes" class="guide-section"><h2>${ru?'Hardcore и Training':'Hardcore and Training'}</h2>
  <p>${ru?'Режимы уточняют сложность матча. Сначала рассчитываются обычные очки с учётом скилла и длительности, затем применяется поправка режима. Количество побед и поражений, сам счёт и условия достижений не меняются.':'Modes adjust match difficulty. Normal points are calculated from skill and duration first, then adjusted for modes. Win/loss counts, the score and achievement conditions do not change.'}</p>
  <div class="formula-grid"><div class="formula"><h3>Hardcore</h3><p>${ru?'Включён весь матч: награда человека ×1,2, его штраф ÷1,2. Награда бота ÷1,2, его штраф ×1,2.':'Enabled throughout: human award ×1.2, human penalty ÷1.2. Bot award ÷1.2, bot penalty ×1.2.'}</p></div>
  <div class="formula"><h3>Training</h3><p>${ru?'Включён весь матч: награда человека ÷1,2, его штраф ×1,2. Награда бота ×1,2, его штраф ÷1,2.':'Enabled throughout: human award ÷1.2, human penalty ×1.2. Bot award ×1.2, bot penalty ÷1.2.'}</p></div></div>
  <p>${ru?'Если значение режима менялось после начала игры, для него используется 1,1 вместо 1,2. Число переключений не учитывается; возврат к исходному значению тоже не отменяет поправку. Это действует и при переходе из выключенного во включённый режим, и наоборот.':'If a mode changes after the start, it uses 1.1 instead of 1.2. The number of switches does not matter; returning to the initial state does not cancel the adjustment. This applies to both off-to-on and on-to-off changes.'}</p>
  <p>${ru?'Поправки объединяются: если оба режима включены весь матч, ×1,2 и ÷1,2 сокращаются — очки и штрафы остаются прежними. Если менялись оба, ×1,1 и ÷1,1 также сокращаются. Постоянный Hardcore вместе с изменявшимся Training даёт коэффициент 1,2 ÷ 1,1 для награды человека и обратный для награды бота.':'Adjustments combine: if both modes stay enabled throughout, ×1.2 and ÷1.2 cancel, leaving awards and penalties unchanged. If both modes changed, ×1.1 and ÷1.1 also cancel. Constant Hardcore and changed Training give a human award factor of 1.2 ÷ 1.1, and its reciprocal for the bot award.'}</p>
  <p>${ru?'Победный рейтинг использует скорректированные очки побед. В усреднённом рейтинге человека режимы меняют оценку сложности соперника для каждого матча; итоговый индекс остаётся в диапазоне 0–100. Рейтинг ботов учитывает поправки к наградам и штрафам. Forfeit по-прежнему не приносит очков человеку; к технической награде бота применяется поправка режима. Ноль очков остаётся нулём.':'Victory rating uses adjusted win points. For human Average rating, modes adjust opponent difficulty per match; the final index remains between 0 and 100. Bot rating applies adjusted awards and penalties. Forfeits still award no human points; the bot’s technical-win award receives the mode adjustment. Zero points remain zero.'}</p>
  <p>${ru?'Источником служат структурированные настройки в MVD2. Для Training берётся эффективное значение у играющего бота, а не серверный переключатель. Неизвестные режимы и режимы без подтверждённого значения на старте не меняют очки. Старые демки без этих данных сохраняют прежний расчёт. Версия мода показывается только по данным записи.':'The source is structured MVD2 settings. Training uses the participating bot’s effective value, not the server switch. Unknown modes and modes without a confirmed initial value do not affect points. Old demos without this information retain their previous scoring. Mod version is shown only when recorded.'}</p></section>`;
}
