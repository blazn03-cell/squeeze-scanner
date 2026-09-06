// WallStreetHustler Low-Float Momentum Ignition Engine
// Pure scoring logic. Missing market/fundamental/option inputs remain explicitly missing.

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
  coreFloat: 10_000_000,
  lowFloat: 20_000_000,
  extendedFloat: 50_000_000,
  minPrice: 0.50,
  optionablePreferredMinPrice: 5,
  optionablePreferredMaxPrice: 20,
  maxPrice: 30,
});

function optionGammaEvidence(input = {}) {
  const {
    optionable, optionVolume, callVolume, putVolume,
    nearOtmCallVolume, nearOtmCallOpenInterest,
    optionSpreadPct, nearestOtmStrikePct, daysToExpiry,
  } = input;

  const missing = [];
  if (typeof optionable !== 'boolean') missing.push('optionable');
  if (optionable === true) {
    if (!finite(optionVolume)) missing.push('optionVolume');
    if (!finite(nearOtmCallVolume)) missing.push('nearOtmCallVolume');
    if (!finite(nearOtmCallOpenInterest)) missing.push('nearOtmCallOpenInterest');
  }

  if (optionable !== true) {
    return { score:0, callOiRatio:null, callShare:null, missing, liquidEnough:null };
  }

  let score = 2; // verified optionable is useful, but is not itself bullish evidence.
  const callOiRatio = finite(nearOtmCallVolume) && finite(nearOtmCallOpenInterest) && Number(nearOtmCallOpenInterest) > 0
    ? Number(nearOtmCallVolume) / Number(nearOtmCallOpenInterest) : null;
  const callShare = finite(callVolume) && finite(putVolume) && Number(callVolume) + Number(putVolume) > 0
    ? Number(callVolume) / (Number(callVolume) + Number(putVolume)) : null;

  score += ratioScore(callOiRatio, [[5,8],[3,6],[2,4],[1,2]]);
  if (callShare != null) {
    if (callShare >= 0.75) score += 4;
    else if (callShare >= 0.62) score += 2;
  }
  if (finite(nearestOtmStrikePct)) {
    const pct = Number(nearestOtmStrikePct);
    if (pct >= 0 && pct <= 10) score += 4;
    else if (pct > 10 && pct <= 20) score += 2;
  }
  if (finite(daysToExpiry)) {
    const dte = Number(daysToExpiry);
    if (dte >= 1 && dte <= 7) score += 2;
    else if (dte <= 14) score += 1;
  }

  let liquidEnough = null;
  if (finite(optionSpreadPct)) {
    liquidEnough = Number(optionSpreadPct) <= 10;
    if (Number(optionSpreadPct) > 20) score -= 6;
    else if (Number(optionSpreadPct) > 10) score -= 3;
  }

  return {
    score:clamp(score, 0, 20),
    callOiRatio:callOiRatio == null ? null : Number(callOiRatio.toFixed(2)),
    callShare:callShare == null ? null : Number(callShare.toFixed(2)),
    missing,
    liquidEnough,
  };
}

