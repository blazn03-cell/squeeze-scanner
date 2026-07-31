export function evaluateAlerts({ scanResult, alertRules = [] }) {
  return alertRules
    .filter((rule) => rule.enabled !== false)
    .filter((rule) => matchesRule(scanResult, rule))
    .map((rule) => ({
      ruleId: rule.id,
      symbol: scanResult.symbol,
      state: scanResult.state,
      score: scanResult.score,
      confidence: scanResult.confidence,
      triggeredAt: new Date().toISOString(),
    }));
}

function matchesRule(result, rule) {
  if (rule.symbol && rule.symbol !== result.symbol) return false;
  if (Number.isFinite(rule.minScore) && result.score < rule.minScore) return false;
  if (Number.isFinite(rule.minConfidence) && result.confidence < rule.minConfidence) return false;
  if (rule.state && rule.state !== result.state) return false;
  return true;
}
