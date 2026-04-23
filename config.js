// Pre-market scanner config.
// Edit WATCHLIST each Sunday night for the upcoming trading week.

export const WATCHLIST = [
  "SPY", "QQQ", "IWM",
];

export const SCAN_PARAMS = {
  minPremium:      100000,
  minDTE:          7,
  dpMinPremium:    5000000,
  dpLookbackDays:  5,
  minScore:        60,
};

export const MODEL = "claude-sonnet-4-5";
export const MAX_TOKENS = 4000;
export const SCAN_TIMEOUT_MS = 30000;
export const MAX_RETRIES = 2;
export const RETRY_BACKOFF_MS = 3000;
