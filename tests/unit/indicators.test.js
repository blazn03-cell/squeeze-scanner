import test from "node:test";
import assert from "node:assert/strict";
import { calculateRelativeVolume } from "../../src/domain/indicators/relative-volume.js";
import { calculateDarvasBreakout } from "../../src/domain/indicators/darvas.js";
import { calculateConfidence } from "../../src/domain/scoring/confidence.js";

test("relative volume compares against same-minute historical sessions only", () => {
  const result = calculateRelativeVolume({
    currentCumulativeVolume: 300,
    sessionMinute: 12,
    comparableSessions: [
      { cumulativeVolumeByMinute: { 12: 100 } },
      { cumulativeVolumeByMinute: { 12: 200 } },
    ],
  });

  assert.equal(result.sampleCount, 2);
  assert.equal(result.averageComparableVolume, 150);
  assert.equal(result.value, 2);
});

test("Darvas breakout excludes the current breakout bar from box top", () => {
  const bars = Array.from({ length: 20 }, (_, index) => ({ high: 100 + index, low: 90, close: 95 }));
  bars.push({ high: 250, low: 100, close: 121 });

  const result = calculateDarvasBreakout(bars, 20);

  assert.equal(result.boxTop, 119);
  assert.equal(result.breakout, true);
});

test("confidence multiplies independent quality factors", () => {
  assert.equal(calculateConfidence({ completeness: 0.9, freshness: 0.8, sampleSufficiency: 1, providerHealth: 0.5 }), 36);
});
