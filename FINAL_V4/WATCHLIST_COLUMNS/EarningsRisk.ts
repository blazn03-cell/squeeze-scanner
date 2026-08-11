# ==========================================================================
# EarningsRisk.ts
# ==========================================================================
# PURPOSE      : Warn when a name is near an earnings date.
# AGGREGATION  : DAILY. Earnings events are daily-resolution; do not run this intraday.
# INSTALL      : MarketWatch > Quotes > Customize > Custom Quotes > new > paste. Set the column aggregation to Day.
# OUTPUT       : 0 no near-term risk · 1 approaching (<=10 trading days) · 2 very close (<=3) · 3 today/imminent.
# COLORS       : grey 0 · amber 1 · orange 2 · red 3.
# LIMITATIONS  : READ THIS. ThinkScript exposes earnings through HasEarnings() and GetEventOffset(Events.EARNINGS, ...). Coverage is Schwab's event calendar: it is reliable for liquid US equities and thin-to-absent for ADRs, small caps, and recent listings. Where the calendar has no FUTURE event, this script falls back to counting bars since the LAST confirmed earnings and flagging the usual ~63-trading-day window — that fallback is an ESTIMATE and is reported as level 1 at most, never 2 or 3. Nothing here invents a date. Verify against the Company Profile tab before sizing a position.
# ==========================================================================

input approachBars = 10;   # trading days that count as "approaching"
input closeBars    = 3;    # trading days that count as "very close"
input cycleBars    = 63;   # typical trading days between reports (fallback only)

# --- primary path: the calendar knows the next event -------------------------
def nextOffset = GetEventOffset(Events.EARNINGS, 0);
def hasNext    = !IsNaN(nextOffset) and nextOffset < 0;   # negative = bars ahead
def barsToNext = if hasNext then -nextOffset else Double.NaN;
def isToday    = HasEarnings();

# --- fallback path: estimate from the last confirmed report ------------------
def barsSinceLast = CompoundValue(1, if HasEarnings() then 0 else barsSinceLast[1] + 1, Double.NaN);
def estDue = !IsNaN(barsSinceLast) and barsSinceLast >= cycleBars - approachBars
             and barsSinceLast <= cycleBars + approachBars;

def risk = if isToday then 3
           else if hasNext and barsToNext <= closeBars then 2
           else if hasNext and barsToNext <= approachBars then 1
           else if !hasNext and estDue then 1
           else 0;

plot EarningsRisk = risk;
EarningsRisk.SetDefaultColor(Color.WHITE);
AssignBackgroundColor(
      if risk == 3 then CreateColor(190, 30, 58)
      else if risk == 2 then CreateColor(180, 90, 30)
      else if risk == 1 then CreateColor(150, 125, 0)
      else CreateColor(32, 38, 46));
