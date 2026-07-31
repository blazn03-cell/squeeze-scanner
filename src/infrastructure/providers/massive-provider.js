import { MarketDataProvider } from "./market-data-provider.js";

export class MassiveProvider extends MarketDataProvider {
  async getSnapshot() {
    throw new Error("Massive adapter is disabled until a Business agreement explicitly covers this product's display, redistribution, and derived-signal model.");
  }
}
