// Earnings proximity risk (0–3). Real dates from /earnings endpoint.
export function calcEarningsRisk(earningsData, today = new Date()) {
  const rows = earningsData?.earnings;
  if (!Array.isArray(rows) || !rows.length) {
    return { risk: 0, label: 'CLEAR', daysToEarnings: null, date: null };
  }
  const upcoming = rows
    .map(e => ({ ...e, _date: new Date(e.date || e.report_date) }))
    .filter(e => !isNaN(e._date) && e._date > today)
    .sort((a, b) => a._date - b._date);
  if (!upcoming.length) return { risk: 0, label: 'CLEAR', daysToEarnings: null, date: null };
  const next = upcoming[0];
  const days = Math.ceil((next._date - today) / 86400000);
  if (days <= 7)  return { risk: 3, label: 'DANGER',  daysToEarnings: days, date: next._date.toISOString().slice(0, 10) };
  if (days <= 14) return { risk: 2, label: 'CAUTION', daysToEarnings: days, date: next._date.toISOString().slice(0, 10) };
  if (days <= 30) return { risk: 1, label: 'WATCH',   daysToEarnings: days, date: next._date.toISOString().slice(0, 10) };
  return              { risk: 0, label: 'CLEAR',   daysToEarnings: days, date: next._date.toISOString().slice(0, 10) };
}
