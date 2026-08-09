# ==========================================================================
# V4_LIQUIDITY_SCORE.ts
# ==========================================================================
# PURPOSE      : 0-100 tradeability relative to the scan universe.
# AGGREGATION  : DAILY — the default and the MAXIMUM. 4h for faster 1-3 day trades.
# INSTALL      : MarketWatch > Quotes > Customize > Custom Quotes > new > paste.
# OUTPUT       : 0-100. <35 blocks the score entirely · <50 costs a score gate · 70+ comfortable.
# COLORS       : red poor · amber marginal · teal good · green excellent.
# LIMITATIONS  : This does NOT measure market depth, order-book thickness, or real slippage — ThinkScript charts expose none of those. It is dollar volume (45pts), price level (25), current participation (20) and share turnover (10). For an actual spread reading use BidAskSpread.ts, which works only as a custom quote because bid/ask are exposed nowhere else.
# ==========================================================================

# ---- MODULE: PRICE ---------------------------------------------------------
# signalMode shifts EVERY input series by one bar, so the whole model inherits
# it without a single downstream branch. LIVE reads the forming bar (earlier,
# but the value changes until the bar closes). CLOSED_BAR reads only confirmed
# bars (one bar later, but the number is final once printed).
# LIVE is NOT repaint-proof. Nothing that reads a forming bar can be.
input signalMode = {default LIVE, CLOSED_BAR};
def closedBar = signalMode == signalMode.CLOSED_BAR;
def c = if closedBar then close[1] else close;
def h = if closedBar then high[1] else high;
def l = if closedBar then low[1] else low;
def o = if closedBar then open[1] else open;
def v = if closedBar then volume[1] else volume;

# ---- MODULE: VOLUME / PARTICIPATION / LIQUIDITY -----------------------------
input rvolLength   = 30;
input minDollarVol = 2000000;
def avgVol    = Average(v, rvolLength);
def rvol      = if avgVol <= 0 then Double.NaN else v / avgVol;
def rvolSafe  = if IsNaN(rvol) then 0 else rvol;
def dollarVol = c * avgVol;
def volFast   = Average(v, 5);
def volSlow   = Average(v, 50);
def volTrend  = if volSlow <= 0 then 1 else volFast / volSlow;

# ---- MODULE: LIQUIDITY SCORE 0..100 ----------------------------------------
# Tradeability relative to the scan universe. This does NOT measure market
# depth, order-book thickness, or true slippage — ThinkScript charts expose
# none of those. It is dollar volume, price level, current participation and
# share turnover, which is what IS observable. BidAskSpread.ts is the only
# real spread reading in the set, and it exists only as a custom quote.
def liqDV = if dollarVol >= 200000000 then 45
            else if dollarVol >= 100000000 then 40
            else if dollarVol >= 50000000 then 34
            else if dollarVol >= 25000000 then 28
            else if dollarVol >= 10000000 then 20
            else if dollarVol >= 5000000 then 12
            else if dollarVol >= minDollarVol then 6
            else 0;
def liqPrice = if c >= 10 then 25 else if c >= 5 then 20 else if c >= 2 then 12 else if c >= 1 then 5 else 0;
def liqPart  = if rvolSafe >= 1.5 then 20 else if rvolSafe >= 1.0 then 16 else if rvolSafe >= 0.75 then 10 else 4;
def liqTurn  = if avgVol >= 2000000 then 10 else if avgVol >= 500000 then 7 else if avgVol >= 200000 then 4 else 0;
def liquidityScore = Round(Max(0, Min(100, liqDV + liqPrice + liqPart + liqTurn)), 0);

# ---- SCRIPT BODY -----------------------------------------------------------

plot Liquidity = liquidityScore;
Liquidity.SetDefaultColor(Color.WHITE);
AssignBackgroundColor(
      if liquidityScore >= 80 then CreateColor(0, 180, 95)
      else if liquidityScore >= 65 then CreateColor(0, 125, 85)
      else if liquidityScore >= 50 then CreateColor(0, 110, 130)
      else if liquidityScore >= 35 then CreateColor(150, 125, 0)
      else CreateColor(160, 35, 55));
