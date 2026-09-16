import test from 'node:test';
import assert from 'node:assert/strict';
import { calcLevels, sizeFromRisk } from '../apex-v4/backend/engine/levels.js';

const ind = (price, atr14) => ({ price, atr14 });

test('neutral direction produces no levels', () => {
  assert.equal(calcLevels(ind(22.9, 0.98), 0, {}), null);
});

test('missing or invalid inputs produce no levels', () => {
  assert.equal(calcLevels(null, 1, {}), null);
  assert.equal(calcLevels(ind(0, 1), 1, {}), null);
  assert.equal(calcLevels(ind(20, 0), 1, {}), null);
  assert.equal(calcLevels(ind(20, NaN), 1, {}), null);
});

test('long levels are ordered and target sits at 2R', () => {
  const L = calcLevels(ind(31.62, 1.02), 1, {});
  assert.equal(L.bias, 'LONG');
  assert.ok(L.stop < L.entryLow, 'stop below entry zone');
  assert.ok(L.target > L.entryHigh, 'target above entry zone');
  assert.equal(L.stopBasis, 'ATR');
  // target - entry === 2 * (entry - stop)
  const reward = L.target - L.entryRef;
  const risk   = L.entryRef - L.stop;
  assert.ok(Math.abs(reward - 2 * risk) < 0.02, `2R expected, got ${reward / risk}`);
});

test('short levels mirror long levels', () => {
  const L = calcLevels(ind(33.75, 2.55), -2, {});
  assert.equal(L.bias, 'SHORT');
  assert.ok(L.stop > L.entryHigh, 'stop above entry zone');
  assert.ok(L.target < L.entryLow, 'target below entry zone');
  const reward = L.entryRef - L.target;
  const risk   = L.stop - L.entryRef;
  assert.ok(Math.abs(reward - 2 * risk) < 0.02);
});

test('a nearby box floor tightens a long stop and is labeled STRUCTURE', () => {
  const atrOnly = calcLevels(ind(42.18, 2.02), 2, {});
  const struct  = calcLevels(ind(42.18, 2.02), 2, { boxBot: 39.80 });
  assert.equal(atrOnly.stopBasis, 'ATR');
  assert.equal(struct.stopBasis, 'STRUCTURE');
  assert.ok(struct.stop > atrOnly.stop, 'structure stop should be tighter');
  assert.ok(struct.riskPerShare < atrOnly.riskPerShare);
});

test('a distant box floor is ignored rather than used as a stop', () => {
  const L = calcLevels(ind(42.18, 2.02), 2, { boxBot: 20.00 });
  assert.equal(L.stopBasis, 'ATR');
});

test('a box floor wider than the ATR stop is ignored', () => {
  // Entry ref 41.68, ATR stop 38.65. A floor at 38.00 is within reach but would
  // loosen risk, so the tighter ATR stop must win.
  const L = calcLevels(ind(42.18, 2.02), 2, { boxBot: 38.00 });
  assert.equal(L.stopBasis, 'ATR');
  assert.ok(L.stop > 38.00);
});

test('a box edge on the wrong side of entry is ignored', () => {
  const L = calcLevels(ind(42.18, 2.02), 2, { boxBot: 43.00 });
  assert.equal(L.stopBasis, 'ATR');
});

test('structure stop is padded past the exact box edge', () => {
  const L = calcLevels(ind(42.18, 2.02), 2, { boxBot: 39.80 });
  assert.ok(L.stop < 39.80, 'stop must sit below the box floor, not on it');
});

test('risk percentage is consistent with the level spread', () => {
  const L = calcLevels(ind(186.30, 8.40), 1, { boxBot: 176.00 });
  const expected = ((L.entryRef - L.stop) / L.entryRef) * 100;
  assert.ok(Math.abs(L.riskPct - expected) < 0.02);
});

test('position size floors to whole shares and respects the loss cap', () => {
  const L = calcLevels(ind(31.62, 1.02), 1, {});
  const s = sizeFromRisk(L, 500);
  assert.equal(s.shares, Math.floor(500 / L.riskPerShare));
  assert.ok(s.actualRisk <= 500);
});

test('position size returns zero shares when risk exceeds the cap', () => {
  const L = calcLevels(ind(186.30, 8.40), 1, {});
  assert.equal(sizeFromRisk(L, 5).shares, 0);
});

test('position size rejects missing levels or a non-positive cap', () => {
  assert.equal(sizeFromRisk(null, 500), null);
  assert.equal(sizeFromRisk(calcLevels(ind(31.62, 1.02), 1, {}), 0), null);
});
