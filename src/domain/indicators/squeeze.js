import { linearRegressionSlope } from "./momentum.js";

function sma(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stddev(values) {
  const mean = sma(values);
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function trueRange(current, previousClose) {
  if (!current) return null;
  const highLow = current.high - current.low;
  const highClose = previousClose == null ? highLow : Math.abs(current.high - previousClose);
  const lowClose = previousClose == null ? highLow : Math.abs(current.low - previousClose);
  return Math.max(highLow, highClose, lowClose);
}

export function calculateSqueezeState(bars, { length = 20, bbMultiplier = 2, kcMultiplier = 1.5, priorStates = [] } = {}) {
  if (!Array.isArray(bars) || bars.length < length + 1) {
    return { state: "INSUFFICIENT_DATA", squeezeOn: false, released: false, momentum: null };
  }

  const window = bars.slice(-length);
  const closes = window.map((bar) => bar.close);
  const typical = window.map((bar) => (bar.high + bar.low + bar.close) / 3);
  const basis = sma(closes);
  const deviation = stddev(closes);
  const upperBb = basis + bbMultiplier * deviation;
  const lowerBb = basis - bbMultiplier * deviation;

  const trValues = window.map((bar, index) => trueRange(bar, index === 0 ? bars[bars.length - length - 1]?.close : window[index - 1]?.close));
  const atr = sma(trValues);
  const kcBasis = sma(typical);
  const upperKc = kcBasis + kcMultiplier * atr;
  const lowerKc = kcBasis - kcMultiplier * atr;

  const squeezeOn = lowerBb > lowerKc && upperBb < upperKc;
  const wasOn = priorStates.slice(-3).some((state) => state === "ON");
  const released = wasOn && !squeezeOn;
  const momentum = linearRegressionSlope(closes);
  const direction = momentum == null ? "FLAT" : momentum > 0 ? "UP" : momentum < 0 ? "DOWN" : "FLAT";

  return {
    state: squeezeOn ? "ON" : released ? "RELEASED" : "OFF",
    squeezeOn,
    released,
    direction,
    momentum,
    bands: { upperBb, lowerBb, upperKc, lowerKc },
  };
}

export function scoreSqueeze(squeeze) {
  if (squeeze?.state === "RELEASED" && squeeze.direction === "UP") return 100;
  if (squeeze?.state === "ON") return 65;
  if (squeeze?.direction === "UP") return 35;
  return 0;
}
