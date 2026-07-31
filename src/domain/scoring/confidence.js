export function calculateConfidence({ completeness = 1, freshness = 1, sampleSufficiency = 1, providerHealth = 1 }) {
  const factors = [completeness, freshness, sampleSufficiency, providerHealth].map((value) => clamp01(value));
  return Math.round(factors.reduce((product, value) => product * value, 1) * 100);
}

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
