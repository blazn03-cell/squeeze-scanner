import { runScan } from "./scanner.js";
import { logToSheet } from "./sheets.js";
import { WATCHLIST } from "./config.js";

async function main() {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Scan starting for ${WATCHLIST.length} ticker${WATCHLIST.length === 1 ? "" : "s"}: ${WATCHLIST.join(", ")}`);

  try {
    const results = await runScan(WATCHLIST);
    const wrote = await logToSheet(timestamp, results);
    console.log(`[${timestamp}] Logged ${wrote} row${wrote === 1 ? "" : "s"} (${results.length} candidate${results.length === 1 ? "" : "s"})`);
    process.exit(0);
  } catch (err) {
    console.error(`[${timestamp}] SCAN FAILED:`, err?.message || err);
    try {
      await logToSheet(timestamp, [{
        ticker: "ERROR",
        score: 0,
        thesis: (err?.message || String(err)).slice(0, 250),
      }]);
    } catch (logErr) {
      console.error(`[${timestamp}] also failed to log error to sheet:`, logErr?.message || logErr);
    }
    process.exit(1);
  }
}

main();
