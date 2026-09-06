import { computeLowFloatIgnition } from './low-float-ignition.js';

const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Number(n) || 0));
const finite = value => Number.isFinite(Number(value));

const stageBase = Object.freeze({
  DORMANT: 0,
  BUILDING: 18,
  ARMED: 34,
  IGNITION: 42,
  EXTENDED: -35,
});

function scarcityPoints(floatShares) {
  if (!finite(floatShares)) return 0;
  const f = Number(floatShares);
  if (f <= 5_000_000) return 10;
  if (f <= 10_000_000) return 8;
  if (f <= 20_000_000) return 5;
  if (f <= 50_000_000) return 2;
  return 0;
}

function boundedMetric(value, cap, points) {
  if (!finite(value) || Number(value) <= 0) return 0;
  return Math.min(points, Number(value) / cap * points);
}

export function computeExplosivePotential(input = {}) {
  const row = input.engine ? input : computeLowFloatIgnition(input);
  const m = row.metrics || {};
  const c = row.components || {};

  let score = stageBase[row.stage] || 0;
  score += clamp(row.priorityScore) * 0.22;
  score += clamp(row.proximityScore) * 0.18;
  score += boundedMetric(m.rvol, 8, 8);
  score += boundedMetric(m.floatTurnover, 1.5, 8);
  score += boundedMetric(m.volumeAcceleration5m, 4, 7);
  score += boundedMetric(m.preMarketTurnover, 0.75, 5);
  score += scarcityPoints(m.floatShares);

  if (Number(c.catalystScore) >= 8) score += 4;
  else if (Number(c.catalystScore) >= 5) score += 2;

  if (m.optionable === true) score += 2;
  if (finite(m.nearOtmCallVolumeToOi)) score += boundedMetric(m.nearOtmCallVolumeToOi, 5, 4);
  if (finite(m.shortInterestPct) && Number(m.shortInterestPct) >= 20) score += 3;

  const riskFlags = Array.isArray(row.riskFlags) ? row.riskFlags : [];
  score -= Math.min(20, riskFlags.length * 3);
  if (riskFlags.includes('OFFERING_RISK')) score -= 8;
  if (riskFlags.includes('DILUTION_RISK')) score -= 6;
  if (riskFlags.includes('EXTENDED_DO_NOT_CHASE') || row.stage === 'EXTENDED') score -= 30;
  if (row.confidence === 'LOW') score -= 8;

  return {
    ...row,
    explosivePotentialScore: clamp(Math.round(score)),
    potentialLabel: row.stage === 'EXTENDED' ? 'PAST_FRESH_ENTRY' : 'MOST_POTENTIAL_FIRST',
    potentialIsProbability: false,
  };
}

export function rankMostPotentialFirst(inputs = [], { optionableOnly = false } = {}) {
  const ranked = inputs
    .map(computeExplosivePotential)
    .filter(row => !optionableOnly || row.metrics?.optionable === true)
    .sort((a, b) =>
      b.explosivePotentialScore - a.explosivePotentialScore ||
      Number(b.priorityScore || 0) - Number(a.priorityScore || 0) ||
      Number(b.proximityScore || 0) - Number(a.proximityScore || 0) ||
      Number(b.score || 0) - Number(a.score || 0)
    );

  return ranked.map((row, index) => ({
    ...row,
    rank: index + 1,
    topPick: index === 0,
    scannerOrderReason: index === 0
      ? 'Highest current explosive-potential score among verified candidates.'
      : 'Ranked behind stronger current explosive-potential evidence.',
  }));
}

export function selectMostPotentialCandidate(inputs = [], options = {}) {
  return rankMostPotentialFirst(inputs, options)[0] || null;
}

function fmt(value, suffix = '') {
  return finite(value) ? `${Number(value).toFixed(Number(value) >= 10 ? 1 : 2)}${suffix}` : 'n/a';
}

function nextProof(row) {
  const m = row.metrics || {};
  if (row.stage === 'IGNITION') return 'hold breakout/VWAP with volume';
  if (row.stage === 'ARMED') {
    if (finite(m.openingRangeBreakPct) && Number(m.openingRangeBreakPct) <= 0) return 'clear and hold ORH';
    return 'hold VWAP and confirm volume';
  }
  if (row.stage === 'BUILDING') return 'wait for VWAP/ORB confirmation';
  return 'wait for a valid setup';
}

export function buildWorkdayTextAlert(candidate, { url = 'https://wallstreethustler.com' } = {}) {
  if (!candidate) return null;
  const row = candidate.explosivePotentialScore == null ? computeExplosivePotential(candidate) : candidate;
  const m = row.metrics || {};
  const rank = Number(row.rank || 1);
  const label = row.stage === 'IGNITION' ? 'IGNITION' : row.stage === 'ARMED' ? 'ARMED' : 'WATCH';
  const text = `WSH 9-TO-5 | #${rank} ${row.symbol} ${label} | Potential ${row.explosivePotentialScore}/100 | RVOL ${fmt(m.rvol, 'x')} | Turnover ${fmt(m.floatTurnover, 'x')} | Next: ${nextProof(row)}. Research alert, not a buy signal. ${url}`;
  return {
    channel: 'SMS',
    audience: 'WORKDAY_9_TO_5',
    symbol: row.symbol,
    stage: row.stage,
    urgency: row.stage === 'IGNITION' ? 'HIGH' : row.stage === 'ARMED' ? 'MEDIUM' : 'LOW',
    text,
  };
}

export function shouldSendWorkdayText(candidate, previous = null) {
  if (!candidate) return false;
  const row = candidate.explosivePotentialScore == null ? computeExplosivePotential(candidate) : candidate;
  if (!['ARMED', 'IGNITION'].includes(row.stage)) return false;
  if (row.confidence === 'LOW') return false;
  if ((row.riskFlags || []).includes('EXTENDED_DO_NOT_CHASE')) return false;
  if (!previous) return true;

  const prior = previous.explosivePotentialScore == null ? computeExplosivePotential(previous) : previous;
  if (row.stage !== prior.stage) return true;
  if (row.symbol !== prior.symbol) return true;
  return Number(row.explosivePotentialScore || 0) - Number(prior.explosivePotentialScore || 0) >= 8;
}
