/**
 * Session-aligned relative volume.
 *
 * Compares current cumulative volume at the current session minute against the
 * average cumulative volume at the same minute over comparable prior sessions.
 * The current session must not be included in the historical average.
 */
export function calculateRelativeVolume({ currentCumulativeVolume, sessionMinute, comparableSessions }) {
  if (!Number.isFinite(currentCumulativeVolume) || currentCumulativeVolume < 0) {
    throw new Error("currentCumulativeVolume must be a non-negative number");
  }
  if (!Number.isInteger(sessionMinute) || sessionMinute < 0) {
    throw new Error("sessionMinute must be a non-negative integer");
  }

  const samples = (comparableSessions || [])
    .map((session) => session?.cumulativeVolumeByMinute?.[sessionMinute])
    .filter((value) => Number.isFinite(value) && value > 0);

  if (samples.length === 0) {
    return { value: null, sampleCount: 0, averageComparableVolume: null };
  }

  const averageComparableVolume = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  return {
    value: currentCumulativeVolume / averageComparableVolume,
    sampleCount: samples.length,
    averageComparableVolume,
  };
}

export function scoreRelativeVolume(relativeVolume) {
  if (!Number.isFinite(relativeVolume)) return 0;
  if (relativeVolume >= 3) return 100;
  if (relativeVolume >= 2) return 80;
  if (relativeVolume >= 1.5) return 60;
  if (relativeVolume >= 1.1) return 35;
  return 10;
}
