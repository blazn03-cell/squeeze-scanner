# Squeeze & Flush Scanner

A single-page browser app for scanning options flow signals (squeezes, flushes, macro trends).

## Architecture

- Pure static HTML/JS app — `index.html` contains all code (React via CDN, Babel standalone)
- No build step, no framework, no backend
- Served with Python's built-in HTTP server on port 5000

## Running

The "Start application" workflow runs: `python3 -m http.server 5000`

## Notes

- The app uses an Unusual Whales API key and an Anthropic API key entered by the user at runtime (stored client-side only)
- All logic runs in the browser; no server-side secrets required
- Deployment: autoscale, run command `python3 -m http.server 5000`

## UI

- Inter (sans) for UI text, JetBrains Mono for numerics/log lines
- Dark theme (#04080c base) with brightened mid-grey palette (#7591a8 / #9bb3c6 / #a7c0d4 / #eaf2ff) for readable contrast
- Minimum text size is 9–10px; no 7–8px microtype in active UI
- "30D BACKUP" label/tooltip clarifies the 30-day tracker is a fallback view of pre-squeeze builds when nothing has fired live
- GEX (Gamma Exposure) is surfaced in three places: header summary badge "🔥 N GEX ↑X ↓Y" (counts amplified squeezes/flushes), per-row chips "γ↑ SHORT · $wall" / "γ↓ LONG · $wall" on live cards, and γ↑/γ↓ chips on 30D backup cards. GEX bias is also persisted into the 30-day history.
