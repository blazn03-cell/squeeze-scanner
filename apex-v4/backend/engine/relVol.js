// RelVol30 — current bar volume vs 30-bar average (daily).
export function calcRelVol(ind) {
  if (!ind || ind.avgVol30 <= 0) return null;
  const rv = ind.volume / ind.avgVol30;
  let band, score;
  if      (rv < 0.5) { band = 'VERY_LOW';  score = 10; }
  else if (rv < 1.0) { band = 'LOW';       score = 30; }
  else if (rv < 1.5) { band = 'NORMAL';    score = 55; }
  else if (rv < 2.0) { band = 'HIGH';      score = 75; }
  else if (rv < 3.0) { band = 'SURGE';     score = 90; }
  else               { band = 'EXTREME';   score = 75; }
  return { rv: +rv.toFixed(2), band, score, volume: ind.volume, avg30: Math.round(ind.avgVol30) };
}

export function calcRelVolIntraday(todayBars, historicalSessions, currentBarIndex) {
  if (!Array.isArray(todayBars) || historicalSessions.length < 5) return null;
  const accumToday = todayBars.slice(0, currentBarIndex + 1).reduce((s, b) => s + b.volume, 0);
  const histAccums = historicalSessions
    .map(sess => sess.slice(0, currentBarIndex + 1).reduce((s, b) => s + b.volume, 0))
    .filter(v => v > 0);
  if (!histAccums.length) return null;
  const avg = histAccums.reduce((a, b) => a + b, 0) / histAccums.length;
  const rv  = avg > 0 ? accumToday / avg : 0;
  return { rv: +rv.toFixed(2), accumToday, avg: Math.round(avg), bars: currentBarIndex + 1 };
}
