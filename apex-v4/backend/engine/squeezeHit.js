// SqueezeHit% — BB(20,2.0) inside KC(20 EMA, 1.5×ATR10).
export function calcSqueezeHit(ind) {
  if (!ind) return null;
  const { _bb, _kc, _closes, bars } = ind;
  const n    = bars.length;
  const last = n - 1;
  if (n < 22 || !_bb[last] || !_kc[last] || _bb[last].upper === null) return null;

  const inSqueeze = (bb, kc) =>
    bb?.upper !== null && kc?.upper !== null &&
    bb.upper <= kc.upper && bb.lower >= kc.lower;

  const nowSq  = inSqueeze(_bb[last], _kc[last]);
  const prevSq = last >= 1 && inSqueeze(_bb[last - 1], _kc[last - 1]);

  let squeezeBars = 0;
  for (let i = last; i >= Math.max(0, last - 100); i--) {
    if (inSqueeze(_bb[i], _kc[i])) squeezeBars++;
    else break;
  }

  const bbw    = _bb[last].width || 0;
  let bbwMin   = Infinity;
  for (let i = Math.max(0, last - 10); i <= last; i++) {
    const w = _bb[i]?.width;
    if (w !== null && w !== undefined && w < bbwMin) bbwMin = w;
  }
  const expansionRatio = bbwMin > 0 && isFinite(bbwMin) ? bbw / bbwMin : 1;
  const firing = !nowSq && prevSq;

  let state, pct, score;
  if (firing) {
    state = 'FIRING'; pct = 85;
    score = Math.min(100, Math.round(70 + squeezeBars * 1.5 + expansionRatio * 4));
  } else if (nowSq) {
    state = 'ACTIVE'; pct = Math.min(95, 40 + squeezeBars * 2);
    score = Math.min(95, Math.round(40 + squeezeBars * 1.5));
  } else {
    state = 'POST'; pct = 30; score = 25;
  }

  const price   = _closes[last];
  const midline = _kc[last]?.mid ?? _bb[last]?.mid;
  const dir     = midline ? (price > midline ? 1 : price < midline ? -1 : 0) : 0;

  return { state, pct, score, squeezeBars, bbw: +bbw.toFixed(5), expansionRatio: +expansionRatio.toFixed(2), dir };
}
