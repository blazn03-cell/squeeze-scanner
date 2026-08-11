# ==========================================================================
# V4_RelStrength.ts
# ==========================================================================
# PURPOSE      : Relative strength vs a benchmark, kept out of the core to control load.
# AGGREGATION  : Daily for swing, 15m intraday. Must match the benchmark's aggregation.
# INSTALL      : MarketWatch > Quotes > Customize > Custom Quotes > new > paste.
# OUTPUT       : Percent. Stock's N-bar return minus the benchmark's N-bar return. Positive = outperforming.
# COLORS       : red underperforming · grey inline · green outperforming.
# LIMITATIONS  : Loading a SECOND SYMBOL is not the same as secondary aggregation and is legal here, but it roughly doubles the per-row cost. On a 1000+ row watchlist expect noticeably slower refresh. This is why relative strength is NOT part of V4_Confirmed's category count.
# ==========================================================================

input benchmark = "SPY";
input rsLength  = 20;

def me   = close;
def bm   = close(symbol = benchmark);
def meOK = !IsNaN(me) and !IsNaN(me[rsLength]) and me[rsLength] > 0;
def bmOK = !IsNaN(bm) and !IsNaN(bm[rsLength]) and bm[rsLength] > 0;

def meRet = if meOK then 100 * (me / me[rsLength] - 1) else Double.NaN;
def bmRet = if bmOK then 100 * (bm / bm[rsLength] - 1) else Double.NaN;

plot RelStrength = if IsNaN(meRet) or IsNaN(bmRet) then Double.NaN
                   else Round(meRet - bmRet, 2);
RelStrength.SetDefaultColor(Color.WHITE);
AssignBackgroundColor(
      if IsNaN(RelStrength) then Color.DARK_GRAY
      else if RelStrength >= 10 then CreateColor(0, 180, 95)
      else if RelStrength >= 3 then CreateColor(0, 120, 78)
      else if RelStrength <= -10 then CreateColor(190, 30, 58)
      else if RelStrength <= -3 then CreateColor(130, 40, 55)
      else CreateColor(35, 42, 52));
