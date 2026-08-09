# ==========================================================================
# BidAskSpread.ts
# ==========================================================================
# PURPOSE      : Live bid/ask spread as a percent of the midpoint — the illiquidity filter.
# AGGREGATION  : Any. Quote data is real-time, not bar-derived.
# INSTALL      : CUSTOM QUOTE ONLY. MarketWatch > Quotes > Customize > Custom Quotes > new > paste. It will NOT compile as a Stock Hacker study filter, because bid and ask are only exposed to the integration/custom-quote context.
# OUTPUT       : Percent. <0.10 excellent · 0.10-0.25 good · 0.25-0.50 acceptable · 0.50-1.00 poor · >1.00 dangerous.
# COLORS       : green excellent · teal good · amber acceptable · orange poor · red dangerous.
# LIMITATIONS  : Returns blank outside market hours and on symbols with no live quote. Crossed or zero quotes are guarded to NaN rather than shown as 0.00%. This value is a snapshot, not an average — it will jitter.
# ==========================================================================

input showAbsolute = no;   # yes = raw ask-bid in dollars, no = percent of midpoint

def b   = bid;
def a   = ask;
def ok  = !IsNaN(a) and !IsNaN(b) and a > 0 and b > 0 and a >= b;
def mid = if ok then (a + b) / 2 else Double.NaN;
def spreadAbs = if ok then a - b else Double.NaN;
def spreadPct = if ok and mid > 0 then 100 * spreadAbs / mid else Double.NaN;

plot Spread = if !ok then Double.NaN
              else if showAbsolute then Round(spreadAbs, 3)
              else Round(spreadPct, 3);
Spread.SetDefaultColor(Color.WHITE);
AssignBackgroundColor(
      if IsNaN(spreadPct) then Color.DARK_GRAY
      else if spreadPct > 1.00 then CreateColor(190, 30, 58)
      else if spreadPct > 0.50 then CreateColor(180, 90, 30)
      else if spreadPct > 0.25 then CreateColor(150, 125, 0)
      else if spreadPct > 0.10 then CreateColor(0, 115, 130)
      else CreateColor(0, 175, 95));
