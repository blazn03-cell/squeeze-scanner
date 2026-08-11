// Twelve Data REST API client.
// Uses only real, documented endpoints. Key stays server-side only.
// Implements: token-bucket rate limiting, exponential backoff, TTL cache, batch symbols.
import { CreditManager } from './creditManager.js';
import { Cache } from './cache.js';

const BASE = 'https://api.twelvedata.com';

const TTL = {
  DAILY:        60 * 60 * 1000,
  INTRADAY:     5  * 60 * 1000,
  QUOTE:        30 * 1000,
  EARNINGS:     24 * 60 * 60 * 1000,
  MARKET_STATE: 60 * 1000,
};

export class TwelveDataClient {
  constructor(apiKey, creditsPerMinute = 300) {
    this.apiKey  = apiKey;
    this.credits = new CreditManager(creditsPerMinute, 0.8);
    this.cache   = new Cache();
    this._purge  = setInterval(() => this.cache.purgeExpired(), 5 * 60 * 1000);
  }

  async _get(path, params = {}, cost = 1) {
    const url = new URL(BASE + path);
    url.searchParams.set('apikey', this.apiKey);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
    const cacheKey = url.pathname + '?' + url.searchParams.toString();
    const cached   = this.cache.get(cacheKey);
    if (cached !== null) return cached;

    await this.credits.consume(cost);

    let delay = 2000;
    for (let attempt = 0; attempt < 5; attempt++) {
      let res;
      try {
        res = await fetch(url.toString());
      } catch (netErr) {
        if (attempt === 4) throw netErr;
        await new Promise(r => setTimeout(r, delay + Math.random() * 500));
        delay = Math.min(delay * 2, 30000);
        continue;
      }

      if (res.status === 429) {
        const wait = delay + Math.random() * 1000;
        console.warn(`[td] 429 on ${path} — retrying in ${Math.round(wait)}ms (attempt ${attempt + 1})`);
        await new Promise(r => setTimeout(r, wait));
        delay = Math.min(delay * 2, 60000);
        continue;
      }
      if (res.status >= 500) {
        if (attempt === 4) throw new Error(`Server error ${res.status} on ${path}`);
        await new Promise(r => setTimeout(r, delay));
        delay *= 2;
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}`);

      const data = await res.json();
      if (data.status === 'error') throw new Error(data.message || `API error on ${path}`);
      this.cache.set(cacheKey, data, TTL.DAILY);
      return data;
    }
    throw new Error(`Max retries exceeded for ${path}`);
  }

  async _cachedGet(cacheKey, ttl, fetcher) {
    const cached = this.cache.get(cacheKey);
    if (cached !== null) return cached;
    const value = await fetcher();
    this.cache.set(cacheKey, value, ttl);
    return value;
  }

  // OHLCV bars — batch multiple symbols in one call (1 credit per symbol).
  async getTimeSeries(symbols, interval = '1day', outputsize = 130) {
    const sym  = Array.isArray(symbols) ? symbols.join(',') : symbols;
    const cost = sym.split(',').length;
    const key  = `ts|${sym}|${interval}|${outputsize}`;
    const ttl  = interval === '1day' ? TTL.DAILY : TTL.INTRADAY;
    return this._cachedGet(key, ttl, () =>
      this._get('/time_series', { symbol: sym, interval, outputsize, order: 'asc' }, cost)
    );
  }

  // Latest quote with bid/ask for spread calculation.
  // Correct endpoint is /quote (NOT /quotes — that returns 404).
  async getQuote(symbols) {
    const sym  = Array.isArray(symbols) ? symbols.join(',') : symbols;
    const cost = sym.split(',').length;
    const key  = `quote|${sym}`;
    return this._cachedGet(key, TTL.QUOTE, () =>
      this._get('/quote', { symbol: sym }, cost)
    );
  }

  // Earnings dates — real data, no guessing (5 credits per call, cached 24h).
  async getEarnings(symbol) {
    const key = `earn|${symbol}`;
    return this._cachedGet(key, TTL.EARNINGS, () =>
      this._get('/earnings', { symbol, outputsize: 4 }, 5)
    );
  }

  async getMarketState() {
    const key = 'market_state';
    return this._cachedGet(key, TTL.MARKET_STATE, () =>
      this._get('/market_state', {}, 0)
    );
  }

  creditReport()          { return this.credits.report(); }
  estimateScanCost(n)     { return this.credits.estimateScanCost(n); }
  destroy()               { clearInterval(this._purge); }
}
