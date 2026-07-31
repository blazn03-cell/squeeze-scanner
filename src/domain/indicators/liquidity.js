export function scoreLiquidity({ averageDollarVolume, minimumDollarVolume = 20_000_000 }) {
  if (!Number.isFinite(averageDollarVolume) || averageDollarVolume <= 0) return 0;
  const ratio = averageDollarVolume / minimumDollarVolume;
  if (ratio >= 5) return 100;
  if (ratio >= 2) return 80;
  if (ratio >= 1) return 60;
  return Math.max(0, Math.round(ratio * 60));
}
