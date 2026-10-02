// Turns scanner / cascade output into frozen claims. Pure functions: no I/O.
//
// A claim is everything needed to grade the call later without hindsight:
// who/what/when, the price levels, the horizon, the rule parameters, and a
// hash of the inputs the engine saw at decision time.
import { createHash } from 'node:crypto';
import { RULES, ruleParams } from './outcomeRules.js';
import { nyParts, isValidDate } from './marketTime.js';

export const CLAIM_SCHEMA = 'claim/1';

export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

export function sha256(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : stableStringify(value)).digest('hex');
}

const round = (n, dp = 4) => Math.round(n * 10 ** dp) / 10 ** dp;

const SCAN_INPUT_FIELDS = [
  'price', 'apexScore', 'direction', 'confidence', 'regime', 'stable', 'atrPct', 'relVol',
  'darvasState', 'sqzState', 'flow', 'earlyEntry', 'earningsRisk', 'spreadPct', 'spreadVerified', 'scannedAt',
];

function finalize(claim) {
  const withHash = { ...claim, inputsHash: sha256(claim.inputs) };
  return { ...withHash, contentHash: sha256(withHash) };
}

export function buildScanClaims(results, now = new Date()) {
  if (!isValidDate(now) || !Array.isArray(results)) return [];
  const decisionTime = now.toISOString();
  const sessionDate = nyParts(now).date;
  const claims = [];

  for (const r of results) {
    const price = r?.price;
    const symbol = typeof r?.symbol === 'string' ? r.symbol.toUpperCase() : null;
    if (!symbol || !Number.isFinite(price) || price <= 0) continue;
    const direction = Math.sign(r.direction ?? 0);

    for (const [version, rule] of Object.entries(RULES)) {
      if (rule.kind !== 'scan' || !rule.select(r)) continue;
      const inputs = Object.fromEntries(SCAN_INPUT_FIELDS.map(k => [k, r[k] ?? null]));
      claims.push(finalize({
        schema: CLAIM_SCHEMA,
        claimId: `${version}:${symbol}:${sessionDate}`,
        ruleVersion: version,
        kind: 'scan',
        symbol,
        decisionTime,
        sessionDate,
        direction,
        entryPrice: price,
        targetPrice: round(price * (1 + direction * rule.targetPct / 100)),
        stopPrice: round(price * (1 - direction * rule.stopPct / 100)),
        horizonSessions: rule.horizonSessions,
        rule: ruleParams(version),
        inputs,
      }));
    }
  }
  return claims;
}

export function buildCascadeClaim(snapshot, now = new Date()) {
  const version = 'cascade-qqq-v1';
  const rule = RULES[version];
  if (!isValidDate(now) || !snapshot?.signalId) return null;
  if (!rule.states.includes(snapshot.state)) return null;

  const direction = snapshot.direction === 'BULLISH' ? 1 : snapshot.direction === 'BEARISH' ? -1 : 0;
  const entry = snapshot.technical?.price;
  const stop = snapshot.event?.invalidationPrice;
  if (direction === 0 || !Number.isFinite(entry) || !Number.isFinite(stop)) return null;
  const trigger = snapshot.event?.triggerPrice;
  const sourceTime = Date.parse(snapshot.generatedAt);
  if (!Number.isFinite(trigger) || trigger <= 0 || !Number.isFinite(sourceTime)
      || sourceTime > now.getTime() || now.getTime() - sourceTime > 12 * 60000) return null;
  // Invalidation must sit on the losing side of entry, otherwise the claim is incoherent.
  if (direction * (entry - stop) <= 0) return null;

  return finalize({
    schema: CLAIM_SCHEMA,
    claimId: `${version}:${snapshot.signalId}`,
    ruleVersion: version,
    kind: 'cascade',
    symbol: 'QQQ',
    decisionTime: new Date(sourceTime).toISOString(),
    capturedAt: now.toISOString(),
    sessionDate: nyParts(new Date(sourceTime)).date,
    direction,
    entryPrice: entry,
    targetPrice: round(entry + direction * rule.targetDollars),
    stopPrice: stop,
    horizonSessions: rule.horizonSessions,
    rule: ruleParams(version),
    inputs: {
      signalId: snapshot.signalId,
      state: snapshot.state,
      triggerPrice: snapshot.event?.triggerPrice ?? null,
      invalidationPrice: stop,
      catalyst: snapshot.event?.catalyst ?? null,
      pressureBuild: snapshot.pressureBuild ?? null,
      dataConfidence: snapshot.dataConfidence ?? null,
      confirmedInputs: snapshot.confirmations?.confirmed ?? 0,
      availableInputs: snapshot.confirmations?.available ?? 0,
      generatedAt: snapshot.generatedAt ?? null,
    },
  });
}

