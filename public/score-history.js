// Older imports can miss the winning frag: the HUD has already switched to
// intermission when the server prints its final statistics. Keep observations
// at their original times and add only the confirmed result at the end.
export function completeScoreHistory(match) {
  const history = match.scoreHistory || [];
  if (!['server_stats', 'server_result'].includes(match.scoreSource)) return history;
  const scores = match.participants?.map(p => p.score);
  const end = match.timelineDurationMs ?? (match.endMs - match.startMs);
  if (scores?.length !== 2 || !scores.every(Number.isInteger) || !Number.isFinite(end) || end < 0) return history;
  const last = history.at(-1);
  if (last && scores.every((score, i) => score === last.scores[i])) return history;
  return [...history, {timeMs: Math.max(end, last?.timeMs ?? 0), scores}];
}

// Frags are integers; rounding fractional ticks duplicates labels at low scores.
export function scoreAxis(history) {
  const scores = history.flatMap(point => point.scores);
  const low = Math.min(0, ...scores), high = Math.max(1, ...scores);
  const desired = Math.max(1, (high - low) / 4);
  const power = 10 ** Math.floor(Math.log10(desired));
  const step = [1, 2, 5, 10].find(n => n * power >= desired) * power;
  const min = Math.floor(low / step) * step, max = Math.ceil(high / step) * step;
  const ticks = [];
  for (let value = min; value <= max; value += step) ticks.push(value === 0 ? 0 : value);
  return {min, max, ticks};
}
