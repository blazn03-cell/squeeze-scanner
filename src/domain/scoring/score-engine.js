import { calculateDarvasBreakout, scoreBreakoutStructure } from "../indicators/darvas.js";
import { calculateRelativeVolume, scoreRelativeVolume } from "../indicators/relative-volume.js";
import { scoreMomentum } from "../indicators/momentum.js";
import { scoreLiquidity } from "../indicators/liquidity.js";
import { calculateSqueezeState, scoreSqueeze } from "../indicators/squeeze.js";
import { calculateSmartFlowProxy } from "../indicators/smart-flow-proxy.js";
import { calculateConfidence } from "./confidence.js";
import { buildReasonsAndWarnings } from "./explanations.js";

export const SCORE_ENGINE_VERSION = "apex-score-v2.0.0";

const WEIGHTS = {
  relativeVolume: 0.25,
  breakoutStructure: 0.20,
  momentum: 0.15,
  liquidity: 0.15,
  optionsPositioning: 0.15,
  flowConfirmation: 0.10,
};

export function scoreSnapshot(snapshot) {
  const currentBar = snapshot.bars.at(-1);
  const relativeVolume = calculateRelativeVolume({
    currentCumulativeVolume: snapshot.currentCumulativeVolume,
    sessionMinute: snapshot.sessionMinute,
    comparableSessions: snapshot.comparableSessions,
  });
  const darvas = calculateDarvasBreakout(snapshot.bars, snapshot.boxLength ?? 20);
  const squeeze = calculateSqueezeState(snapshot.bars, { priorStates: snapshot.priorSqueezeStates ?? [] });
  const smartFlowProxy = calculateSmartFlowProxy(snapshot.smartFlowInputs ?? {});

  const componentScores = {
    relativeVolume: scoreRelativeVolume(relativeVolume.value),
    breakoutStructure: Math.max(scoreBreakoutStructure(darvas), scoreSqueeze(squeeze)),
    momentum: scoreMomentum({ closes: snapshot.bars.map((bar) => bar.close), currentClose: currentBar?.close }),
    liquidity: scoreLiquidity({ averageDollarVolume: snapshot.averageDollarVolume, minimumDollarVolume: snapshot.minimumDollarVolume }),
    optionsPositioning: scoreOptionsPositioning(snapshot.optionsPositioning),
    flowConfirmation: smartFlowProxy.value,
  };

  const score = Math.round(Object.entries(WEIGHTS).reduce((sum, [key, weight]) => sum + componentScores[key] * weight, 0));
  const confidence = calculateConfidence(snapshot.confidenceInputs ?? {});
  const state = determineSignalState({ score, confidence, darvas, squeeze });
  const { reasons, warnings } = buildReasonsAndWarnings({ snapshot, relativeVolume, darvas, squeeze, smartFlowProxy });

  return {
    symbol: snapshot.symbol,
    asOf: snapshot.marketTimestamp,
    setup: darvas.breakout ? "BULLISH_BREAKOUT" : squeeze.state === "ON" ? "SQUEEZE_WATCH" : "WATCHLIST_SETUP",
    score,
    confidence,
    state,
    componentScores,
    indicators: { relativeVolume, darvas, squeeze, smartFlowProxy },
    reasons,
    warnings,
    metadata: {
      provider: snapshot.provider,
      marketTimestamp: snapshot.marketTimestamp,
      processingTimestamp: new Date().toISOString(),
      indicatorVersion: "apex-indicators-v2.0.0",
      scoreEngineVersion: SCORE_ENGINE_VERSION,
      dataFreshnessSeconds: snapshot.dataFreshnessSeconds,
    },
  };
}

function scoreOptionsPositioning(positioning) {
  if (!positioning?.licensed) return 0;
  if (positioning.strength === "STRONG") return 100;
  if (positioning.strength === "DEVELOPING") return 65;
  return 25;
}

function determineSignalState({ score, confidence, darvas, squeeze }) {
  if (confidence < 40) return "INVALIDATED";
  if (score >= 75 && confidence >= 70 && (darvas.breakout || squeeze.state === "RELEASED")) return "CONFIRMED";
  if (score >= 60) return "DEVELOPING";
  return "WATCHING";
}
