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

const PRUNE_OLDER_THAN_DAYS = 30;

async function pruneOldRows(connectors, sheetId) {
  // Find Raw Log sheetId
  const meta = await connectors.proxy("google-sheet", `/v4/spreadsheets/${sheetId}?fields=sheets.properties`, { method: "GET" });
  if (!meta.ok) return 0;
  const metaJson = await meta.json();
  const rawLog = (metaJson.sheets || []).find(s => s.properties.title === "Raw Log");
  if (!rawLog) return 0;
  const rawLogId = rawLog.properties.sheetId;

  // Read column A (timestamps), starting row 2 (skip header)
  const valsRes = await connectors.proxy("google-sheet", `/v4/spreadsheets/${sheetId}/values/Raw%20Log!A2:A`, { method: "GET" });
  if (!valsRes.ok) return 0;
  const valsJson = await valsRes.json();
  const rows = valsJson.values || [];
  if (rows.length === 0) return 0;

  const cutoff = Date.now() - PRUNE_OLDER_THAN_DAYS * 86400000;
  // 0-indexed sheet row numbers of stale rows (row 0 = header, so data starts at row 1)
  const staleIdx = [];
  rows.forEach((r, i) => {
    const ts = r?.[0];
    if (!ts) return;
    const t = Date.parse(ts);
    if (!isNaN(t) && t < cutoff) staleIdx.push(i + 1); // +1 for header
  });
  if (staleIdx.length === 0) return 0;

  // Group consecutive indices into ranges and delete bottom-up to keep indices valid
  staleIdx.sort((a, b) => a - b);
  const ranges = [];
  let start = staleIdx[0], end = start + 1;
  for (let i = 1; i < staleIdx.length; i++) {
    if (staleIdx[i] === end) end++;
    else { ranges.push([start, end]); start = staleIdx[i]; end = start + 1; }
  }
  ranges.push([start, end]);
  const requests = ranges.reverse().map(([s, e]) => ({
    deleteDimension: { range: { sheetId: rawLogId, dimension: "ROWS", startIndex: s, endIndex: e } },
  }));

  const del = await connectors.proxy("google-sheet", `/v4/spreadsheets/${sheetId}:batchUpdate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  });
  if (!del.ok) return 0;
  return staleIdx.length;
}

function normalizeSheetId(raw) {
  if (!raw) return raw;
  let s = raw.trim();
  const m = s.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  return s.split(/[\/?#]/)[0];
}

export async function logToSheet(timestamp, results) {
  const sheetId = normalizeSheetId(process.env.GOOGLE_SHEET_ID);
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

  // Auto-prune rows older than 30 days
  try {
    const pruned = await pruneOldRows(connectors, sheetId);
    if (pruned > 0) console.log(`  pruned ${pruned} stale row${pruned === 1 ? "" : "s"} (>${PRUNE_OLDER_THAN_DAYS}d old)`);
  } catch (e) {
    console.log(`  (prune skipped: ${e?.message || e})`);
  }

  return rows.length;
}
