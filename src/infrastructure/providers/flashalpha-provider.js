import { MarketDataProvider } from "./market-data-provider.js";

export class FlashAlphaProvider extends MarketDataProvider {
  async getSnapshot() {
    throw new Error("FlashAlpha adapter is disabled until written commercial display and redistribution rights are confirmed.");
  }
}
