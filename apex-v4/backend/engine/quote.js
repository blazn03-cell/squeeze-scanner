const positiveNumberOrNull = value => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

export function normalizeStockQuote(raw = {}, fallbackLast = null) {
  const last = positiveNumberOrNull(raw.close)
    ?? positiveNumberOrNull(raw.price)
    ?? positiveNumberOrNull(fallbackLast);
  const bid = positiveNumberOrNull(raw.bid);
  const ask = positiveNumberOrNull(raw.ask);

  if (bid === null || ask === null || ask < bid) {
    return {
      bid:null,
      ask:null,
      spreadPct:null,
      spreadVerified:false,
      last,
    };
  }

  const midpoint = (bid + ask) / 2;
  return {
    bid,
    ask,
    spreadPct:+(((ask - bid) / midpoint) * 100).toFixed(3),
    spreadVerified:true,
    last,
  };
}
