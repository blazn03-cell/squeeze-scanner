// Scores resolved claims per rule version and compares APEX against its baseline.
import { RULES, MIN_SAMPLE } from './outcomeRules.js';

const r3 = n => (Number.isFinite(n) ? Math.round(n * 1000) / 1000 : null);

function summarize(claims, results) {
  const resolved = claims.map(c => results.get(c.claimId)).filter(Boolean);
  const n = resolved.length;
  const count = o => resolved.filter(r => r.outcome === o).length;
  const rs = resolved.map(r => r.rMultiple);
  const totalR = rs.reduce((a, b) => a + b, 0);
  const wins = rs.filter(r => r > 0);
  const losses = rs.filter(r => r <= 0);
  const grossWin = wins.reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));

  let peak = 0, equity = 0, maxDrawdownR = 0;
  const ordered = claims.filter(c => results.has(c.claimId))
    .sort((a, b) => (results.get(a.claimId).exitDate < results.get(b.claimId).exitDate ? -1 : 1));
  for (const c of ordered) {
    equity += results.get(c.claimId).rMultiple;
    peak = Math.max(peak, equity);
    maxDrawdownR = Math.min(maxDrawdownR, equity - peak);
  }

  return {
    claims: claims.length,
    resolved: n,
    pending: claims.length - n,
    targetFirst: count('TARGET_FIRST'),
    stopFirst: count('STOP_FIRST'),
    ambiguous: count('AMBIGUOUS_SAME_BAR'),
    expired: count('EXPIRED'),
    winRate: n ? r3(wins.length / n) : null,
    avgR: n ? r3(totalR / n) : null,
    totalR: r3(totalR),
    profitFactor: grossLoss > 0 ? r3(grossWin / grossLoss) : null,
    maxDrawdownR: r3(maxDrawdownR),
    sample: n >= MIN_SAMPLE ? 'ADEQUATE' : 'INSUFFICIENT_SAMPLE',
  };
}

export function buildTrackRecord(ledger) {
  const byRule = {};
  const allClaims = [...ledger.claims.values()];
  for (const version of Object.keys(RULES)) {
    byRule[version] = {
      description: RULES[version].description,
      ...summarize(allClaims.filter(c => c.ruleVersion === version), ledger.results),
    };
  }

  const apex = byRule['scan-apex-v1'];
  const base = byRule['scan-baseline-v1'];
  const comparable = apex.resolved >= MIN_SAMPLE && base.resolved >= MIN_SAMPLE;
  const edgeR = apex.avgR != null && base.avgR != null ? r3(apex.avgR - base.avgR) : null;

  let verdict;
  if (!comparable) verdict = `NO VERDICT: need ${MIN_SAMPLE}+ resolved claims in both APEX and baseline (have ${apex.resolved} / ${base.resolved}). Do not size up on these numbers.`;
  else if (apex.avgR <= 0) verdict = 'APEX expectancy is not positive on this yardstick. Do not trade it with real size.';
  else if (edgeR <= 0) verdict = 'APEX is positive but does not beat the naive baseline. The score is not adding edge.';
  else verdict = 'APEX beats baseline on this sample. Still research-only: check drawdown and repeat on the next rule version before risking more.';

  return {
    generatedAt: new Date().toISOString(),
    minSample: MIN_SAMPLE,
    rules: byRule,
    apexVsBaseline: { comparable, edgeAvgR: edgeR, verdict },
    ledger: ledger.stats(),
    caveats: [
      'Daily bars only: same-bar target+stop is graded as a loss (conservative).',
      'Universe is a fixed watchlist: survivorship bias applies (see docs/DATA_SETUP.md).',
      'R is per-share price R, before spread, slippage, commissions and options decay.',
      'Research only. A track record is not a guarantee of future results.',
    ],
  };
}
