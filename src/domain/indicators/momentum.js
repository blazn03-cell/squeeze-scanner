export function linearRegressionSlope(values) {
  const samples = (values || []).filter(Number.isFinite);
  const n = samples.length;
  if (n < 2) return null;

  const meanX = (n - 1) / 2;
  const meanY = samples.reduce((sum, value) => sum + value, 0) / n;
  let numerator = 0;
  let denominator = 0;
  for (let x = 0; x < n; x++) {
    numerator += (x - meanX) * (samples[x] - meanY);
    denominator += (x - meanX) ** 2;
  }
  return denominator === 0 ? null : numerator / denominator;
}

export function scoreMomentum({ closes, currentClose }) {
  const slope = linearRegressionSlope(closes);
  if (!Number.isFinite(slope) || !Number.isFinite(currentClose) || currentClose <= 0) return 0;
  const normalizedSlope = slope / currentClose;
  if (normalizedSlope >= 0.006) return 100;
  if (normalizedSlope >= 0.003) return 75;
  if (normalizedSlope > 0) return 50;
  return 10;
}
