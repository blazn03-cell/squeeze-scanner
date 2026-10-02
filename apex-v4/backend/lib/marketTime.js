// New York session helpers. Daily bars are keyed by NY calendar date; a bar is
// only "completed" once the regular session has closed.

const NY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function nyParts(date) {
  const parts = Object.fromEntries(NY.formatToParts(date).map(p => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

// 16:15 NY gives the provider time to finalize the daily bar.
const SESSION_FINAL_MINUTES = 16 * 60 + 15;

export function isCompletedSession(barDate, now) {
  const { date, minutes } = nyParts(now);
  if (barDate < date) return true;
  return barDate === date && minutes >= SESSION_FINAL_MINUTES;
}

export function isValidDate(d) {
  return d instanceof Date && Number.isFinite(d.getTime());
}
