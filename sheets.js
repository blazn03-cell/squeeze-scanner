// Google Sheets logger using Replit's built-in Google Sheets connection.
// No service account JSON needed — OAuth is handled by Replit.
import { ReplitConnectors } from "@replit/connectors-sdk";

const HEADER = ["timestamp","ticker","score","flow_signal","dp_days","gex_cluster","short_int","thesis","entry_zone","stop_zone"];

function rowsFromCandidates(timestamp, results) {
  if (!results || results.length === 0) {
    return [[timestamp, "NO_CANDIDATES", "—", "—", "—", "—", "—", "—", "—", "—"]];
  }
  return results.map(c => [
    timestamp,
    c.ticker || "",
    c.score ?? "",
    c.flow_signal || "",
    c.dp_accumulation_days ?? "",
    c.gex_cluster_above === true ? "TRUE" : c.gex_cluster_above === false ? "FALSE" : "",
    c.short_interest_pct ?? "",
    c.thesis || "",
    c.entry_zone || "",
    c.stop_zone || "",
  ]);
}

async function ensureHeader(connectors, sheetId) {
  // Read row 1 to see if headers exist; if not, write them.
  const res = await connectors.proxy(
    "google-sheet",
    `/v4/spreadsheets/${sheetId}/values/Raw%20Log!A1:J1`,
    { method: "GET" }
  );
  if (!res.ok) {
    // Sheet/tab might not exist — bubble a clear error.
    const body = await res.text().catch(() => "");
    throw new Error(`Sheets read failed (HTTP ${res.status}): ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const hasHeader = data?.values?.[0]?.length > 0;
  if (!hasHeader) {
    const put = await connectors.proxy(
      "google-sheet",
      `/v4/spreadsheets/${sheetId}/values/Raw%20Log!A1?valueInputOption=RAW`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: [HEADER] }),
      }
    );
    if (!put.ok) {
      const body = await put.text().catch(() => "");
      throw new Error(`Sheets header write failed (HTTP ${put.status}): ${body.slice(0, 200)}`);
    }
    console.log("  wrote header row to Raw Log");
  }
}

export async function logToSheet(timestamp, results) {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) throw new Error("Missing GOOGLE_SHEET_ID secret");

  const connectors = new ReplitConnectors();
  await ensureHeader(connectors, sheetId);

  const rows = rowsFromCandidates(timestamp, results);
  const res = await connectors.proxy(
    "google-sheet",
    `/v4/spreadsheets/${sheetId}/values/Raw%20Log!A:J:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: rows }),
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Sheets append failed (HTTP ${res.status}): ${body.slice(0, 200)}`);
  }
  return rows.length;
}
