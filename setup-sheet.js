// One-time (idempotent) provisioner for the dashboard tabs.
// Run with: npm run setup
// Safe to re-run anytime — Raw Log data is preserved; Today and Repeat Hits
// tabs are rebuilt from scratch.
import { ReplitConnectors } from "@replit/connectors-sdk";

function normalizeSheetId(raw) {
  if (!raw) return raw;
  let s = raw.trim();
  const m = s.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  return s.split(/[\/?#]/)[0];
}
const SHEET_ID = normalizeSheetId(process.env.GOOGLE_SHEET_ID);
if (!SHEET_ID) {
  console.error("✗ Missing GOOGLE_SHEET_ID secret");
  process.exit(1);
}

const connectors = new ReplitConnectors();

async function api(method, path, body) {
  const opts = { method };
  if (body !== undefined) {
    opts.headers = { "Content-Type": "application/json" };
    opts.body    = JSON.stringify(body);
  }
  const res = await connectors.proxy("google-sheet", path, opts);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    if (res.status === 403 || res.status === 404) {
      throw new Error(
        `Sheets API ${res.status}: ${txt.slice(0,200)}\n` +
        `→ Make sure the sheet ID is correct and the connected Google account has Editor access.`
      );
    }
    throw new Error(`Sheets API ${res.status} on ${method} ${path}: ${txt.slice(0,300)}`);
  }
  // Some PUT/batchUpdate responses have empty body
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

async function getSpreadsheet() {
  return api("GET", `/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties,sheets.conditionalFormats`);
}

async function batchUpdate(requests) {
  return api("POST", `/v4/spreadsheets/${SHEET_ID}:batchUpdate`, { requests });
}

async function setValues(rangeA1, values) {
  const enc = encodeURIComponent(rangeA1);
  return api("PUT", `/v4/spreadsheets/${SHEET_ID}/values/${enc}?valueInputOption=USER_ENTERED`, { values });
}

function findSheet(meta, title) {
  return (meta.sheets || []).find(s => s.properties.title === title);
}

async function ensureRawLog(meta) {
  const HEADER = ["timestamp","ticker","score","flow_signal","dp_days","gex_cluster","short_int","thesis","entry_zone","stop_zone"];
  let sheet = findSheet(meta, "Raw Log");
  if (!sheet) {
    const r = await batchUpdate([{ addSheet: { properties: { title: "Raw Log" } } }]);
    sheet = { properties: r.replies[0].addSheet.properties };
    console.log("✓ created Raw Log tab");
  }
  // Always (re)write header row to ensure it matches; preserves data rows below.
  await setValues("Raw Log!A1:J1", [HEADER]);
  console.log("✓ Raw Log header verified");
  return sheet.properties.sheetId;
}

async function rebuildTab(meta, title) {
  const existing = findSheet(meta, title);
  if (existing) {
    await batchUpdate([{ deleteSheet: { sheetId: existing.properties.sheetId } }]);
  }
  const r = await batchUpdate([{ addSheet: { properties: { title } } }]);
  const sheetId = r.replies[0].addSheet.properties.sheetId;
  console.log(`✓ ${existing ? "rebuilt" : "created"} ${title} tab`);
  return sheetId;
}

const HEADER_FORMAT = {
  backgroundColorStyle: { rgbColor: { red: 0.10, green: 0.10, blue: 0.10 } },
  textFormat: { bold: true, foregroundColorStyle: { rgbColor: { red: 1, green: 1, blue: 1 } } },
  horizontalAlignment: "LEFT",
};

function formatRangeRequest(sheetId, startRow, endRow, startCol, endCol, userEnteredFormat) {
  return {
    repeatCell: {
      range: { sheetId, startRowIndex: startRow, endRowIndex: endRow, startColumnIndex: startCol, endColumnIndex: endCol },
      cell: { userEnteredFormat },
      fields: "userEnteredFormat(backgroundColorStyle,textFormat,horizontalAlignment)",
    },
  };
}

function condFormatRequest(sheetId, startRow, endRow, startCol, endCol, formula, bgHex, fgHex) {
  const hex = h => ({
    red:   parseInt(h.slice(1,3),16) / 255,
    green: parseInt(h.slice(3,5),16) / 255,
    blue:  parseInt(h.slice(5,7),16) / 255,
  });
  return {
    addConditionalFormatRule: {
      rule: {
        ranges: [{ sheetId, startRowIndex: startRow, endRowIndex: endRow, startColumnIndex: startCol, endColumnIndex: endCol }],
        booleanRule: {
          condition: { type: "CUSTOM_FORMULA", values: [{ userEnteredValue: formula }] },
          format: {
            backgroundColorStyle: { rgbColor: hex(bgHex) },
            textFormat: { foregroundColorStyle: { rgbColor: hex(fgHex) } },
          },
        },
      },
      index: 0,
    },
  };
}

function setColumnWidthRequest(sheetId, startCol, endCol, pixels) {
  return {
    updateDimensionProperties: {
      range: { sheetId, dimension: "COLUMNS", startIndex: startCol, endIndex: endCol },
      properties: { pixelSize: pixels },
      fields: "pixelSize",
    },
  };
}

function freezeRowsRequest(sheetId, count) {
  return {
    updateSheetProperties: {
      properties: { sheetId, gridProperties: { frozenRowCount: count } },
      fields: "gridProperties.frozenRowCount",
    },
  };
}

async function buildToday(meta) {
  const sheetId = await rebuildTab(meta, "Today");

  // Summary strip + headers
  await setValues("Today!A1:H1", [["Today's Scan Summary","","","","","","",""]]);
  await setValues("Today!A2:H2", [[
    "Total Candidates:", "=COUNTA(B5:B1000)-COUNTBLANK(B5:B1000)",
    "Score 80+:",        "=COUNTIF(C5:C1000,\">=80\")",
    "Triple Hits:",      "=COUNTIF(K5:K1000,3)",
    "Top Ticker:",       "=IFERROR(INDEX(B5:B1000,MATCH(MAX(C5:C1000),C5:C1000,0)),\"—\")",
  ]]);
  await setValues("Today!A4:K4", [[
    "Scan Time","Ticker","Score","Flow","DP Days","GEX ↑","SI %","Thesis","Entry","Stop","Hit Count",
  ]]);

  // QUERY pulls today's rows from Raw Log; ARRAYFORMULA fills hit counts.
  await setValues("Today!A5", [[
    "=QUERY('Raw Log'!A:J, \"SELECT A,B,C,D,E,F,G,H,I,J WHERE A >= date '\"&TEXT(TODAY(),\"yyyy-mm-dd\")&\"' AND B <> 'NO_CANDIDATES' AND B <> 'ERROR' ORDER BY C DESC\", 0)",
  ]]);
  await setValues("Today!K5", [[
    "=ARRAYFORMULA(IF(B5:B=\"\",\"\",COUNTIF(B:B,B5:B)))",
  ]]);

  const requests = [
    // Merge title cell A1:H1 and bold/large-font it
    { mergeCells: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 8 }, mergeType: "MERGE_ALL" } },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 8 },
        cell: { userEnteredFormat: { textFormat: { bold: true, fontSize: 14 } } },
        fields: "userEnteredFormat.textFormat",
      },
    },
    // Bold the summary labels (A2,C2,E2,G2)
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 8 },
        cell: { userEnteredFormat: { textFormat: { bold: true } } },
        fields: "userEnteredFormat.textFormat",
      },
    },
    // Header row format (row 4)
    formatRangeRequest(sheetId, 3, 4, 0, 11, HEADER_FORMAT),
    // Freeze first 4 rows
    freezeRowsRequest(sheetId, 4),
    // Column widths
    setColumnWidthRequest(sheetId,  0,  1, 160),
    setColumnWidthRequest(sheetId,  1,  2,  80),
    setColumnWidthRequest(sheetId,  2,  3,  70),
    setColumnWidthRequest(sheetId,  3,  4,  80),
    setColumnWidthRequest(sheetId,  4,  5,  80),
    setColumnWidthRequest(sheetId,  5,  6,  70),
    setColumnWidthRequest(sheetId,  6,  7,  70),
    setColumnWidthRequest(sheetId,  7,  8, 350),
    setColumnWidthRequest(sheetId,  8,  9, 120),
    setColumnWidthRequest(sheetId,  9, 10, 120),
    setColumnWidthRequest(sheetId, 10, 11,  90),
    // Conditional formatting (6 rules)
    condFormatRequest(sheetId, 4, 1000,  2,  3, "=$C5>=80",                       "#0d9f4f", "#ffffff"),
    condFormatRequest(sheetId, 4, 1000,  2,  3, "=AND($C5>=60,$C5<80)",          "#fbbf24", "#000000"),
    condFormatRequest(sheetId, 4, 1000, 10, 11, "=$K5>=3",                       "#0d9f4f", "#ffffff"),
    condFormatRequest(sheetId, 4, 1000, 10, 11, "=$K5=2",                        "#86efac", "#000000"),
    condFormatRequest(sheetId, 4, 1000,  3,  4, "=$D5=\"purple\"",               "#a855f7", "#ffffff"),
    condFormatRequest(sheetId, 4, 1000,  5,  6, "=$F5=TRUE",                     "#93c5fd", "#000000"),
  ];
  await batchUpdate(requests);
  console.log("✓ Today tab formulas, formatting, and conditional rules applied");
}

