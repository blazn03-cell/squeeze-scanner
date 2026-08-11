// Daily OHLCV bars for the scoring engine.
//
// Why this exists: the scoring engine (computeV4) is pure math over candles, and
// it always worked — it just had nowhere to get candles from without the visitor
// supplying a paid Unusual Whales key. A static page cannot hold a data key,
// because anything shipped to the browser is readable by anyone who views source.
// So the key lives here, server-side, and the browser calls this endpoint.
//
// Provider-agnostic on purpose. Set exactly one of the environment variables
// below and this works; no code change is needed to switch provider later, and
// nothing in the repo is bound to one vendor's pricing.
//
//   ALPACA_API_KEY_ID + ALPACA_API_SECRET_KEY     multi-symbol bars
//   TWELVEDATA_API_KEY    twelvedata.com          800 credits/day free
//   POLYGON_API_KEY       polygon.io              5 req/min free
//   TIINGO_API_KEY        tiingo.com              1000 req/day free
//   ALPHAVANTAGE_API_KEY  alphavantage.co         25 req/day free    ← too small for real use
//
// Contract: on success  { ok:true, provider, bars:{ SYM:[{t,o,h,l,c,v}, …] }, … }
//           on failure  { ok:false, reason }  — never a fabricated or partial-looking
//           success. A symbol that could not be fetched is listed in `failed`, so the
//           UI can say "no data" instead of quietly showing fewer rows than expected.

const DAYS = 400;                 // ~260 trading days; computeV4 needs 60 minimum
const MAX_SYMBOLS = 40;           // hard cap per request, protects the rate limit
const CACHE_TTL_MS = 15 * 60_000; // daily bars change once a day; 15 min is generous

// A default universe of liquid, optionable names. Deliberately boring — these are
// the symbols where the liquidity gate passes and the scores mean something.
const DEFAULT_UNIVERSE = [
  "SPY","QQQ","IWM","DIA",
  "AAPL","MSFT","NVDA","AMZN","GOOGL","META","TSLA","AMD","AVGO","NFLX",
  "JPM","BAC","XOM","CVX","UNH","LLY","COST","WMT","HD","DIS",
  "SMCI","PLTR","COIN","MARA","SOFI","RIVN","INTC","MU","CRM","UBER",
];

// Warm-instance cache. Serverless containers are reused between requests, so this
// absorbs most of the traffic. It is a bonus, not a guarantee — the Cache-Control
// header below is what actually protects the provider's rate limit.
const cache = new Map();
const fresh = k => { const e = cache.get(k); return e && Date.now() - e.at < CACHE_TTL_MS ? e.bars : null; };

const iso = d => new Date(d).toISOString().slice(0, 10);
const num = v => { const n = +v; return Number.isFinite(n) ? n : null; };

// Every adapter returns bars OLDEST-FIRST as { t, o, h, l, c, v }, or throws.
// A bar with a non-finite OHLC is dropped rather than zero-filled: a zero close
// would silently poison ATR and every score derived from it.
function clean(rows) {
  const out = [];
  for (const r of rows) {
    const o = num(r.o), h = num(r.h), l = num(r.l), c = num(r.c);
    if (o === null || h === null || l === null || c === null) continue;
    if (h <= 0 || l <= 0 || c <= 0 || h < l) continue;
    out.push({ t: r.t, o, h, l, c, v: num(r.v) ?? 0 });
  }
  return out.sort((a, b) => new Date(a.t) - new Date(b.t));
}