// Validation shared by the ledger: every field the evaluator depends on.
export function validateClaim(c) {
  const errors = [];
  if (!c || typeof c !== 'object') return ['not an object'];
  if (c.schema !== CLAIM_SCHEMA) errors.push('schema');
  if (typeof c.claimId !== 'string' || !c.claimId) errors.push('claimId');
  if (!RULES[c.ruleVersion]) errors.push('ruleVersion');
  if (typeof c.symbol !== 'string' || !/^[A-Z.\-]{1,10}$/.test(c.symbol)) errors.push('symbol');
  if (!isValidDate(new Date(c.decisionTime)) || typeof c.decisionTime !== 'string') errors.push('decisionTime');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.sessionDate ?? '')) errors.push('sessionDate');
  if (c.direction !== 1 && c.direction !== -1) errors.push('direction');
  for (const k of ['entryPrice', 'targetPrice', 'stopPrice']) {
    if (!Number.isFinite(c[k]) || c[k] <= 0) errors.push(k);
  }
  if (!Number.isInteger(c.horizonSessions) || c.horizonSessions < 1 || c.horizonSessions > 60) errors.push('horizonSessions');
  if (errors.length === 0) {
    const expectedRule = ruleParams(c.ruleVersion);
    if (stableStringify(c.rule) !== stableStringify(expectedRule)) errors.push('rule contract mismatch');
    if (c.horizonSessions !== expectedRule.horizonSessions) errors.push('horizon contract mismatch');
    if (nyParts(new Date(c.decisionTime)).date !== c.sessionDate) errors.push('sessionDate mismatch');
    if (c.kind !== expectedRule.kind) errors.push('kind mismatch');
    const expectedTarget = c.kind === 'scan'
      ? round(c.entryPrice * (1 + c.direction * expectedRule.targetPct / 100))
      : round(c.entryPrice + c.direction * expectedRule.targetDollars);
    if (c.targetPrice !== expectedTarget) errors.push('target contract mismatch');
    if (c.kind === 'scan' && c.stopPrice !== round(c.entryPrice * (1 - c.direction * expectedRule.stopPct / 100))) errors.push('stop contract mismatch');
    if (c.kind === 'cascade') {
      const sourceTime = Date.parse(c.inputs?.generatedAt);
      const capturedTime = Date.parse(c.capturedAt);
      if (!Number.isFinite(c.inputs?.triggerPrice) || c.inputs.triggerPrice <= 0
          || !Number.isFinite(sourceTime) || sourceTime > Date.parse(c.decisionTime)
          || sourceTime !== Date.parse(c.decisionTime) || !Number.isFinite(capturedTime)
          || capturedTime < sourceTime || capturedTime - sourceTime > 12 * 60000) errors.push('cascade source availability');
    }
    if (c.direction * (c.targetPrice - c.entryPrice) <= 0) errors.push('target on wrong side');
    if (c.direction * (c.entryPrice - c.stopPrice) <= 0) errors.push('stop on wrong side');
    if (c.inputsHash !== sha256(c.inputs ?? null)) errors.push('inputsHash');
    const { contentHash, ...rest } = c;
    if (contentHash !== sha256(rest)) errors.push('contentHash');
  }
  return errors;
}
