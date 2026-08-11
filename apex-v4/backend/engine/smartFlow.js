// SmartFlow (−100 to +100) — buying/selling pressure PROXY from OHLCV + VWAP.
// NOT real order flow — labeled as proxy in all outputs.
export function calcSmartFlow(ind) {
  if (!ind) return null;
  const { high, low, price: close, vwap: vwapVal, volume, avgVol20 } = ind;
  if (!close || high <= low || high <= 0) return null;

  const closeLoc = (close - low) / (high - low);
  const volRatio = avgVol20 > 0 ? Math.min(volume / avgVol20, 3) : 1;
  const vwapDev  = vwapVal > 0 ? (close - vwapVal) / vwapVal : 0;

  const raw  = (closeLoc * 2 - 1) * volRatio * 50 + vwapDev * 200;
  const flow = Math.max(-100, Math.min(100, raw));

  let band;
  if      (flow > 60)  band = 'STRONG_BUY';
  else if (flow > 25)  band = 'BUY';
  else if (flow > -25) band = 'NEUTRAL';
  else if (flow > -60) band = 'SELL';
  else                 band = 'STRONG_SELL';

  return { flow: +flow.toFixed(1), band, closeLoc: +closeLoc.toFixed(3), volRatio: +volRatio.toFixed(2), vwapDev: +vwapDev.toFixed(4) };
}
