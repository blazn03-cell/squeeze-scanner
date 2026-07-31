export function isMarketScanWindow(date = new Date()) {
  const day = date.getUTCDay();
  if (day === 0 || day === 6) return false;

  const minutesUtc = date.getUTCHours() * 60 + date.getUTCMinutes();
  const marketOpenUtc = 13 * 60 + 30;
  const marketCloseUtc = 20 * 60;
  return minutesUtc >= marketOpenUtc && minutesUtc <= marketCloseUtc;
}
