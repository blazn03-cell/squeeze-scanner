const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const LIFECYCLE = [
  'DORMANT',
  'WATCH',
  'ARMED',
  'GET_READY',
  'TRIGGERED',
  'CASCADE_ACTIVE',
  'INVALIDATED',
];

const CONFIRMATION_KEYS = [
  'priceStructure',
  'vwapOpeningRangeAcceptance',
  'weightedLeadership',
  'semiconductors',
  'breadth',
  'treasuryYields',
  'vixVxn',
  'nqFutures',
  'catalystVerification',
  'optionsFlow',
  'dealerGex',
];

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

function directionLabel(score) {
  if (!Number.isFinite(score) || Math.abs(score) < 20) return 'NEUTRAL';
  return score > 0 ? 'BULLISH' : 'BEARISH';
}

function expansionRegime(r) {
  const atr = Number.isFinite(r?.atrPct) ? r.atrPct : 0;
  const rvol = Number.isFinite(r?.relVol) ? r.relVol : 0;
  const firing = r?.sqzState === 'FIRING';
  if ((atr >= 3 && rvol >= 2) || (firing && rvol >= 2.5)) return 'EXTREME_EXPANSION_REGIME';
  if (atr >= 2 || rvol >= 1.75 || firing) return 'EXPANSION_REGIME';
  if (atr >= 1.2 || rvol >= 1.25 || r?.sqzState === 'ACTIVE') return 'EXPANSION_WATCH';
  return 'NORMAL_VOLATILITY';
}

function expansionTier(absMove) {
  if (!Number.isFinite(absMove)) return null;
  if (absMove >= 15) return 'TIER_3';
  if (absMove >= 8) return 'TIER_2';
  if (absMove >= 5) return 'TIER_1';
  return null;
}

function normalizeConfirmation(value) {
  if (value === true) return { status: 'CONFIRMED', confirmed: true, available: true };
  if (value === false) return { status: 'FAILED', confirmed: false, available: true };
  if (typeof value === 'string') {
    const upper = value.toUpperCase();
    if (upper === 'CONFIRMED' || upper === 'BULLISH' || upper === 'BEARISH') {
      return { status: upper, confirmed: true, available: true };
    }
    if (upper === 'FAILED' || upper === 'CONFLICTING') {
      return { status: upper, confirmed: false, available: true };
    }
    if (upper.includes('DELAY')) return { status: upper, confirmed: null, available: true };
    if (upper.includes('MODEL')) return { status: upper, confirmed: null, available: true };
  }
  return { status: 'UNAVAILABLE', confirmed: null, available: false };
}

function buildConfirmations(liveInputs = {}) {
  const confirmations = {};
  let available = 0;
  let confirmed = 0;
  let failed = 0;

  for (const key of CONFIRMATION_KEYS) {
    const normalized = normalizeConfirmation(liveInputs[key]);
    confirmations[key] = normalized;
    if (normalized.available) available += 1;
    if (normalized.confirmed === true) confirmed += 1;
    if (normalized.confirmed === false) failed += 1;
  }

  return {
    items: confirmations,
    available,
    confirmed,
    failed,
    total: CONFIRMATION_KEYS.length,
    confirmationRatio: available ? confirmed / available : 0,
  };
}

function deriveLifecycle({ pressureBuild, direction, confirmations, liveInputs }) {
  const watch = Number.isFinite(pressureBuild) && pressureBuild >= 55 && direction !== 'NEUTRAL';
  if (!watch) return 'DORMANT';

  // With no synchronized cross-market/event inputs, production must never pretend
  // it has an entry-quality signal. Technical data alone can only create WATCH.
  if (confirmations.available < 3) return 'WATCH';

  const ratio = confirmations.confirmationRatio;
  const explicitTrigger = liveInputs?.triggerAccepted === true;
  const explicitInvalidation = liveInputs?.invalidated === true;
  const persistent = liveInputs?.persistenceConfirmed === true;

  if (explicitInvalidation) return 'INVALIDATED';
  if (explicitTrigger && persistent && confirmations.available >= 7 && ratio >= 0.75 && confirmations.failed <= 1) {
    return 'CASCADE_ACTIVE';
  }
  if (explicitTrigger && confirmations.available >= 6 && ratio >= 0.67 && confirmations.failed <= 2) {
    return 'TRIGGERED';
  }
  if (confirmations.available >= 5 && ratio >= 0.60 && confirmations.failed <= 2) return 'GET_READY';
  if (confirmations.available >= 3 && ratio >= 0.50) return 'ARMED';
  return 'WATCH';
}

