// DarvasScan + DarvasBias — non-repainting box detection.
export function calcDarvas(ind) {
  if (!ind) return null;
  const { _highs, _lows, _closes, _volumes, _ema20, avgVol20, bars, price } = ind;
  const n    = bars.length;
  const last = n - 1;
  if (n < 25) return null;

  let boxTop = null, boxBot = null, state = 'NO_BOX';

  for (let i = last - 1; i >= Math.max(0, last - 60); i--) {
    if (i + 3 > last) continue;
    let isNewHigh = true;
    for (let j = Math.max(0, i - 20); j < i; j++) {
      if (_highs[j] >= _highs[i]) { isNewHigh = false; break; }
    }
    if (!isNewHigh) continue;
    boxTop = _highs[i];
    boxBot = Math.min(_lows[i + 1] ?? _lows[i], _lows[i + 2] ?? _lows[i], _lows[i + 3] ?? _lows[i]);
    let brokeOut = false;
    for (let k = i + 4; k <= last; k++) {
      if (_closes[k] > boxTop && _volumes[k] > avgVol20 * 1.2) { brokeOut = true; break; }
    }
    if (brokeOut) {
      state = 'BREAKOUT';
    } else {
      const distPct = boxTop > 0 ? (boxTop - price) / boxTop : 1;
      state = distPct <= 0.02 ? 'APPROACHING' : 'IN_BOX';
    }
    break;
  }

  const ema20now = _ema20[last];
  const ema20ago = _ema20[Math.max(0, last - 5)];
  const slope    = (ema20now && ema20ago) ? (ema20now - ema20ago) / ema20ago * 100 : 0;
  const bias     = slope > 0.3 ? 'UP' : slope < -0.3 ? 'DOWN' : 'FLAT';

  const SCORES = { BREAKOUT: 90, APPROACHING: 65, IN_BOX: 50, NO_BOX: 20 };
  return {
    boxTop:     boxTop ? +boxTop.toFixed(2) : null,
    boxBot:     boxBot ? +boxBot.toFixed(2) : null,
    state, bias,
    stateScore: SCORES[state],
    slopeEma20: +slope.toFixed(3),
  };
}
