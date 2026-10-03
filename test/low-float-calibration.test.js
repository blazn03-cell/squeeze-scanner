import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLowFloatCalibration, applyLowFloatCalibration, rankWithLowFloatCalibration } from '../lib/low-float-calibration.js';

test('does not publish probability below minimum sample', () => {
  const observations = Array.from({ length:20 }, (_, i) => ({ priorityScore:82, outcome:i < 15 }));
  const calibration = buildLowFloatCalibration(observations, { minSamples:30, outcomeDefinition:'+10% before -5% within 60 minutes' });
  const row = applyLowFloatCalibration({ symbol:'A', priorityScore:82, proximityScore:90 }, calibration);
  assert.equal(row.calibratedProbabilityPct, null);
  assert.equal(row.probabilityStatus, 'INSUFFICIENT_FORWARD_SAMPLE');
  assert.equal(row.probabilitySamples, 20);
});

test('publishes empirical probability with sufficient forward sample', () => {
  const observations = Array.from({ length:40 }, (_, i) => ({ priorityScore:84, outcome:i < 30 }));
  const calibration = buildLowFloatCalibration(observations, { minSamples:30, outcomeDefinition:'+10% before -5% within 60 minutes' });
  const row = applyLowFloatCalibration({ symbol:'A', priorityScore:84, proximityScore:90 }, calibration);
  assert.equal(row.calibratedProbabilityPct, 75);
  assert.equal(row.probabilityStatus, 'EMPIRICALLY_CALIBRATED');
  assert.equal(row.probabilitySamples, 40);
  assert.equal(row.probabilityDefinition, '+10% before -5% within 60 minutes');
});

test('calibrated probability outranks raw priority only when trained', () => {
  const observations = [
    ...Array.from({ length:30 }, (_, i) => ({ priorityScore:72, outcome:i < 24 })),
    ...Array.from({ length:30 }, (_, i) => ({ priorityScore:92, outcome:i < 15 })),
  ];
  const calibration = buildLowFloatCalibration(observations, { minSamples:30 });
  const ranked = rankWithLowFloatCalibration([
    { symbol:'HIGH_RAW', priorityScore:92, proximityScore:99 },
    { symbol:'BETTER_HISTORY', priorityScore:72, proximityScore:80 },
  ], calibration);
  assert.equal(ranked[0].symbol, 'BETTER_HISTORY');
  assert.equal(ranked[0].calibratedProbabilityPct, 80);
  assert.equal(ranked[0].calibratedTopPick, true);
});
