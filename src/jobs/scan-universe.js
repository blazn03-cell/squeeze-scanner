import { createMarketDataProvider } from "../infrastructure/providers/index.js";
import { scanSymbol } from "./scan-symbol.js";

const DEFAULT_CONCURRENCY = 4;

export async function scanUniverse({ symbols, provider = createMarketDataProvider(), concurrency = DEFAULT_CONCURRENCY } = {}) {
  const queue = [...new Set(symbols || [])];
  const results = [];
  const failures = [];

  async function worker() {
    while (queue.length > 0) {
      const symbol = queue.shift();
      try {
        results.push(await scanSymbol({ symbol, provider }));
      } catch (error) {
        failures.push({ symbol, error: error?.message || String(error) });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length || 1) }, worker));
  return {
    runId: `scan_${Date.now()}`,
    processingTimestamp: new Date().toISOString(),
    provider: process.env.MARKET_DATA_PROVIDER || "mock",
    results: results.sort((a, b) => b.score - a.score),
    failures,
  };
}
