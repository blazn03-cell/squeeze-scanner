// Trade levels — ATR- and structure-derived entry zone, stop, target and R:R.
//
// Scope: these are risk-framework reference levels computed from daily bars.
// They are not recommendations, not an option contract, and not a forecast.
// A neutral direction produces no levels at all rather than an invented bias.

const ENTRY_BAND_ATR = 0.25;  // half-width of the entry zone
const STOP_ATR       = 1.5;   // volatility stop distance
const TARGET_R       = 2.0;   // target expressed as a multiple of risk

// Structure stop is only preferred over the ATR stop when it sits inside this
// band — a box floor 6 ATR away is not a stop, it is a different trade.
const MAX_STRUCT_ATR = 2.5;

const r2 = v => Math.round(v * 100) / 100;

/**
 * @param {object} ind        buildIndicators() output (needs price, atr14)
 * @param {number} direction  calcDirection() output, -2..2
 * @param {object|null} darvas calcDarvas() output, for structural stop placement
 * @returns {object|null} levels, or null when there is no directional bias
 */
export function calcLevels(ind, direction, darvas) {
  if (!ind) return null;

  const price = ind.price;
  const atr   = ind.atr14;
  if (!Number.isFinite(price) || price <= 0) return null;
  if (!Number.isFinite(atr) || atr <= 0) return null;
  if (!direction) return null;             // neutral: no levels, by design

  const long = direction > 0;
  const band = atr * ENTRY_BAND_ATR;

  const entryLow  = price - band;
  const entryHigh = price + band;
  // Enter against the pullback side of the zone: longs buy the low edge.
  const entryRef  = long ? entryLow : entryHigh;

  const atrStop = long ? entryRef - atr * STOP_ATR : entryRef + atr * STOP_ATR;

  // Prefer a structural stop (Darvas box edge) when one exists, sits on the
  // correct side of entry, and is not absurdly far away.
  let stop   = atrStop;
  let basis  = 'ATR';
  const edge = long ? darvas?.boxBot : darvas?.boxTop;
  if (Number.isFinite(edge)) {
    const beyondEntry = long ? edge < entryRef : edge > entryRef;
    const withinReach = Math.abs(entryRef - edge) <= atr * MAX_STRUCT_ATR;
    // Only take it when it is tighter than the ATR stop but still has room.
    const tighter     = long ? edge > atrStop : edge < atrStop;
    if (beyondEntry && withinReach && tighter) {
      // Pad past the exact box edge so the stop is not sitting on the wick.
      stop  = long ? edge - atr * 0.1 : edge + atr * 0.1;
      basis = 'STRUCTURE';
    }
  }

  const risk = Math.abs(entryRef - stop);
  if (!(risk > 0)) return null;

  const target = long ? entryRef + risk * TARGET_R : entryRef - risk * TARGET_R;

  return {
    bias:      long ? 'LONG' : 'SHORT',
    entryLow:  r2(Math.min(entryLow, entryHigh)),
    entryHigh: r2(Math.max(entryLow, entryHigh)),
    entryRef:  r2(entryRef),
    stop:      r2(stop),
    target:    r2(target),
    stopBasis: basis,
    riskPerShare: r2(risk),
    riskPct:   r2((risk / entryRef) * 100),
    rMultiple: TARGET_R,
    atrUsed:   r2(atr),
  };
}

/**
 * Position size from a user's maximum dollar loss. Returned separately from
 * calcLevels because it depends on user input, not on market data.
 */
export function sizeFromRisk(levels, maxLossDollars) {
  if (!levels || !(maxLossDollars > 0)) return null;
  if (!(levels.riskPerShare > 0)) return null;
  const shares = Math.floor(maxLossDollars / levels.riskPerShare);
  if (shares < 1) return { shares: 0, cost: 0, actualRisk: 0 };
  return {
    shares,
    cost:       r2(shares * levels.entryRef),
    actualRisk: r2(shares * levels.riskPerShare),
  };
}
