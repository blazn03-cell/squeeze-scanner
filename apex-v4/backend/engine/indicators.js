// Shared indicator primitives — computed ONCE per symbol, reused by all metric modules.
// No look-ahead: all computations use only bars[0..i] when computing index i.

export function ema(values, period) {
  if (values.length < period) return new Array(values.length).fill(null);
  const k = 2 / (period + 1);
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  out[period - 1] = sum / period;
  for (let i = period; i < values.length; i++) {
    out[i] = values[i] * k + out[i - 1] * (1 - k);
  }
  return out;
}

export function sma(values, period) {
  return values.map((_, i) => {
    if (i < period - 1) return null;
    let s = 0;
    for (let j = i - period + 1; j <= i; j++) s += values[j];
    return s / period;
  });
}

export function trueRange(bars) {
  return bars.map((b, i) => {
    const prev = i === 0 ? b.close : bars[i - 1].close;
    return Math.max(b.high - b.low, Math.abs(b.high - prev), Math.abs(b.low - prev));
  });
}

export function atr(bars, period = 14) {
  const tr  = trueRange(bars);
  const out = new Array(bars.length).fill(null);
  if (bars.length < period) return out;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += tr[i];
  out[period - 1] = sum / period;
  const k = 1 / period;
  for (let i = period; i < bars.length; i++) {
    out[i] = tr[i] * k + out[i - 1] * (1 - k);
  }
  return out;
}

export function rsi(values, period = 14) {
  const out = new Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  let avgGain = gains / period, avgLoss = losses / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    const g = d > 0 ? d : 0, l = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export function adx(bars, period = 14) {
  const n   = bars.length;
  const out = { adx: new Array(n).fill(null), diPlus: new Array(n).fill(null), diMinus: new Array(n).fill(null) };
  if (n < period * 2 + 1) return out;

  const tr     = trueRange(bars);
  const dmPlus = bars.map((b, i) => {
    if (i === 0) return 0;
    const up = b.high - bars[i - 1].high, dn = bars[i - 1].low - b.low;
    return up > dn && up > 0 ? up : 0;
  });
  const dmMinus = bars.map((b, i) => {
    if (i === 0) return 0;
    const up = b.high - bars[i - 1].high, dn = bars[i - 1].low - b.low;
    return dn > up && dn > 0 ? dn : 0;
  });

  let trS = 0, dpS = 0, dmS = 0;
  for (let i = 0; i < period; i++) { trS += tr[i]; dpS += dmPlus[i]; dmS += dmMinus[i]; }

  const dx = new Array(n).fill(null);
  for (let i = period; i < n; i++) {
    trS = trS - trS / period + tr[i];
    dpS = dpS - dpS / period + dmPlus[i];
    dmS = dmS - dmS / period + dmMinus[i];
    out.diPlus[i]  = trS > 0 ? (dpS / trS) * 100 : 0;
    out.diMinus[i] = trS > 0 ? (dmS / trS) * 100 : 0;
    const total = out.diPlus[i] + out.diMinus[i];
    dx[i] = total > 0 ? Math.abs(out.diPlus[i] - out.diMinus[i]) / total * 100 : 0;
  }

  let adxInit = 0, cnt = 0;
  for (let i = period; i < period * 2 && i < n; i++) {
    if (dx[i] !== null) { adxInit += dx[i]; cnt++; }
  }
  if (cnt > 0) { out.adx[period * 2 - 1] = adxInit / cnt; }
  for (let i = period * 2; i < n; i++) {
    if (out.adx[i - 1] !== null && dx[i] !== null) {
      out.adx[i] = (out.adx[i - 1] * (period - 1) + dx[i]) / period;
    }
  }
  return out;
}

export function bollingerBands(closes, period = 20, mult = 2) {
  const mid = sma(closes, period);
  return closes.map((_, i) => {
    if (mid[i] === null) return { upper: null, mid: null, lower: null, width: null };
    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) variance += (closes[j] - mid[i]) ** 2;
    const std = Math.sqrt(variance / period);
    return { upper: mid[i] + mult * std, mid: mid[i], lower: mid[i] - mult * std, width: mid[i] > 0 ? (4 * std) / mid[i] : null };
  });
}

export function keltnerChannels(bars, emaPeriod = 20, atrMult = 1.5, atrPeriod = 10) {
  const closes = bars.map(b => b.close);
  const midArr = ema(closes, emaPeriod);
  const atrArr = atr(bars, atrPeriod);
  return bars.map((_, i) => {
    if (midArr[i] === null || atrArr[i] === null) return { upper: null, mid: null, lower: null };
    return { upper: midArr[i] + atrMult * atrArr[i], mid: midArr[i], lower: midArr[i] - atrMult * atrArr[i] };
  });
}

export function vwap(bars) {
  let cumVP = 0, cumVol = 0;
  return bars.map(b => {
    const tp = (b.high + b.low + b.close) / 3;
    cumVP  += tp * b.volume;
    cumVol += b.volume;
    return cumVol > 0 ? cumVP / cumVol : b.close;
  });
}

export function parseBars(data, symbol) {
  const payload = symbol && data[symbol] ? data[symbol] : data;
  const values  = payload?.values;
  if (!Array.isArray(values)) return [];
  return values
    .map(v => ({
      time:   v.datetime,
      open:   parseFloat(v.open),
      high:   parseFloat(v.high),
      low:    parseFloat(v.low),
      close:  parseFloat(v.close),
      volume: parseInt(v.volume) || 0,
    }))
    .filter(b => !isNaN(b.close) && b.high > 0 && b.low > 0);
}

export function buildIndicators(bars) {
  if (!bars || bars.length < 25) return null;
  const closes  = bars.map(b => b.close);
  const volumes = bars.map(b => b.volume);
  const n       = bars.length;
  const last    = n - 1;

  const ema9v    = ema(closes, 9);
  const ema20v   = ema(closes, 20);
  const ema50v   = ema(closes, 50);
  const ema200v  = ema(closes, 200);
  const atr14v   = atr(bars, 14);
  const rsi14v   = rsi(closes, 14);
  const adxData  = adx(bars, 14);
  const bb20v    = bollingerBands(closes, 20, 2);
  const kc20v    = keltnerChannels(bars, 20, 1.5, 10);
  const vwapV    = vwap(bars);

  const avgVol = (lookback) => {
    if (n < lookback + 1) return volumes[last] || 1;
    let s = 0;
    for (let i = last - lookback; i < last; i++) s += volumes[i];
    return s / lookback;
  };

  return {
    price:    closes[last],
    open:     bars[last].open,
    high:     bars[last].high,
    low:      bars[last].low,
    volume:   bars[last].volume,
    ema9:     ema9v[last],
    ema20:    ema20v[last],
    ema50:    ema50v[last],
    ema200:   ema200v[last],
    atr14:    atr14v[last],
    rsi14:    rsi14v[last],
    adx14:    adxData.adx[last],
    diPlus:   adxData.diPlus[last],
    diMinus:  adxData.diMinus[last],
    bb:       bb20v[last],
    kc:       kc20v[last],
    vwap:     vwapV[last],
    avgVol20: avgVol(20),
    avgVol30: avgVol(30),
    bars,
    _closes:  closes,
    _highs:   bars.map(b => b.high),
    _lows:    bars.map(b => b.low),
    _volumes: volumes,
    _ema9:    ema9v,
    _ema20:   ema20v,
    _atr14:   atr14v,
    _bb:      bb20v,
    _kc:      kc20v,
  };
}
