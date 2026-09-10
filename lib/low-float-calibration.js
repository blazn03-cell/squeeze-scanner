// Empirical calibration for WallStreetHustler Low-Float Momentum Ignition.
// This module converts forward-record outcomes into a probability only when a
// score bucket has enough observations. It never invents a probability from the
// scanner score itself.

const finite = value => Number.isFinite(Number(value));
const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Number(n) || 0));

export function buildLowFloatCalibration(observations = [], {
  bucketSize = 10,
  minSamples = 30,
  scoreField = 'priorityScore',
  outcomeField = 'outcome',
  outcomeDefinition = null,
} = {}) {
  const size = Math.max(5, Math.min(25, Number(bucketSize) || 10));
  const minimum = Math.max(10, Number(minSamples) || 30);
  const buckets = new Map();

  for (const row of observations) {
    if (!finite(row?.[scoreField]) || typeof row?.[outcomeField] !== 'boolean') continue;
    const score = clamp(row[scoreField]);
    const floor = Math.min(100 - size, Math.floor(score / size) * size);
    const key = `${floor}-${Math.min(100, floor + size - 1)}`;
    const bucket = buckets.get(key) || { key, minScore:floor, maxScore:Math.min(100, floor + size - 1), samples:0, favorable:0 };
    bucket.samples += 1;
    if (row[outcomeField]) bucket.favorable += 1;
    buckets.set(key, bucket);
  }

  const calibrated = [...buckets.values()]
    .sort((a, b) => a.minScore - b.minScore)
    .map(bucket => ({
      ...bucket,
      probabilityPct: bucket.samples >= minimum
        ? Number(((bucket.favorable / bucket.samples) * 100).toFixed(1))
        : null,
      calibrated: bucket.samples >= minimum,
    }));

  return {
    version:'LOW_FLOAT_CALIBRATION_V1',
    scoreField,
    outcomeField,
    outcomeDefinition,
    bucketSize:size,
    minSamples:minimum,
    totalObservations:calibrated.reduce((sum, bucket) => sum + bucket.samples, 0),
    buckets:calibrated,
  };
}

export function applyLowFloatCalibration(result, calibration) {
  if (!result || !calibration || !Array.isArray(calibration.buckets) || !finite(result.priorityScore)) {
    return {
      ...result,
      calibratedProbabilityPct:null,
      probabilityStatus:'UNTRAINED_NOT_A_PROBABILITY',
      probabilitySamples:0,
      probabilityDefinition:calibration?.outcomeDefinition || null,
    };
  }

  const score = clamp(result.priorityScore);
  const bucket = calibration.buckets.find(item => score >= item.minScore && score <= item.maxScore);
  if (!bucket || bucket.probabilityPct == null) {
    return {
      ...result,
      calibratedProbabilityPct:null,
      probabilityStatus:'INSUFFICIENT_FORWARD_SAMPLE',
      probabilitySamples:bucket?.samples || 0,
      probabilityDefinition:calibration.outcomeDefinition || null,
    };
  }

  return {
    ...result,
    calibratedProbabilityPct:bucket.probabilityPct,
    probabilityStatus:'EMPIRICALLY_CALIBRATED',
    probabilitySamples:bucket.samples,
    probabilityDefinition:calibration.outcomeDefinition || null,
  };
}

export function rankWithLowFloatCalibration(results = [], calibration = null) {
  return results
    .map(row => applyLowFloatCalibration(row, calibration))
    .sort((a, b) => {
      const ap = finite(a.calibratedProbabilityPct) ? Number(a.calibratedProbabilityPct) : -1;
      const bp = finite(b.calibratedProbabilityPct) ? Number(b.calibratedProbabilityPct) : -1;
      return bp - ap
        || Number(b.priorityScore || 0) - Number(a.priorityScore || 0)
        || Number(b.proximityScore || 0) - Number(a.proximityScore || 0);
    })
    .map((row, index) => ({ ...row, calibratedRank:index + 1, calibratedTopPick:index === 0 }));
}
