// ATR% = (ATR_14 / Price) * 100
export function calcAtrPct(ind) {
  if (!ind || ind.atr14 === null || ind.price <= 0) return null;
  const pct = (ind.atr14 / ind.price) * 100;
  let band, score;
  if      (pct < 0.5) { band = 'DEAD';     score = 10; }
  else if (pct < 1.0) { band = 'LOW';      score = 35; }
  else if (pct < 1.5) { band = 'NORMAL';   score = 60; }
  else if (pct < 3.0) { band = 'ACTIVE';   score = 90; }
  else if (pct < 6.0) { band = 'ELEVATED'; score = 65; }
  else                { band = 'EXTREME';  score = 20; }
  return { pct: +pct.toFixed(2), band, score };
}
