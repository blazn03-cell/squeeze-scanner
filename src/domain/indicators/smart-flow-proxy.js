/**
 * SmartFlow Proxy estimates demand pressure from price/volume behavior.
 * It is not institutional order-flow data and must not be marketed that way.
 */
export function calculateSmartFlowProxy({ relativeVolume, closingLocationValue, moneyFlowIndex, vwapPosition, candleSpreadPct, priceImpactPerVolume, persistenceBars }) {
  const parts = [
    clampScore((relativeVolume ?? 0) / 3),
    clampScore(closingLocationValue ?? 0),
    clampScore(((moneyFlowIndex ?? 50) - 50) / 50),
    clampScore(vwapPosition ?? 0),
    clampScore((candleSpreadPct ?? 0) / 0.03),
    clampScore(priceImpactPerVolume ?? 0),
    clampScore((persistenceBars ?? 0) / 5),
  ];

  const value = Math.round(parts.reduce((sum, part) => sum + part, 0) / parts.length);
  return {
    value,
    label: value >= 75 ? "STRONG_PROXY_CONFIRMATION" : value >= 55 ? "DEVELOPING_PROXY_CONFIRMATION" : "NO_PROXY_CONFIRMATION",
    disclosure: "SmartFlow Proxy is derived from price and volume behavior, not licensed institutional order-flow data.",
  };
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}