function inferDataStatus(qqq, liveInputs = {}) {
  const timestamp = liveInputs.timestamp || qqq?.scannedAt || null;
  return {
    price: {
      status: qqq?.price != null ? 'AVAILABLE' : 'UNAVAILABLE',
      source: 'Twelve Data scanner feed',
      timestamp,
      latency: liveInputs.priceLatency || 'PROVIDER_DEPENDENT',
    },
    technicals: {
      status: qqq ? 'AVAILABLE' : 'UNAVAILABLE',
      source: 'APEX V4 scanner',
      timestamp,
      latency: 'SCAN_CYCLE',
    },
    optionsFlow: {
      status: liveInputs.optionsFlow ? 'SUPPLEMENTAL' : 'UNAVAILABLE',
      source: liveInputs.optionsFlowSource || null,
      timestamp: liveInputs.optionsFlowTimestamp || null,
      latency: liveInputs.optionsFlowLatency || null,
    },
    dealerGex: {
      status: liveInputs.dealerGex ? 'MODEL_ESTIMATE' : 'UNAVAILABLE',
      source: liveInputs.dealerGexSource || null,
      timestamp: liveInputs.dealerGexTimestamp || null,
      latency: liveInputs.dealerGexLatency || null,
    },
  };
}

export function buildQqqCascadeSnapshot(qqq, liveInputs = {}) {
  const pressureBuild = technicalPressureProxy(qqq);
  const directionScoreValue = directionScore(qqq);
  const direction = directionLabel(directionScoreValue);
  const dataConfidence = Number.isFinite(qqq?.confidence) ? qqq.confidence : null;
  const confirmations = buildConfirmations(liveInputs);
  const state = deriveLifecycle({ pressureBuild, direction, confirmations, liveInputs });
  const regime = expansionRegime(qqq);

  const triggerPrice = Number.isFinite(liveInputs.triggerPrice) ? liveInputs.triggerPrice : null;
  const currentPrice = Number.isFinite(qqq?.price) ? qqq.price : null;
  const moveFromTrigger = triggerPrice != null && currentPrice != null ? currentPrice - triggerPrice : null;
  const tier = expansionTier(moveFromTrigger == null ? null : Math.abs(moveFromTrigger));

  return {
    symbol: 'QQQ',
    state,
    direction,
    action: state === 'GET_READY' ? 'GET_READY' : state === 'TRIGGERED' || state === 'CASCADE_ACTIVE' ? 'CONFIRMED_RESEARCH_SIGNAL' : 'WAIT',
    pressureBuild,
    directionScore: directionScoreValue,
    cascadeProbability: null,
    continuationProbability: null,
    contractQuality: null,
    rollScore: null,
    dataConfidence,
    expansionRegime: regime,
    expansion: {
      tier,
      moveFromTrigger,
      tierDefinitions: {
        TIER_1: '$5-$8 QQQ expansion',
        TIER_2: '$8-$12+ QQQ expansion',
        TIER_3: '$15-$20+ QQQ expansion',
      },
      note: 'Tier is descriptive after movement occurs; it is not a promise or forecast.',
    },
    event: {
      catalyst: liveInputs.catalyst || null,
      triggerPrice,
      invalidationPrice: Number.isFinite(liveInputs.invalidationPrice) ? liveInputs.invalidationPrice : null,
      nextLevels: Array.isArray(liveInputs.nextLevels) ? liveInputs.nextLevels : [],
      triggerAccepted: liveInputs.triggerAccepted === true,
      persistenceConfirmed: liveInputs.persistenceConfirmed === true,
    },
    confirmations,
    technical: qqq ?? null,
    dataStatus: inferDataStatus(qqq, liveInputs),
    requiredForUpgrade: Object.fromEntries(
      Object.entries(confirmations.items).map(([key, value]) => [key, value.status])
    ),
    rules: {
      lifecycle: LIFECYCLE,
      directionChoices: ['BULLISH','BEARISH','NEUTRAL'],
      noSingleCandleTrigger: true,
      requireRetestOrAcceptance: true,
      requireCrossMarketConfirmation: true,
      researchOnly: true,
      note: 'WATCH/ARMED/GET_READY are pre-confirmation research states. TRIGGERED/CASCADE_ACTIVE require synchronized confirmation inputs; missing data lowers the state rather than being guessed.',
    },
    generatedAt: new Date().toISOString(),
  };
}
