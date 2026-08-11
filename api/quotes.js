// Current two-sided stock quotes for the execution-quality gate.
//
// Historical candles can estimate turnover, but they cannot prove that a stock
// has a tight spread right now. This route uses a quote-capable provider and
// returns a common shape without exposing provider credentials to the browser.

const MAX_SYMBOLS = 50;
const CACHE_TTL_MS = 15_000;
const cache = new Map();

const parseSymbols = raw => String(raw || "")
  .split(",")
  .map(symbol => symbol.trim().toUpperCase())
  .filter(symbol => /^[A-Z][A-Z.\-]{0,6}$/.test(symbol))
  .filter((symbol, index, all) => all.indexOf(symbol) === index)
  .slice(0, MAX_SYMBOLS);

const numberOrNull = value => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

function timestampToIso(value) {
  if (!value) return null;
  if (typeof value === "string" && !/^\d+$/.test(value)) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
  }
  let number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (number > 1e17) number /= 1e6;
  else if (number > 1e14) number /= 1e3;
  else if (number < 1e11) number *= 1e3;
  return new Date(number).toISOString();
}

function normalizeQuote({ symbol, bid, ask, bidSize, askSize, timestamp, provider, feed, nbbo }) {
  const normalizedBid = numberOrNull(bid);
  const normalizedAsk = numberOrNull(ask);
  if (normalizedBid === null || normalizedAsk === null || normalizedBid <= 0 || normalizedAsk < normalizedBid) {
    return null;
  }
  const midpoint = (normalizedBid + normalizedAsk) / 2;
  const spread = normalizedAsk - normalizedBid;
  const asOf = timestampToIso(timestamp);
  return {
    symbol,
    bid: normalizedBid,
    ask: normalizedAsk,
    bidSize: numberOrNull(bidSize),
    askSize: numberOrNull(askSize),
    midpoint,
    spread,
    spreadPct: midpoint > 0 ? 100 * spread / midpoint : null,
    asOf,
    ageMs: asOf ? Math.max(0, Date.now() - Date.parse(asOf)) : null,
    provider,
    feed,
    nbbo: Boolean(nbbo),
  };
}

function configuredProviders() {
  const providers = [];
  const alpacaKey = process.env.ALPACA_API_KEY_ID;
  const alpacaSecret = process.env.ALPACA_API_SECRET_KEY;
  if (alpacaKey && alpacaSecret) {
    providers.push({
      name:"alpaca",
      key:alpacaKey,
      secret:alpacaSecret,
      feed:process.env.ALPACA_DATA_FEED || "iex",
    });
  }
  const massiveKey = process.env.MASSIVE_API_KEY;
  const polygonKey = process.env.POLYGON_API_KEY;
  if (massiveKey || polygonKey) {
    providers.push({
      name:"massive",
      key:massiveKey || polygonKey,
      base:massiveKey ? "https://api.massive.com" : "https://api.polygon.io",
      feed:"sip",
    });
  }
  if (process.env.TIINGO_API_KEY) {
    providers.push({ name:"tiingo", key:process.env.TIINGO_API_KEY, feed:"iex" });
  }
  return providers;
}

async function fetchAlpaca(provider, symbols) {
  const url = `https://data.alpaca.markets/v2/stocks/quotes/latest?symbols=${symbols.join(",")}`
            + `&feed=${encodeURIComponent(provider.feed)}`;
  const response = await fetch(url, {
    headers: {
      "APCA-API-KEY-ID": provider.key,
      "APCA-API-SECRET-KEY": provider.secret,
    },
  });
  if (!response.ok) throw new Error(`alpaca quotes http ${response.status}`);
  const body = await response.json();
  return symbols.map(symbol => {
    const quote = body.quotes?.[symbol];
    if (!quote) return null;
    return normalizeQuote({
      symbol, bid:quote.bp, ask:quote.ap, bidSize:quote.bs, askSize:quote.as,
      timestamp:quote.t, provider:provider.name, feed:provider.feed,
      nbbo:provider.feed === "sip",
    });
  }).filter(Boolean);
}

async function fetchMassive(provider, symbols) {
  const url = `${provider.base}/v2/snapshot/locale/us/markets/stocks/tickers`
            + `?tickers=${symbols.join(",")}&apiKey=${provider.key}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`massive quotes http ${response.status}`);
  const body = await response.json();
  return (body.tickers || []).map(row => normalizeQuote({
    symbol:row.ticker, bid:row.lastQuote?.p, ask:row.lastQuote?.P,
    bidSize:row.lastQuote?.s, askSize:row.lastQuote?.S,
    timestamp:row.lastQuote?.t, provider:provider.name, feed:provider.feed, nbbo:true,
  })).filter(Boolean);
}

async function fetchTiingo(provider, symbols) {
  const url = `https://api.tiingo.com/iex/?tickers=${symbols.join(",")}&token=${provider.key}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`tiingo quotes http ${response.status}`);
  const body = await response.json();
  return (Array.isArray(body) ? body : []).map(row => normalizeQuote({
    symbol:row.ticker, bid:row.bidPrice, ask:row.askPrice,
    bidSize:row.bidSize, askSize:row.askSize,
    timestamp:row.quoteTimestamp || row.timestamp,
    provider:provider.name, feed:provider.feed, nbbo:false,
  })).filter(Boolean);
}

const FETCHERS = { alpaca:fetchAlpaca, massive:fetchMassive, tiingo:fetchTiingo };

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "public, s-maxage=15, stale-while-revalidate=30");
  const symbols = parseSymbols(req.query?.symbols);
  if (!symbols.length) return res.status(400).json({ ok:false, reason:"NO_VALID_SYMBOLS" });

  const providers = configuredProviders();
  if (!providers.length) {
    return res.status(200).json({
      ok:false,
      reason:"NO_QUOTE_PROVIDER_CONFIGURED",
      message:"Configure Alpaca, Massive/Polygon, or Tiingo credentials for live stock bid/ask quotes.",
      accepts:[
        "ALPACA_API_KEY_ID + ALPACA_API_SECRET_KEY",
        "MASSIVE_API_KEY or POLYGON_API_KEY with quote access",
        "TIINGO_API_KEY",
      ],
    });
  }

  const errors = [];
  for (const provider of providers) {
    const cacheKey = `${provider.name}:${provider.feed}:${symbols.join(",")}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return res.status(200).json(cached.body);
    try {
      const rows = await FETCHERS[provider.name](provider, symbols);
      if (!rows.length) {
        errors.push(`${provider.name}: no two-sided quotes returned`);
        continue;
      }
      const quotes = Object.fromEntries(rows.map(quote => [quote.symbol, quote]));
      const body = {
        ok:true,
        provider:provider.name,
        feed:provider.feed,
        nbbo:rows.every(quote => quote.nbbo),
        asOf:new Date().toISOString(),
        requested:symbols.length,
        returned:rows.length,
        failed:symbols.filter(symbol => !quotes[symbol]),
        quotes,
      };
      cache.set(cacheKey, { at:Date.now(), body });
      return res.status(200).json(body);
    } catch (error) {
      errors.push(`${provider.name}: ${error.message || error}`);
    }
  }

  return res.status(200).json({
    ok:false,
    reason:"QUOTE_PROVIDER_ERROR",
    message:errors.join("; "),
    requested:symbols.length,
  });
}

export { normalizeQuote as _normalizeQuote, parseSymbols as _parseSymbols };
