import { MarketDataProvider } from "./market-data-provider.js";

export class MockMarketDataProvider extends MarketDataProvider {
  constructor({ asOf = new Date("2026-07-31T14:42:00Z") } = {}) {
    super();
    this.asOf = asOf;
  }

  async getSnapshot(symbol) {
    const seed = symbol.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const base = 80 + (seed % 70);
    const bars = buildBars(base);
    const currentCumulativeVolume = 2_700_000 + seed * 1_000;
    const comparableSessions = Array.from({ length: 20 }, (_, index) => ({
      cumulativeVolumeByMinute: { 72: 920_000 + index * 8_000 + (seed % 10) * 2_000 },
    }));

    return {
      symbol,
      provider: "mock",
      marketTimestamp: this.asOf.toISOString(),
      dataFreshnessSeconds: 45,
      sessionMinute: 72,
      currentCumulativeVolume,
      comparableSessions,
      bars,
      priorSqueezeStates: ["OFF", "ON", "ON"],
      averageDollarVolume: 125_000_000 + seed * 100_000,
      minimumDollarVolume: 20_000_000,
      optionsPositioning: { licensed: false },
      confidenceInputs: {
        completeness: 0.95,
        freshness: 0.98,
        sampleSufficiency: 1,
        providerHealth: 0.99,
      },
      smartFlowInputs: {
        relativeVolume: currentCumulativeVolume / 1_000_000,
        closingLocationValue: 0.82,
        moneyFlowIndex: 67,
        vwapPosition: 0.74,
        candleSpreadPct: 0.018,
        priceImpactPerVolume: 0.62,
        persistenceBars: 4,
      },
    };
  }
}

function buildBars(base) {
  const bars = [];
  for (let index = 0; index < 21; index++) {
    const close = base + index * 0.22;
    bars.push({
      high: close + 0.35,
      low: close - 0.45,
      close,
      volume: 100_000 + index * 2_500,
    });
  }
  const previousTop = Math.max(...bars.slice(0, 20).map((bar) => bar.high));
  bars[20] = {
    high: previousTop + 1.15,
    low: previousTop - 0.65,
    close: previousTop + 0.72,
    volume: 350_000,
  };
  return bars;
}
