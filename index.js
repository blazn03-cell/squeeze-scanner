import { mkdir, writeFile } from "node:fs/promises";
import { scanUniverse } from "./src/jobs/scan-universe.js";
import { WATCHLIST, SCAN_PARAMS } from "./config.js";

async function main() {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Scan starting for ${WATCHLIST.length} symbol${WATCHLIST.length === 1 ? "" : "s"}: ${WATCHLIST.join(", ")}`);

  const scan = await scanUniverse({ symbols: WATCHLIST, concurrency: SCAN_PARAMS.maxConcurrency });
  await mkdir("data/snapshots", { recursive: true });
  const outputPath = `data/snapshots/${scan.runId}.json`;
  await writeFile(outputPath, JSON.stringify(scan, null, 2));

  console.log(`[${timestamp}] Scored ${scan.results.length} result${scan.results.length === 1 ? "" : "s"}; ${scan.failures.length} failure${scan.failures.length === 1 ? "" : "s"}`);
  console.log(JSON.stringify(scan.results, null, 2));
}

main().catch((error) => {
  console.error("SCAN FAILED:", error?.message || error);
  process.exit(1);
});
