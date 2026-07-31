export function rowsFromScanResults(results) {
  if (!Array.isArray(results) || results.length === 0) {
    return [["NO_CANDIDATES", "", "", "", "", ""]];
  }

  return results.map((result) => [
    result.symbol,
    result.score,
    result.confidence,
    result.state,
    result.setup,
    [...(result.reasons || []), ...(result.warnings || [])].join(" | "),
  ]);
}

export async function logToSheet() {
  throw new Error("Google Sheets logging was removed from the production MVP. Persist scan_runs and scan_results in PostgreSQL, and export reports to object storage when needed.");
}
