// APEX Scanner MVP config.
// Mock data is the default until commercial market-data agreements are confirmed.

export const WATCHLIST = (process.env.APEX_SYMBOLS || "NVDA,MSFT,SPY")
  .split(",")
  .map((symbol) => symbol.trim().toUpperCase())
  .filter(Boolean);

export const SCAN_PARAMS = {
  minScore: 60,
  maxConcurrency: Number.parseInt(process.env.APEX_SCAN_CONCURRENCY || "4", 10),
};
