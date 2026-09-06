import test from 'node:test';
import assert from 'node:assert/strict';
import { computeLowFloatIgnition, rankLowFloatCandidates } from '../lib/low-float-ignition.js';

test('does not fabricate missing float or RVOL inputs', () => {
  const row = computeLowFloatIgnition({ symbol:'TEST', price:4.2 });
  assert.equal(row.metrics.floatShares, null);
  assert.equal(row.metrics.rvol, null);
  assert.equal(row.alertEligible, false);
  assert.ok(row.missing.includes('floatShares'));
});

test('strong verified low-float setup can reach ignition', () => {
  const row = computeLowFloatIgnition({
    symbol:'ABCD', price:6.4, floatShares:4_000_000,
    volume:16_000_000, avgVolume20:1_000_000,
    volume5m:1_200_000, priorVolume5m:300_000,
    changePct:38, change5mPct:4, vwap:5.9, openingRangeHigh:6.1,
    dayHigh:6.6, catalystConfirmed:true, catalystAgeMinutes:30,
    shortInterestPct:25, borrowFeePct:50, spreadPct:0.7,
  });
  assert.equal(row.stage, 'IGNITION');
  assert.equal(row.alertEligible, true);
  assert.ok(row.score >= 70);
});

test('anti-chase gate overrides a high raw score', () => {
  const row = computeLowFloatIgnition({
    symbol:'VERT', price:10, floatShares:3_000_000,
    volume:20_000_000, avgVolume20:1_000_000,
    volume5m:2_000_000, priorVolume5m:200_000,
    changePct:120, change5mPct:15, vwap:7.5, openingRangeHigh:8,
    dayHigh:10.05, catalystConfirmed:true, catalystAgeMinutes:20,
  });
  assert.equal(row.stage, 'EXTENDED');
  assert.equal(row.alertEligible, false);
  assert.ok(row.riskFlags.includes('EXTENDED_DO_NOT_CHASE'));
});

test('offering and dilution risk reduce score', () => {
  const base = {
    symbol:'RISK', price:4, floatShares:8_000_000,
    volume:8_000_000, avgVolume20:1_000_000,
    volume5m:500_000, priorVolume5m:250_000,
    changePct:20, vwap:3.8, openingRangeHigh:3.9,
    catalystConfirmed:true, catalystAgeMinutes:45,
  };
  const clean = computeLowFloatIgnition(base);
  const risky = computeLowFloatIgnition({ ...base, offeringRisk:true, dilutionRisk:true });
  assert.ok(risky.score < clean.score);
});

test('ranking is score descending', () => {
  const rows = rankLowFloatCandidates([
    { symbol:'SLOW', price:5, floatShares:20_000_000, volume:2_000_000, avgVolume20:1_500_000 },
    { symbol:'FAST', price:5, floatShares:5_000_000, volume:10_000_000, avgVolume20:1_000_000, catalystConfirmed:true },
  ]);
  assert.equal(rows[0].symbol, 'FAST');
});
