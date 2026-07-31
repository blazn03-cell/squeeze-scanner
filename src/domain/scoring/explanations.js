export function buildReasonsAndWarnings({ snapshot, relativeVolume, darvas, squeeze, smartFlowProxy }) {
  const reasons = [];
  const warnings = [];

  if (Number.isFinite(relativeVolume.value)) {
    reasons.push(`Relative volume is ${relativeVolume.value.toFixed(1)}× normal for this point in the session`);
  } else {
    warnings.push("Relative-volume comparison has insufficient same-minute historical samples");
  }

  if (darvas.breakout) {
    reasons.push(`Price closed above the previous ${darvas.sampleCount}-bar Darvas high`);
  }

  if (snapshot.averageDollarVolume >= (snapshot.minimumDollarVolume ?? 20_000_000)) {
    reasons.push("Average dollar volume passed the liquidity requirement");
  }

  if (squeeze.state === "RELEASED") {
    reasons.push(`Squeeze released with ${squeeze.direction.toLowerCase()} linear-regression momentum`);
  }

  if (smartFlowProxy.value >= 55) {
    reasons.push(`SmartFlow Proxy shows ${smartFlowProxy.label.toLowerCase().replaceAll("_", " ")}`);
  }

  if (!snapshot.optionsPositioning?.licensed) {
    warnings.push("Options-positioning score is disabled until licensed vendor data is configured");
  }

  if (snapshot.dataFreshnessSeconds > 180) {
    warnings.push(`Market data is ${Math.round(snapshot.dataFreshnessSeconds / 60)} minutes old`);
  }

  warnings.push(smartFlowProxy.disclosure);
  return { reasons, warnings };
}
