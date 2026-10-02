// Explicit research calendar, supplied by the operator with provenance.
// This validates the declaration; it does not independently certify exchange dates.
export function requiredSessions(calendar, decisionDate, count) {
  if (!calendar || typeof calendar.source !== 'string' || !calendar.source.trim()
      || typeof calendar.version !== 'string' || !calendar.version.trim() || calendar.complete !== true
      || !/^\d{4}-\d{2}-\d{2}$/.test(calendar.from) || !/^\d{4}-\d{2}-\d{2}$/.test(calendar.through)
      || calendar.from > calendar.through
      || !Array.isArray(calendar.sessions) || decisionDate < calendar.from || decisionDate > calendar.through) return null;
  const sessions = calendar.sessions;
  if (sessions.some((s, i) => !s || !/^\d{4}-\d{2}-\d{2}$/.test(s.date)
      || !Number.isFinite(Date.parse(s.date + 'T00:00:00Z'))
      || new Date(s.date + 'T00:00:00Z').toISOString().slice(0, 10) !== s.date
      || !Number.isFinite(Date.parse(s.closeAt)) || s.date < calendar.from || s.date > calendar.through
      || (i && sessions[i - 1].date >= s.date))) return null;
  const selected = sessions.filter(s => s.date > decisionDate).slice(0, count);
  return selected.length === count ? selected : null;
}
