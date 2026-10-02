// Frozen, versioned evaluation rules for the outcome loop.
//
// A rule version is never edited after claims exist for it. To change a
// threshold, add a new version; old claims keep being graded by the rule they
// were frozen with. Thresholds come from docs/DATA_SETUP.md "Historical audit"
// (±12% within three sessions, 1.5x event volume) so the live loop grades the
// scanner by the same yardstick as the replay audit.

export const RULES = Object.freeze({
  'scan-apex-v1': Object.freeze({
    kind: 'scan',
    description: 'APEX directional call (apexScore >= 70, direction != 0). Win = +12% move in call direction before -6% against, within 3 completed sessions after the decision day.',
    select: r => Number.isFinite(r?.apexScore) && r.apexScore >= 70 && Math.sign(r?.direction ?? 0) !== 0,
    targetPct: 12,
    stopPct: 6,
    horizonSessions: 3,
  }),
  // Naive control: every directional reading, no APEX score filter. If APEX
  // cannot beat this, the score adds no edge over "trade whatever moves".
  'scan-baseline-v1': Object.freeze({
    kind: 'scan',
    description: 'Baseline control: any directional reading (direction != 0), same 12%/6%/3-session yardstick.',
    select: r => Math.sign(r?.direction ?? 0) !== 0,
    targetPct: 12,
    stopPct: 6,
    horizonSessions: 3,
  }),
  // v2 yardstick, registered 2026-10-02 BEFORE any forward data for it exists.
  // Why: the v1 retrospective (Jan–Sep 18 2026, 33 stocks) resolved 89% of
  // claims by expiry and ~1% by target, so ±12% in 3 sessions mostly measures
  // drift, not setup quality. v2 scales levels to each stock's own ATR.
  // The 2x/1x/5 parameters are a conventional 2:1 reward:risk choice and were
  // NOT searched or fitted on that history. Never edit; add v3 instead.
  'scan-apex-atr-v2': Object.freeze({
    kind: 'scan',
    registeredAt: '2026-10-02',
    description: 'APEX directional call (apexScore >= 70, direction != 0). Win = 2x ATR(14) move in call direction before 1x ATR against, within 5 completed sessions.',
    select: r => Number.isFinite(r?.apexScore) && r.apexScore >= 70 && Math.sign(r?.direction ?? 0) !== 0,
    targetAtr: 2,
    stopAtr: 1,
    horizonSessions: 5,
  }),
  'scan-baseline-atr-v2': Object.freeze({
    kind: 'scan',
    registeredAt: '2026-10-02',
    description: 'Baseline control for scan-apex-atr-v2: any directional reading, same 2x/1x ATR, 5-session yardstick.',
    select: r => Math.sign(r?.direction ?? 0) !== 0,
    targetAtr: 2,
    stopAtr: 1,
    horizonSessions: 5,
  }),
  // QQQ cascade: only states the engine labels as actionable research signals,
  // and only when the operator supplied both trigger and invalidation. Missing
  // levels mean no claim — never a guessed one.
  'cascade-qqq-v1': Object.freeze({
    kind: 'cascade',
    description: 'QQQ cascade in GET_READY/TRIGGERED/CASCADE_ACTIVE with operator trigger + invalidation. Win = +$5 (Tier 1 floor) before invalidation, within 2 completed sessions.',
    states: Object.freeze(['GET_READY', 'TRIGGERED', 'CASCADE_ACTIVE']),
    targetDollars: 5,
    horizonSessions: 2,
  }),
});

export const MIN_SAMPLE = 50;

// APEX rule -> its paired baseline control.
export const BASELINE_PAIRS = Object.freeze({
  'scan-apex-v1': 'scan-baseline-v1',
  'scan-apex-atr-v2': 'scan-baseline-atr-v2',
});

// Target/stop distance in percent for a scan rule, or null when the rule
// needs an input the claim does not have (no ATR -> no v2 claim, never a guess).
export function scanLevelPcts(rule, inputs) {
  if (Number.isFinite(rule?.targetPct) && Number.isFinite(rule?.stopPct)) {
    return { targetPct: rule.targetPct, stopPct: rule.stopPct };
  }
  const atrPct = inputs?.atrPct;
  if (!Number.isFinite(atrPct) || atrPct <= 0 || atrPct >= 50) return null;
  return { targetPct: rule.targetAtr * atrPct, stopPct: rule.stopAtr * atrPct };
}

export function getRule(version) {
  return Object.prototype.hasOwnProperty.call(RULES, version) ? RULES[version] : null;
}

// Serializable copy of a rule's parameters, frozen into each claim so the
// grade can be reproduced even if this file changes.
export function ruleParams(version) {
  const rule = getRule(version);
  if (!rule) return null;
  const out = {};
  for (const [k, v] of Object.entries(rule)) {
    if (typeof v !== 'function') out[k] = Array.isArray(v) ? [...v] : v;
  }
  return out;
}
