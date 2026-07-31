import { scoreSnapshot } from "../domain/scoring/score-engine.js";

export async function scanSymbol({ symbol, provider }) {
  if (!symbol) throw new Error("symbol is required");
  if (!provider) throw new Error("provider is required");

  const snapshot = await provider.getSnapshot(symbol);
  return scoreSnapshot(snapshot);
}
