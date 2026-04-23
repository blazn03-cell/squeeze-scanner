# Squeeze & Flush Scanner

A single-page browser app for scanning options flow signals (squeezes, flushes, macro trends).

## Architecture

- Pure static HTML/JS app — `index.html` contains all code (React via CDN, Babel standalone)
- No build step, no framework, no backend
- Served with Python's built-in HTTP server on port 5000

## Running

The "Start application" workflow runs: `python3 -m http.server 5000`

## Notes

- The app uses an Unusual Whales API key entered by the user at runtime (stored client-side only)
- All logic runs in the browser; no server-side secrets required
