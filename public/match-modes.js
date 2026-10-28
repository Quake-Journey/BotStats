// Shared by the API and browser. Unknown/mid-recording settings never imply off.
export function modeState(mode) {
  if (mode?.changed === true || mode?.variable === true) return 'variable';
  if (!mode || typeof mode.initial !== 'boolean') return 'unknown';
  return mode.initial ? 'on' : 'off';
}

export function modeDifficulty(match) {
  const hardcore = modeState(match.modes?.hardcore), training = modeState(match.modes?.training);
  const factor=mode=>typeof mode?.initial!=='boolean'?1:mode.changed===true?1.1:mode.initial?1.2:1;
  const hc = factor(match.modes?.hardcore), tr = factor(match.modes?.training);
  return {hardcore, training, hardcoreFactor:hc, trainingDivisor:tr, factor:hc / tr};
}

export function modePointFactor(match, isBot, points) {
  if (!Number.isFinite(points) || points === 0) return 1;
  const k = modeDifficulty(match).factor;
  return (points > 0) !== Boolean(isBot) ? k : 1 / k;
}

export function modeLabel(mode, lang='ru') {
  const state = modeState(mode), ru = lang === 'ru';
  return state === 'variable' ? (ru ? 'Переменный' : 'Variable') : state === 'on' ? (ru ? 'Вкл.' : 'On') :
    state === 'off' ? (ru ? 'Выкл.' : 'Off') : (ru ? 'Неизвестно' : 'Unknown');
}