const ADAPTERS = {
  alpaca: {
    env: "ALPACA_API_KEY_ID",
    secretEnv: "ALPACA_API_SECRET_KEY",
    windowDefault: 200,
    batch: 200,
    async fetch(symbols, key, secret) {
      const from = iso(Date.now() - DAYS * 864e5);
      const feed = process.env.ALPACA_DATA_FEED || "iex";
      const url = `https://data.alpaca.markets/v2/stocks/bars?symbols=${symbols.join(",")}`
                + `&timeframe=1Day&start=${from}&limit=10000&adjustment=all&feed=${feed}`;
      const r = await fetch(url, {
        headers: {
          "APCA-API-KEY-ID": key,
          "APCA-API-SECRET-KEY": secret,
        },
      });
      if (!r.ok) throw new Error(`alpaca http ${r.status}`);
      const j = await r.json();
      const out = {};
      for (const s of symbols) {
        const vals = j.bars?.[s];
        if (!Array.isArray(vals)) continue;
        out[s] = clean(vals.map(b => ({ t:b.t, o:b.o, h:b.h, l:b.l, c:b.c, v:b.v })));
      }
      return out;
    },
  },

  twelvedata: {
    env: "TWELVEDATA_API_KEY",
    windowEnv: "TWELVEDATA_CREDITS_PER_MINUTE",
    windowDefault: 8,
    // Twelve Data accepts a comma-separated symbol list in one call. Batching
    // reduces network round trips, but provider credits are still counted per symbol.
    batch: 8,
    async fetch(symbols, key) {
      const url = `https://api.twelvedata.com/time_series?symbol=${symbols.join(",")}`
                + `&interval=1day&outputsize=${DAYS}&apikey=${key}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(`twelvedata http ${r.status}`);
      const j = await r.json();
      if (j.status === "error") throw new Error(j.message || "twelvedata error");
      // One symbol returns the series directly; several return an object keyed by symbol.
      const per = symbols.length === 1 ? { [symbols[0]]: j } : j;
      const out = {};
      for (const s of symbols) {
        const vals = per[s]?.values;
        if (!Array.isArray(vals)) continue;
        out[s] = clean(vals.map(b => ({ t:b.datetime, o:b.open, h:b.high, l:b.low, c:b.close, v:b.volume })));
      }
      return out;
    },
  },

  polygon: {
    env: "POLYGON_API_KEY",
    windowEnv: "POLYGON_SYMBOLS_PER_MINUTE",
    windowDefault: 5,
    batch: 1,
    async fetch(symbols, key) {
      const to = iso(Date.now()), from = iso(Date.now() - DAYS * 864e5);
      const out = {};
      for (const s of symbols) {
        const r = await fetch(`https://api.polygon.io/v2/aggs/ticker/${s}/range/1/day/${from}/${to}`
                            + `?adjusted=true&sort=asc&limit=50000&apiKey=${key}`);
        if (!r.ok) continue;
        const j = await r.json();
        if (!Array.isArray(j.results)) continue;
        out[s] = clean(j.results.map(b => ({ t:new Date(b.t).toISOString(), o:b.o, h:b.h, l:b.l, c:b.c, v:b.v })));
      }
      return out;
    },
  },

  tiingo: {
    env: "TIINGO_API_KEY",
    windowDefault: 40,
    batch: 1,
    async fetch(symbols, key) {
      const from = iso(Date.now() - DAYS * 864e5);
      const out = {};
      for (const s of symbols) {
        const r = await fetch(`https://api.tiingo.com/tiingo/daily/${s}/prices?startDate=${from}&token=${key}`);
        if (!r.ok) continue;
        const j = await r.json();
        if (!Array.isArray(j)) continue;
        out[s] = clean(j.map(b => ({ t:b.date, o:b.open, h:b.high, l:b.low, c:b.close, v:b.volume })));
      }
      return out;
    },
  },

  alphavantage: {
    env: "ALPHAVANTAGE_API_KEY",
    windowEnv: "ALPHAVANTAGE_SYMBOLS_PER_MINUTE",
    windowDefault: 1,
    batch: 1,
    async fetch(symbols, key) {
      const out = {};
      for (const s of symbols) {
        const r = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY`
                            + `&symbol=${s}&outputsize=full&apikey=${key}`);
        if (!r.ok) continue;
        const j = await r.json();
        const series = j["Time Series (Daily)"];
        if (!series) continue;   // also the shape of their rate-limit response
        out[s] = clean(Object.entries(series).slice(0, DAYS).map(([d, b]) => ({
          t:d, o:b["1. open"], h:b["2. high"], l:b["3. low"], c:b["4. close"], v:b["5. volume"],
        })));
      }
      return out;
    },
  },
};

function activeProvider() {
  for (const [name, a] of Object.entries(ADAPTERS)) {
    const key = process.env[a.env];
    const secret = a.secretEnv ? process.env[a.secretEnv] : null;
    if (key && (!a.secretEnv || secret)) return { name, adapter: a, key, secret };
  }
  return null;
}

const chunk = (arr, n) => { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o; };
const boundedInt = (raw, fallback, max, min = 1) => {
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
};

function selectProviderWindow(provider, symbols, rawCursor) {
  const adapter = provider.adapter;
  const windowSize = boundedInt(
    adapter.windowEnv ? process.env[adapter.windowEnv] : null,
    adapter.windowDefault || symbols.length,
    MAX_SYMBOLS,
  );
  if (symbols.length <= windowSize) {
    return { selected:symbols, deferred:[], cursor:0, nextCursor:null, windowSize };
  }
  const cursor = boundedInt(rawCursor, 0, symbols.length - 1, 0);
  const safeCursor = rawCursor == null || rawCursor === "" ? 0 : cursor;
  const selected = symbols.slice(safeCursor, safeCursor + windowSize);
  const nextCursor = safeCursor + selected.length < symbols.length ? safeCursor + selected.length : null;
  const selectedSet = new Set(selected);
  return {
    selected,
    deferred: symbols.filter(symbol => !selectedSet.has(symbol)),
    cursor: safeCursor,
    nextCursor,
    windowSize,
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600");

  const provider = activeProvider();
  if (!provider) {
    // Deliberately a 200 with ok:false. This is a configuration state, not a server
    // fault, and the UI needs to render the "set one env var" message rather than
    // an error page.
    return res.status(200).json({
      ok: false,
      reason: "NO_PROVIDER_CONFIGURED",
      message: "No market-data key is set on the server. Set exactly one of these "
             + "environment variables in the hosting project and redeploy.",
      accepts: Object.values(ADAPTERS).map(a => a.secretEnv ? `${a.env} + ${a.secretEnv}` : a.env),
      universe: DEFAULT_UNIVERSE,
    });
  }

  const asked = String(req.query?.symbols || "").trim();
  const symbols = (asked ? asked.split(",") : DEFAULT_UNIVERSE)
    .map(s => s.trim().toUpperCase())
    .filter(s => /^[A-Z][A-Z.\-]{0,6}$/.test(s))   // reject anything that is not a ticker
    .filter((s, i, a) => a.indexOf(s) === i)
    .slice(0, MAX_SYMBOLS);

  if (!symbols.length) return res.status(400).json({ ok:false, reason:"NO_VALID_SYMBOLS" });

  const providerWindow = selectProviderWindow(provider, symbols, req.query?.cursor);
  const selectedSymbols = providerWindow.selected;

  const bars = {};
  const need = [];
  for (const s of selectedSymbols) {
    const c = fresh(`${provider.name}:${s}`);
    if (c) bars[s] = c; else need.push(s);
  }

  let providerError = null;
  if (need.length) {
    try {
      for (const group of chunk(need, provider.adapter.batch)) {
        const got = await provider.adapter.fetch(group, provider.key, provider.secret);
        for (const [s, rows] of Object.entries(got)) {
          if (!rows?.length) continue;
          bars[s] = rows;
          cache.set(`${provider.name}:${s}`, { at: Date.now(), bars: rows });
        }
      }
    } catch (e) {
      providerError = String(e.message || e);
    }
  }

  const returned = Object.keys(bars);
  const failed = selectedSymbols.filter(s => !bars[s]);

  // Nothing at all came back: report the failure rather than a successful-looking
  // empty payload the UI would render as "no setups today".
  if (!returned.length) {
    return res.status(200).json({
      ok: false,
      reason: providerError ? "PROVIDER_ERROR" : "NO_DATA",
      message: providerError || "The data provider returned no bars for any requested symbol.",
      provider: provider.name,
      requested: symbols.length,
      attempted: selectedSymbols.length,
      symbols: selectedSymbols,
      universe: symbols,
      deferred: providerWindow.deferred,
      cursor: providerWindow.cursor,
      nextCursor: providerWindow.nextCursor,
      windowSize: providerWindow.windowSize,
    });
  }

  return res.status(200).json({
    ok: true,
    provider: provider.name,
    asOf: new Date().toISOString(),
    requested: symbols.length,
    attempted: selectedSymbols.length,
    returned: returned.length,
    failed,                                  // named, so partial coverage is visible
    universe: symbols,
    deferred: providerWindow.deferred,
    cursor: providerWindow.cursor,
    nextCursor: providerWindow.nextCursor,
    windowSize: providerWindow.windowSize,
    coverageComplete: providerWindow.deferred.length === 0 && failed.length === 0,
    note: providerError ? `Partial: ${providerError}` : undefined,
    bars,
  });
}

export { DEFAULT_UNIVERSE, ADAPTERS, clean as _clean, selectProviderWindow as _selectProviderWindow };
