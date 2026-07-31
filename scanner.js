import { scanUniverse } from "./src/jobs/scan-universe.js";

/**
 * Backward-compatible scanner entry point.
 * The v2 MVP uses mocked market data by default and returns separated setup score,
 * confidence, and signal state. Licensed vendor adapters remain disabled until
 * commercial display/redistribution rights are confirmed in writing.
 */
export async function runScan(watchlist) {
  const scan = await scanUniverse({ symbols: watchlist });
  if (scan.failures.length > 0) {
    const details = scan.failures.map((failure) => `${failure.symbol}: ${failure.error}`).join("; ");
    throw new Error(`Scan completed with provider failures: ${details}`);
  }
  return scan.results;
}
