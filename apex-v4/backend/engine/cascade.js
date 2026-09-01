const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function technicalPressureProxy(r) {
  if (!r) return null;
  const apex = Number.isFinite(r.apexScore) ? r.apexScore : 0;
  const rvol = Number.isFinite(r.relVol) ? clamp((r.relVol - 0.7) * 35, 0, 35) : 0;
  const squeeze = r.sqzState === 'FIRING' ? 18 : r.sqzState === 'ACTIVE' ? 12 : 0;
  const atr = Number.isFinite(r.atrPct) ? clamp(r.atrPct * 5, 0, 15) : 0;
  return Math.round(clamp(apex * 0.55 + rvol + squeeze + atr, 0, 100));
}

function directionScore(r) {
  if (!r || !Number.isFinite(r.direction)) return null;
  const base = clamp(r.direction, -2, 2) * 35;
  const flow = Number.isFinite(r.flow) ? clamp(r.flow, -100, 100) * 0.2 : 0;
  return Math.round(clamp(base + flow, -100, 100));
}

export function buildQqqCascadeSnapshot(qqq) {
  const pressureBuild = technicalPressureProxy(qqq);
  const direction = directionScore(qqq);
  const dataConfidence = Number.isFinite(qqq?.confidence) ? qqq.confidence : null;

  // APEX Convexity Cascade requires intraday price acceptance, weighted QQQ
  // leadership, semiconductor breadth, macro/volatility, catalyst verification,
  // and options/GEX inputs. The current production feed does not provide those
  // synchronously, so the engine is deliberately capped at WATCH.
  const watch = pressureBuild != null && pressureBuild >= 55;
  const state = watch ? 'WATCH' : 'DORMANT';

  return {
    symbol: 'QQQ',
    state,
    action: 'WAIT',
    pressureBuild,
    directionScore: direction,
    cascadeProbability: null,
    continuationProbability: null,
    contractQuality: null,
    rollScore: null,
    dataConfidence,
    technical: qqq ?? null,
    requiredForUpgrade: {
      priceStructure: 'UNAVAILABLE_INTRADAY',
      vwapOpeningRangeAcceptance: 'UNAVAILABLE_INTRADAY',
      weightedLeadership: 'UNAVAILABLE',
      semiconductors: 'UNAVAILABLE_SYNCHRONIZED',
      breadth: 'UNAVAILABLE',
      treasuryYields: 'UNAVAILABLE',
      vixVxn: 'UNAVAILABLE',
      nqFutures: 'UNAVAILABLE',
      catalystVerification: 'UNAVAILABLE',
      optionsFlow: 'UNAVAILABLE',
      dealerGex: 'UNAVAILABLE',
      contractChain: 'UNAVAILABLE',
    },
    rules: {
      lifecycle: ['DORMANT','WATCH','ARMED','TRIGGERED','CASCADE_ACTIVE','ROLL_ELIGIBLE','EXHAUSTED','INVALIDATED'],
      directionChoices: ['CALL','PUT','WAIT'],
      noAverageDown: true,
      zeroDteV1: false,
      normalHold: '1-3 trading days; Day 4 absolute maximum for the original position',
      note: 'WATCH is a research state, not an options entry. ARMED/TRIGGERED require the missing confirmation layers above.',
    },
    generatedAt: new Date().toISOString(),
  };
}
