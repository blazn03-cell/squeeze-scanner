// StableScore (0–100) — five INDEPENDENT components.
export function calcStableScore(ind, relVol, atrPct) {
  if (!ind) return null;
  const { adx14, ema9, ema20, ema50, price, vwap: vwapVal } = ind;
  let score = 0;

  let adxPts = 0;
  if (adx14 !== null) {
    if      (adx14 > 40) adxPts = 25;
    else if (adx14 > 30) adxPts = 20;
    else if (adx14 > 20) adxPts = 12;
    else if (adx14 > 15) adxPts = 5;
    else                 adxPts = 0;
  }
  score += adxPts;

  let emaPts = 0;
  if (ema9 !== null && ema20 !== null && ema50 !== null) {
    if      (ema9 > ema20 && ema20 > ema50) emaPts = 20;
    else if (ema9 < ema20 && ema20 < ema50) emaPts = 15;
    else                                     emaPts = 3;
  }
  score += emaPts;

  let volPts = 0;
  if (relVol?.rv !== undefined) {
    const rv = relVol.rv;
    if      (rv >= 2.0) volPts = 15;
    else if (rv >= 1.5) volPts = 10;
    else if (rv >= 1.0) volPts = 5;
    else                volPts = 0;
  }
  score += volPts;

  let vwapPts = 0;
  if (vwapVal > 0 && price > 0) {
    const dev = (price - vwapVal) / vwapVal * 100;
    if      (dev >  1.5) vwapPts = 20;
    else if (dev >  0.3) vwapPts = 14;
    else if (dev > -0.3) vwapPts = 8;
    else if (dev > -1.5) vwapPts = 4;
    else                 vwapPts = 0;
  } else {
    vwapPts = 8;
  }
  score += vwapPts;

  let atrPts = 0;
  if (atrPct?.pct !== undefined) {
    const p = atrPct.pct;
    if      (p >= 1.5 && p <= 4.0) atrPts = 20;
    else if (p >= 1.0 && p <= 6.0) atrPts = 12;
    else if (p < 0.5)              atrPts = 3;
    else                           atrPts = 6;
  }
  score += atrPts;

  if (adx14 !== null && adx14 < 15)  score = Math.round(score * 0.70);
  if (atrPct?.band === 'EXTREME')     score = Math.round(score * 0.80);

  const final = Math.max(0, Math.min(100, score));
  let band;
  if      (final >= 80) band = 'ELITE';
  else if (final >= 65) band = 'STRONG';
  else if (final >= 50) band = 'MODERATE';
  else if (final >= 35) band = 'WEAK';
  else                  band = 'POOR';

  return { score: final, band, adxPts, emaPts, volPts, vwapPts, atrPts };
}