export function computeLowFloatIgnition(input = {}) {
  const {
    symbol, price, floatShares, sharesOutstanding, marketCap,
    volume, avgVolume20, volume5m, priorVolume5m,
    preMarketVolume, preMarketChangePct, preMarketHigh,
    changePct, change5mPct, vwap, openingRangeHigh, dayHigh,
    catalystConfirmed = false, catalystAgeMinutes,
    haltCount = 0, spreadPct,
    offeringRisk = false, dilutionRisk = false, reverseSplitRisk = false,
    shortInterestPct, borrowFeePct, shortable,
    optionable, optionVolume, callVolume, putVolume,
    nearOtmCallVolume, nearOtmCallOpenInterest,
    optionSpreadPct, nearestOtmStrikePct, daysToExpiry, impliedVolatilityPct,
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
  const preMarketTurnover = finite(preMarketVolume) && float > 0 ? Number(preMarketVolume) / float : null;
  const volAcceleration = finite(volume5m) && finite(priorVolume5m) && Number(priorVolume5m) > 0
    ? Number(volume5m) / Number(priorVolume5m) : null;
  const aboveVwapPct = p != null && finite(vwap) && Number(vwap) > 0 ? (p / Number(vwap) - 1) * 100 : null;
  const orbBreakPct = p != null && finite(openingRangeHigh) && Number(openingRangeHigh) > 0
    ? (p / Number(openingRangeHigh) - 1) * 100 : null;
  const preMarketBreakPct = p != null && finite(preMarketHigh) && Number(preMarketHigh) > 0
    ? (p / Number(preMarketHigh) - 1) * 100 : null;

  // 0-20: supply scarcity. Smaller verified float scores higher.
  let floatScore = 0;
  if (float != null) {
    if (float <= 5_000_000) floatScore = 20;
    else if (float <= 10_000_000) floatScore = 17;
    else if (float <= 20_000_000) floatScore = 13;
    else if (float <= 50_000_000) floatScore = 7;
  }

  const rvolScore = ratioScore(rvol, [[10,20],[7,18],[5,16],[3,12],[2,8],[1.5,4]]);
  const turnoverScore = ratioScore(turnover, [[3,15],[2,14],[1,12],[0.5,9],[0.25,6],[0.1,3]]);
  const accelerationScore = ratioScore(volAcceleration, [[4,10],[3,9],[2,7],[1.5,5],[1.2,3]]);

  let structureScore = 0;
  if (finite(changePct)) structureScore += Math.min(6, Math.max(0, Number(changePct)) / 3);
  if (aboveVwapPct != null && aboveVwapPct > 0) structureScore += Math.min(4, 2 + aboveVwapPct / 2);
  if (orbBreakPct != null && orbBreakPct > 0) structureScore += Math.min(5, 3 + orbBreakPct);
  structureScore = clamp(structureScore, 0, 15);

  let preMarketScore = 0;
  preMarketScore += ratioScore(preMarketTurnover, [[1,8],[0.75,7],[0.5,6],[0.25,4],[0.1,2]]);
  if (finite(preMarketChangePct)) {
    const pm = Number(preMarketChangePct);
    if (pm >= 20) preMarketScore += 4;
    else if (pm >= 10) preMarketScore += 3;
    else if (pm >= 5) preMarketScore += 1;
  }
  if (preMarketBreakPct != null && preMarketBreakPct > 0) preMarketScore += 3;
  preMarketScore = clamp(preMarketScore, 0, 15);

  let catalystScore = 0;
  if (catalystConfirmed) {
    catalystScore = !finite(catalystAgeMinutes) ? 6
      : Number(catalystAgeMinutes) <= 60 ? 10
      : Number(catalystAgeMinutes) <= 240 ? 8
      : Number(catalystAgeMinutes) <= 1440 ? 5 : 2;
  }

  let squeezeScore = 0;
  if (finite(shortInterestPct)) squeezeScore += Math.min(6, Math.max(0, Number(shortInterestPct) - 10) / 5);
  if (finite(borrowFeePct)) squeezeScore += Math.min(4, Math.max(0, Number(borrowFeePct) - 5) / 15);
  squeezeScore = clamp(squeezeScore, 0, 10);

  const optionEvidence = optionGammaEvidence(input);
  for (const item of optionEvidence.missing) if (!missing.includes(item)) missing.push(item);

  // Core ignition score intentionally remains stock-driven. Option activity is a confirming layer,
  // so thin/missing options data cannot manufacture a stock ignition.
  let rawScore = floatScore + rvolScore + turnoverScore + accelerationScore + structureScore + catalystScore + squeezeScore;

  const riskFlags = [];
  let penalty = 0;
  if (offeringRisk) { riskFlags.push('OFFERING_RISK'); penalty += 18; }
  if (dilutionRisk) { riskFlags.push('DILUTION_RISK'); penalty += 12; }
  if (reverseSplitRisk) { riskFlags.push('REVERSE_SPLIT_RISK'); penalty += 8; }
  if (finite(spreadPct) && Number(spreadPct) >= 2) { riskFlags.push('WIDE_SPREAD'); penalty += 8; }
  if (finite(haltCount) && Number(haltCount) >= 2) { riskFlags.push('HALT_RISK'); penalty += 5; }
  if (p != null && p < LOW_FLOAT_LIMITS.minPrice) { riskFlags.push('SUB_50_CENT'); penalty += 12; }
  if (optionable === true && optionEvidence.liquidEnough === false) riskFlags.push('OPTIONS_WIDE_SPREAD');

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

  // "Proximity" answers which setup is closest to the next valid state, not which has the biggest raw move.
  const threshold = stage === 'DORMANT' ? 35 : stage === 'BUILDING' ? 55 : stage === 'ARMED' ? 70 : 100;
  const scoreDistance = stage === 'IGNITION' ? 0 : stage === 'EXTENDED' ? 100 : Math.max(0, threshold - score);
  let proximityScore = stage === 'IGNITION' ? 100 : stage === 'EXTENDED' ? 0 : clamp(100 - scoreDistance * 4);
  if (stage === 'ARMED' && aboveVwapPct != null && aboveVwapPct <= 0) proximityScore -= 20;
  if (stage === 'ARMED' && orbBreakPct != null && orbBreakPct <= 0) proximityScore -= Math.min(25, Math.abs(orbBreakPct) * 5);
  proximityScore = clamp(Math.round(proximityScore));

  // This is a ranking score, NOT a statistical win probability. A real probability can only be
  // published after enough timestamped forward outcomes exist to calibrate score buckets.
  const stageWeight = { DORMANT:0, BUILDING:15, ARMED:30, IGNITION:40, EXTENDED:-25 }[stage] || 0;
  const optionableBonus = optionable === true ? 3 : 0;
  const preferredPriceBonus = p != null && p >= LOW_FLOAT_LIMITS.optionablePreferredMinPrice && p <= LOW_FLOAT_LIMITS.optionablePreferredMaxPrice ? 3 : 0;
  const priorityScore = clamp(Math.round(
    score * 0.48 + proximityScore * 0.22 + optionEvidence.score * 0.65 + preMarketScore * 0.4
    + stageWeight + optionableBonus + preferredPriceBonus - Math.min(20, penalty * 0.35)
  ));

  const confidence = missing.length === 0 ? 'HIGH' : missing.length <= 3 ? 'MEDIUM' : 'LOW';

  return {
    symbol: String(symbol || '').toUpperCase(),
    engine: 'LOW_FLOAT_MOMENTUM_IGNITION_V2',
    score,
    priorityScore,
    proximityScore,
    probabilityStatus:'UNTRAINED_NOT_A_PROBABILITY',
    stage,
    alertEligible,
    confidence,
    metrics: {
      price: p,
      floatShares: float,
      sharesOutstanding: finite(sharesOutstanding) ? Number(sharesOutstanding) : null,
      marketCap: finite(marketCap) ? Number(marketCap) : null,
      rvol: rvol == null ? null : Number(rvol.toFixed(2)),
      floatTurnover: turnover == null ? null : Number(turnover.toFixed(2)),
      preMarketTurnover: preMarketTurnover == null ? null : Number(preMarketTurnover.toFixed(2)),
      volumeAcceleration5m: volAcceleration == null ? null : Number(volAcceleration.toFixed(2)),
      aboveVwapPct: aboveVwapPct == null ? null : Number(aboveVwapPct.toFixed(2)),
      openingRangeBreakPct: orbBreakPct == null ? null : Number(orbBreakPct.toFixed(2)),
      preMarketBreakPct: preMarketBreakPct == null ? null : Number(preMarketBreakPct.toFixed(2)),
      shortInterestPct: finite(shortInterestPct) ? Number(shortInterestPct) : null,
      borrowFeePct: finite(borrowFeePct) ? Number(borrowFeePct) : null,
      shortable: typeof shortable === 'boolean' ? shortable : null,
      optionable: typeof optionable === 'boolean' ? optionable : null,
      optionVolume: finite(optionVolume) ? Number(optionVolume) : null,
      callVolume: finite(callVolume) ? Number(callVolume) : null,
      putVolume: finite(putVolume) ? Number(putVolume) : null,
      nearOtmCallVolume: finite(nearOtmCallVolume) ? Number(nearOtmCallVolume) : null,
      nearOtmCallOpenInterest: finite(nearOtmCallOpenInterest) ? Number(nearOtmCallOpenInterest) : null,
      nearOtmCallVolumeToOi: optionEvidence.callOiRatio,
      callVolumeShare: optionEvidence.callShare,
      optionSpreadPct: finite(optionSpreadPct) ? Number(optionSpreadPct) : null,
      nearestOtmStrikePct: finite(nearestOtmStrikePct) ? Number(nearestOtmStrikePct) : null,
      daysToExpiry: finite(daysToExpiry) ? Number(daysToExpiry) : null,
      impliedVolatilityPct: finite(impliedVolatilityPct) ? Number(impliedVolatilityPct) : null,
    },
    components: {
      floatScore, rvolScore, turnoverScore, accelerationScore,
      structureScore:Math.round(structureScore), preMarketScore,
      catalystScore, squeezeScore, optionGammaScore:optionEvidence.score, penalty,
    },
    riskFlags,
    missing,
    rules: {
      lowFloat: float != null ? float <= LOW_FLOAT_LIMITS.lowFloat : null,
      coreLowFloat: float != null ? float <= LOW_FLOAT_LIMITS.coreFloat : null,
      nanoFloat: float != null ? float <= LOW_FLOAT_LIMITS.nanoFloat : null,
      optionable: typeof optionable === 'boolean' ? optionable : null,
      optionablePreferredPrice: p != null ? p >= LOW_FLOAT_LIMITS.optionablePreferredMinPrice && p <= LOW_FLOAT_LIMITS.optionablePreferredMaxPrice : null,
      catalystConfirmed:Boolean(catalystConfirmed),
      extended,
    },
  };
}

export function rankLowFloatCandidates(rows = [], { optionableOnly = false } = {}) {
  const scored = rows.map(computeLowFloatIgnition)
    .filter(row => !optionableOnly || row.metrics.optionable === true)
    .sort((a, b) =>
      b.priorityScore - a.priorityScore
      || b.proximityScore - a.proximityScore
      || b.score - a.score
      || Number(b.metrics.floatTurnover || 0) - Number(a.metrics.floatTurnover || 0)
    );

  return scored.map((row, index) => ({ ...row, rank:index + 1, topPick:index === 0 }));
}

export function selectTopLowFloatCandidate(rows = [], options = {}) {
  return rankLowFloatCandidates(rows, options)[0] || null;
}
