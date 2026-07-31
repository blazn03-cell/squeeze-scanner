/**
 * Darvas breakout using completed bars only.
 * Excludes the current breakout bar from the box-top calculation.
 */
export function calculateDarvasBreakout(bars, boxLength = 20) {
  if (!Array.isArray(bars) || bars.length < boxLength + 1) {
    return { breakout: false, boxTop: null, sampleCount: Array.isArray(bars) ? bars.length : 0 };
  }

  const current = bars[bars.length - 1];
  const historicalBars = bars.slice(-(boxLength + 1), -1);
  const highs = historicalBars.map((bar) => bar.high).filter(Number.isFinite);
  if (highs.length !== boxLength || !Number.isFinite(current?.close)) {
    return { breakout: false, boxTop: null, sampleCount: highs.length };
  }

  const boxTop = Math.max(...highs);
  return {
    breakout: current.close > boxTop,
    boxTop,
    currentClose: current.close,
    sampleCount: highs.length,
  };
}

export function scoreBreakoutStructure(darvas) {
  if (!darvas?.breakout || !Number.isFinite(darvas.boxTop) || !Number.isFinite(darvas.currentClose)) return 0;
  const extension = (darvas.currentClose - darvas.boxTop) / darvas.boxTop;
  if (extension >= 0.03) return 95;
  if (extension >= 0.015) return 80;
  return 65;
}
