// WallStreetHustler Low-Float Momentum Ignition Engine
// Pure scoring logic: never fabricates missing market/fundamental inputs.

const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Number(n) || 0));
const finite = v => Number.isFinite(Number(v));
const ratioScore = (value, bands) => {
  if (!finite(value)) return 0;
  const n = Number(value);
  for (const [threshold, score] of bands) if (n >= threshold) return score;
  return 0;
};

export const LOW_FLOAT_LIMITS = Object.freeze({
  nanoFloat: 5_000_000,
  lowFloat: 20_000_000,
  extendedFloat: 50_000_000,
  minPrice: 0.50,
  maxPrice: 30,
});

export function computeLowFloatIgnition(input = {}) {
  const {
    symbol, price, floatShares, sharesOutstanding, marketCap,
    volume, avgVolume20, volume5m, priorVolume5m,
    changePct, change5mPct, vwap, openingRangeHigh, dayHigh,
    catalystConfirmed = false, catalystAgeMinutes,
    haltCount = 0, spreadPct,
    offeringRisk = false, dilutionRisk = false, reverseSplitRisk = false,
    shortInterestPct, borrowFeePct, shortable,
  } = input;

  const missing = [];
  for (const [key, value] of Object.entries({ price, floatShares, volume, avgVolume20 })) {
    if (!finite(value)) missing.push(key);
  }

  const p = finite(price) ? Number(price) : null;
  const float = finite(floatShares) ? Number(floatShares) : null;
  const vol = finite(volume) ? Number(volume) : null;
  const avgVol = finite(avgVolume20) ? Number(avgVolume20) : null;
  const rvol = vol != null && avgVol > 0 ? vol / avgVol : null;
  const turnover = vol != null && float > 0 ? vol / float : null;
  const volAcceleration = finite(volume5m) && finite(priorVolume5m) && Number(priorVolume5m) > 0
    ? Number(volume5m) / Number(priorVolume5m) : null;
  const aboveVwapPct = p != null && finite(vwap) && Number(vwap) > 0 ? (p / Number(vwap) - 1) * 100 : null;
  const orbBreakPct = p != null && finite(openingRangeHigh) && Number(openingRangeHigh) > 0
    ? (p / Number(openingRangeHigh) - 1) * 100 : null;

  // 0-20: supply scarcity. Smaller verified float scores higher.
  let floatScore = 0;
  if (float != null) {
    if (float <= 5_000_000) floatScore = 20;
    else if (float <= 10_000_000) floatScore = 17;
    else if (float <= 20_000_000) floatScore = 13;
    else if (float <= 50_000_000) floatScore = 7;
  }

  // 0-20: abnormal participation.
  const rvolScore = ratioScore(rvol, [[10,20],[7,18],[5,16],[3,12],[2,8],[1.5,4]]);

  // 0-15: percentage of float already rotated.
  const turnoverScore = ratioScore(turnover, [[3,15],[2,14],[1,12],[0.5,9],[0.25,6],[0.1,3]]);

  // 0-10: recent acceleration instead of stale daily volume.
  const accelerationScore = ratioScore(volAcceleration, [[4,10],[3,9],[2,7],[1.5,5],[1.2,3]]);

  // 0-15: actual price confirmation.
  let structureScore = 0;
  if (finite(changePct)) structureScore += Math.min(6, Math.max(0, Number(changePct)) / 3);
  if (aboveVwapPct != null && aboveVwapPct > 0) structureScore += Math.min(4, 2 + aboveVwapPct / 2);
  if (orbBreakPct != null && orbBreakPct > 0) structureScore += Math.min(5, 3 + orbBreakPct);
  structureScore = clamp(structureScore, 0, 15);

  // 0-10: fresh, verified catalyst. Unknown catalyst receives no points.
  let catalystScore = 0;
  if (catalystConfirmed) {
    catalystScore = !finite(catalystAgeMinutes) ? 6
      : Number(catalystAgeMinutes) <= 60 ? 10
      : Number(catalystAgeMinutes) <= 240 ? 8
      : Number(catalystAgeMinutes) <= 1440 ? 5 : 2;
  }

  // 0-10: squeeze pressure, only when supplied by a verified source.
  let squeezeScore = 0;
  if (finite(shortInterestPct)) squeezeScore += Math.min(6, Math.max(0, Number(shortInterestPct) - 10) / 5);
  if (finite(borrowFeePct)) squeezeScore += Math.min(4, Math.max(0, Number(borrowFeePct) - 5) / 15);
  squeezeScore = clamp(squeezeScore, 0, 10);

  let rawScore = floatScore + rvolScore + turnoverScore + accelerationScore + structureScore + catalystScore + squeezeScore;

  const riskFlags = [];
  let penalty = 0;
  if (offeringRisk) { riskFlags.push('OFFERING_RISK'); penalty += 18; }
  if (dilutionRisk) { riskFlags.push('DILUTION_RISK'); penalty += 12; }
  if (reverseSplitRisk) { riskFlags.push('REVERSE_SPLIT_RISK'); penalty += 8; }
  if (finite(spreadPct) && Number(spreadPct) >= 2) { riskFlags.push('WIDE_SPREAD'); penalty += 8; }
  if (finite(haltCount) && Number(haltCount) >= 2) { riskFlags.push('HALT_RISK'); penalty += 5; }
  if (p != null && p < LOW_FLOAT_LIMITS.minPrice) { riskFlags.push('SUB_50_CENT'); penalty += 12; }

  // Anti-chase: a stock far above VWAP / opening range or already vertical is not a fresh ignition.
  let extended = false;
  if (finite(change5mPct) && Number(change5mPct) >= 12) extended = true;
  if (aboveVwapPct != null && aboveVwapPct >= 15) extended = true;
  if (p != null && finite(dayHigh) && Number(dayHigh) > 0 && finite(changePct) && Number(changePct) >= 80 && p >= Number(dayHigh) * 0.98) extended = true;
  if (extended) { riskFlags.push('EXTENDED_DO_NOT_CHASE'); penalty += 15; }

  const score = clamp(Math.round(rawScore - penalty));
  const coreReady = float != null && float <= LOW_FLOAT_LIMITS.extendedFloat && rvol != null && turnover != null;

  let stage = 'DORMANT';
  if (coreReady && score >= 35) stage = 'BUILDING';
  if (coreReady && score >= 55 && (aboveVwapPct == null || aboveVwapPct > 0)) stage = 'ARMED';
  if (coreReady && score >= 70 && aboveVwapPct > 0 && (orbBreakPct == null || orbBreakPct > 0)) stage = 'IGNITION';
  if (extended) stage = 'EXTENDED';

  const alertEligible = stage === 'ARMED' || stage === 'IGNITION';
  const confidence = missing.length === 0 ? 'HIGH' : missing.length <= 2 ? 'MEDIUM' : 'LOW';

  return {
    symbol: String(symbol || '').toUpperCase(),
    engine: 'LOW_FLOAT_MOMENTUM_IGNITION_V1',
    score, stage, alertEligible, confidence,
    metrics: {
      price: p, floatShares: float, sharesOutstanding: finite(sharesOutstanding) ? Number(sharesOutstanding) : null,
      marketCap: finite(marketCap) ? Number(marketCap) : null,
      rvol: rvol == null ? null : Number(rvol.toFixed(2)),
      floatTurnover: turnover == null ? null : Number(turnover.toFixed(2)),
      volumeAcceleration5m: volAcceleration == null ? null : Number(volAcceleration.toFixed(2)),
      aboveVwapPct: aboveVwapPct == null ? null : Number(aboveVwapPct.toFixed(2)),
      openingRangeBreakPct: orbBreakPct == null ? null : Number(orbBreakPct.toFixed(2)),
      shortInterestPct: finite(shortInterestPct) ? Number(shortInterestPct) : null,
      borrowFeePct: finite(borrowFeePct) ? Number(borrowFeePct) : null,
      shortable: typeof shortable === 'boolean' ? shortable : null,
    },
    components: { floatScore, rvolScore, turnoverScore, accelerationScore, structureScore:Math.round(structureScore), catalystScore, squeezeScore, penalty },
    riskFlags,
    missing,
    rules: {
      lowFloat: float != null ? float <= LOW_FLOAT_LIMITS.lowFloat : null,
      nanoFloat: float != null ? float <= LOW_FLOAT_LIMITS.nanoFloat : null,
      catalystConfirmed:Boolean(catalystConfirmed),
      extended,
    },
  };
}

export function rankLowFloatCandidates(rows = []) {
  return rows.map(computeLowFloatIgnition)
    .sort((a, b) => b.score - a.score || Number(b.metrics.floatTurnover || 0) - Number(a.metrics.floatTurnover || 0));
}