async function buildRepeatHits(meta) {
  const sheetId = await rebuildTab(meta, "Repeat Hits");

  await setValues("Repeat Hits!A1:D1", [["Ticker","Hit Count","Best Score","Latest Thesis"]]);
  await setValues("Repeat Hits!A2", [[ "=UNIQUE(FILTER('Today'!B5:B, 'Today'!K5:K >= 2))" ]]);
  await setValues("Repeat Hits!B2", [[ "=ARRAYFORMULA(IF(A2:A=\"\",\"\",COUNTIF('Today'!B:B,A2:A)))" ]]);
  await setValues("Repeat Hits!C2", [[ "=ARRAYFORMULA(IF(A2:A=\"\",\"\",IFERROR(MAXIFS('Today'!C:C,'Today'!B:B,A2:A),\"\")))" ]]);
  await setValues("Repeat Hits!D2", [[ "=ARRAYFORMULA(IF(A2:A=\"\",\"\",IFERROR(VLOOKUP(A2:A,SORT('Today'!B5:H,1,TRUE,7,FALSE),7,FALSE),\"\")))" ]]);

  const requests = [
    formatRangeRequest(sheetId, 0, 1, 0, 4, HEADER_FORMAT),
    freezeRowsRequest(sheetId, 1),
    setColumnWidthRequest(sheetId, 0, 1,  80),
    setColumnWidthRequest(sheetId, 1, 2,  90),
    setColumnWidthRequest(sheetId, 2, 3, 100),
    setColumnWidthRequest(sheetId, 3, 4, 400),
  ];
  await batchUpdate(requests);
  console.log("✓ Repeat Hits tab formulas and formatting applied");
}

async function main() {
  console.log(`Provisioning sheet ${SHEET_ID}…`);
  let meta = await getSpreadsheet();
  await ensureRawLog(meta);

  // Re-fetch metadata since Raw Log may have just been created
  meta = await getSpreadsheet();
  await buildToday(meta);

  // Re-fetch again since Today was just (re)created
  meta = await getSpreadsheet();
  await buildRepeatHits(meta);

  console.log("\n✅ Setup complete. Open the sheet — you should see Raw Log, Today, and Repeat Hits tabs.");
  console.log("   Run `npm run scan` to populate one row of real data.");
}

main().catch(err => {
  console.error("\n✗ Setup failed:", err?.message || err);
  process.exit(1);
});
