// Full scan orchestrator for a single symbol.
import { parseBars, buildIndicators } from './indicators.js';
import { calcAtrPct }      from './atrPct.js';
import { calcDarvas }      from './darvas.js';
import { calcRelVol }      from './relVol.js';
import { calcSqueezeHit }  from './squeezeHit.js';
import { calcSmartFlow }   from './smartFlow.js';
import { calcStableScore } from './stableScore.js';
import { calcEarlyEntry }  from './earlyEntry.js';
import { calcEarningsRisk } from './earnings.js';
import { calcApexScore, calcDirection, calcConfidence, calcRegime } from './apex.js';
import { normalizeStockQuote } from './quote.js';

export async function scanSymbol(symbol, tdClient, opts = {}) {
  const { withEarnings = false } = opts;

  const [dailyRaw, quoteRaw] = await Promise.all([
    tdClient.getTimeSeries(symbol, '1day', 130).catch(() => null),
    tdClient.getQuote(symbol).catch(() => null),
  ]);

  if (!dailyRaw) return null;
  const bars = parseBars(dailyRaw, symbol);
  if (bars.length < 30) return null;

  const ind = buildIndicators(bars);
  if (!ind) return null;

  const q = (Array.isArray(quoteRaw) ? quoteRaw[0] : quoteRaw) ?? {};
  const quote = normalizeStockQuote(q, ind.price);

  const atrPct      = calcAtrPct(ind);
  const relVol      = calcRelVol(ind);
  const darvas      = calcDarvas(ind);
  const squeezeHit  = calcSqueezeHit(ind);
  const smartFlow   = calcSmartFlow(ind);
  const stableScore = calcStableScore(ind, relVol, atrPct);
  const earlyEntry  = calcEarlyEntry(ind, relVol, squeezeHit, darvas);

  let earnings = { risk: 0, label: 'CLEAR', daysToEarnings: null, date: null };
  if (withEarnings) {
    const earningsRaw = await tdClient.getEarnings(symbol).catch(() => null);
    if (earningsRaw) earnings = calcEarningsRisk(earningsRaw);
  }

  const metrics    = { atrPct, stableScore, relVol, squeezeHit, smartFlow, darvas, earlyEntry, earnings, quote };
  const apexScore  = calcApexScore(metrics);
  const direction  = calcDirection(ind, smartFlow, darvas, squeezeHit);
  const confidence = calcConfidence(ind, relVol, smartFlow, darvas, squeezeHit, direction);
  const regimeObj  = calcRegime(ind, atrPct, squeezeHit, darvas);

  return {
    symbol,
    price:        +ind.price.toFixed(2),
    apexScore,    direction, confidence,
    regime:       regimeObj.regime,
    regimeLabel:  regimeObj.label,
    stable:       stableScore?.score ?? null,
    stableBand:   stableScore?.band  ?? null,
    atrPct:       atrPct?.pct        ?? null,
    atrBand:      atrPct?.band       ?? null,
    relVol:       relVol?.rv         ?? null,
    relVolBand:   relVol?.band       ?? null,
    darvasState:  darvas?.state      ?? null,
    darvasBias:   darvas?.bias       ?? null,
    sqzState:     squeezeHit?.state  ?? null,
    sqzPct:       squeezeHit?.pct    ?? null,
    flow:         smartFlow?.flow    ?? null,
    flowBand:     smartFlow?.band    ?? null,
    spreadPct:    quote.spreadPct,
    spreadVerified: quote.spreadVerified,
    earningsRisk: earnings.risk,
    earningsDate: earnings.date,
    earningsDays: earnings.daysToEarnings,
    earlyEntry:   earlyEntry?.score  ?? null,
    earlyBand:    earlyEntry?.band   ?? null,
    earlySignals: earlyEntry?.signals ?? [],
    rsi14:        ind.rsi14 !== null ? +ind.rsi14.toFixed(1) : null,
    adx14:        ind.adx14 !== null ? +ind.adx14.toFixed(1) : null,
    ema9:         ind.ema9  !== null ? +ind.ema9.toFixed(2)  : null,
    ema20:        ind.ema20 !== null ? +ind.ema20.toFixed(2) : null,
    ema50:        ind.ema50 !== null ? +ind.ema50.toFixed(2) : null,
    vwap:         ind.vwap  !== null ? +ind.vwap.toFixed(2)  : null,
    scannedAt:    new Date().toISOString(),
  };
}
