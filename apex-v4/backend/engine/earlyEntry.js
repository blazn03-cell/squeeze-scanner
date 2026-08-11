// EARLY_ENTRY — detect setups BEFORE they're extended. Solves scanner lag.
export function calcEarlyEntry(ind, relVol, squeezeHit, darvas) {
  if (!ind) return null;
  const { _closes, _ema9, _ema20, vwap: vwapVal, price } = ind;
  const n    = ind.bars.length;
  const last = n - 1;
  let pts = 0;
  const signals = [];

  const rv = relVol?.rv ?? 0;
  if (rv >= 1.0 && rv <= 1.8) { pts += 25; signals.push('vol_starting'); }
  else if (rv > 1.8 && rv <= 2.5) { pts += 10; signals.push('vol_elevated'); }

  if (darvas?.boxTop && price > 0) {
    const dist = (darvas.boxTop - price) / darvas.boxTop;
    if (dist >= 0 && dist <= 0.02) { pts += 25; signals.push('near_resistance'); }
    else if (dist > 0.02 && dist <= 0.05) { pts += 8; signals.push('watching_resistance'); }
  }

  if (squeezeHit?.state === 'ACTIVE') {
    if (squeezeHit.squeezeBars >= 5 && squeezeHit.expansionRatio > 1.1) { pts += 25; signals.push('squeeze_building'); }
    else if (squeezeHit.squeezeBars >= 3) { pts += 10; signals.push('squeeze_forming'); }
  }

  if (last >= 3 && _ema9 && _ema20) {
    const cur9 = _ema9[last], cur20 = _ema20[last];
    const prv9 = _ema9[last - 3], prv20 = _ema20[last - 3];
    if (cur9 !== null && cur20 !== null && prv9 !== null && prv20 !== null) {
      if (prv9 < prv20 && cur9 > cur20) { pts += 25; signals.push('ema_cross'); }
      else if (cur9 > cur20) { pts += 8; signals.push('ema_aligned'); }
    }
  }

  if (vwapVal > 0 && last >= 1) {
    const prevC = _closes[last - 1];
    if (prevC < vwapVal && price > vwapVal) { pts += 20; signals.push('vwap_reclaim'); }
    else if (price > vwapVal && (price - vwapVal) / vwapVal < 0.005) { pts += 8; signals.push('at_vwap'); }
  }

  const score = Math.min(100, pts);
  let band;
  if      (score >= 70) band = 'VERY_EARLY';
  else if (score >= 50) band = 'EARLY';
  else if (score >= 30) band = 'DEVELOPING';
  else                  band = 'LATE_OR_NEUTRAL';

  return { score, band, signals };
}
