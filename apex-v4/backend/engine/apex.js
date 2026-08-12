// V4_APEX_SCORE, V4_DIRECTION, V4_CONFIDENCE, V4_REGIME
export function calcApexScore(metrics) {
  const { atrPct, stableScore, relVol, squeezeHit, smartFlow, darvas, earlyEntry, earnings, quote } = metrics;
  if (!stableScore) return null;

  let s = 0;
  const ok = v => v != null && !isNaN(v);
  if (ok(atrPct?.score))       s += (atrPct.score / 100)                * 5;
  if (ok(stableScore?.score))  s += (stableScore.score / 100)           * 25;
  if (ok(relVol?.score))       s += (relVol.score / 100)                * 15;
  if (ok(squeezeHit?.score))   s += (squeezeHit.score / 100)            * 20;
  if (ok(smartFlow?.flow))     s += ((smartFlow.flow + 100) / 200)      * 15;
  if (ok(darvas?.stateScore))  s += (darvas.stateScore / 100)           * 10;
  if (ok(earlyEntry?.score))   s += (earlyEntry.score / 100)            * 10;

  const earnRisk = earnings?.risk ?? 0;
  if (earnRisk >= 3) s *= 0.60;
  else if (earnRisk >= 2) s *= 0.80;

  const spread = quote?.spreadPct;
  if (Number.isFinite(spread) && spread > 1.0) s *= 0.80;
  else if (Number.isFinite(spread) && spread > 0.5) s *= 0.90;

  if (stableScore?.adxPts === 0) s *= 0.85;

  return Math.max(0, Math.min(100, Math.round(s)));
}

export function calcDirection(ind, smartFlow, darvas, squeezeHit) {
  if (!ind) return 0;
  let bull = 0, bear = 0;
  if (ind.ema9 !== null && ind.ema20 !== null && ind.ema50 !== null) {
    if (ind.ema9 > ind.ema20 && ind.ema20 > ind.ema50) bull++;
    else if (ind.ema9 < ind.ema20 && ind.ema20 < ind.ema50) bear++;
  }
  if (ind.vwap > 0) {
    if (ind.price > ind.vwap * 1.002) bull++;
    else if (ind.price < ind.vwap * 0.998) bear++;
  }
  if (ind.adx14 !== null && ind.adx14 > 20 && ind.diPlus !== null && ind.diMinus !== null) {
    if (ind.diPlus > ind.diMinus) bull++;
    else if (ind.diMinus > ind.diPlus) bear++;
  }
  if (smartFlow?.flow !== undefined) {
    if (smartFlow.flow > 30) bull++;
    else if (smartFlow.flow < -30) bear++;
  }
  if (darvas?.bias) {
    if (darvas.bias === 'UP') bull++;
    else if (darvas.bias === 'DOWN') bear++;
  }
  if (squeezeHit?.dir) {
    if (squeezeHit.dir === 1) bull++;
    else if (squeezeHit.dir === -1) bear++;
  }
  const net = bull - bear;
  if (net >= 4) return 2;
  if (net >= 2) return 1;
  if (net <= -4) return -2;
  if (net <= -2) return -1;
  return 0;
}

export function calcConfidence(ind, relVol, smartFlow, darvas, squeezeHit, direction) {
  if (direction === 0) return 50;
  if (!ind) return 50;
  const d = Math.sign(direction);
  const votes = [];
  const emaDir = ind.ema9 > ind.ema20 && ind.ema20 > ind.ema50 ? 1
               : ind.ema9 < ind.ema20 && ind.ema20 < ind.ema50 ? -1 : 0;
  if (emaDir !== 0) votes.push(emaDir);
  if (ind.vwap > 0) votes.push(ind.price > ind.vwap ? 1 : -1);
  if (ind.adx14 !== null && ind.adx14 > 20) votes.push(ind.diPlus > ind.diMinus ? 1 : -1);
  if (smartFlow?.flow !== undefined) votes.push(smartFlow.flow > 0 ? 1 : -1);
  if (darvas?.bias && darvas.bias !== 'FLAT') votes.push(darvas.bias === 'UP' ? 1 : -1);
  if (relVol?.rv >= 1.2) votes.push(d);
  if (!votes.length) return 50;
  const agreeing = votes.filter(v => v === d).length;
  return Math.round((agreeing / votes.length) * 100);
}

export function calcRegime(ind, atrPct, squeezeHit, darvas) {
  if (!ind) return { regime: 'UNKNOWN', label: 'Unknown', score: 0 };
  const adxVal = ind.adx14 ?? 0;
  const atrP   = atrPct?.pct ?? 0;
  if (squeezeHit?.state === 'FIRING')                                    return { regime: 'BREAKOUT',  label: 'Squeeze Fire',       score: 90 };
  if (squeezeHit?.state === 'ACTIVE' && squeezeHit.squeezeBars >= 5)    return { regime: 'SQUEEZE',   label: 'Squeeze Building',   score: 80 };
  if (darvas?.state === 'BREAKOUT')                                       return { regime: 'BREAKOUT',  label: 'Darvas Breakout',    score: 85 };
  if (adxVal > 30 && atrP >= 1)                                          return { regime: 'TREND',     label: 'Strong Trend',       score: 80 };
  if (adxVal > 20 && atrP >= 1)                                          return { regime: 'TREND',     label: 'Trend',              score: 65 };
  if (atrP > 4)                                                           return { regime: 'HIGH_VOL',  label: 'High Volatility',    score: 50 };
  if (atrP < 0.8)                                                         return { regime: 'LOW_VOL',   label: 'Low Vol / Squeeze',  score: 40 };
  if (adxVal < 15)                                                        return { regime: 'CHOP',      label: 'Choppy / No Trend',  score: 20 };
  if (ind.rsi14 !== null && ind.rsi14 > 75)                              return { regime: 'REVERSAL',  label: 'Overbought',         score: 45 };
  if (ind.rsi14 !== null && ind.rsi14 < 25)                              return { regime: 'REVERSAL',  label: 'Oversold',           score: 45 };
  return                                                                         { regime: 'NEUTRAL',   label: 'Neutral',            score: 35 };
}
