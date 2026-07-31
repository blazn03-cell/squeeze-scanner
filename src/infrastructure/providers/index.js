import { MockMarketDataProvider } from "./mock-market-data-provider.js";
import { MassiveProvider } from "./massive-provider.js";
import { FlashAlphaProvider } from "./flashalpha-provider.js";

export function createMarketDataProvider(name = process.env.MARKET_DATA_PROVIDER || "mock") {
  switch (name) {
    case "mock":
      return new MockMarketDataProvider();
    case "massive":
      return new MassiveProvider();
    case "flashalpha":
      return new FlashAlphaProvider();
    default:
      throw new Error(`Unknown market data provider: ${name}`);
  }
}
