export class MarketDataProvider {
  async getSnapshot(_symbol) {
    throw new Error("MarketDataProvider.getSnapshot must be implemented by a licensed provider adapter");
  }
}
