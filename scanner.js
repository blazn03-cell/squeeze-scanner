import Anthropic from "@anthropic-ai/sdk";
import { MODEL, MAX_TOKENS, SCAN_TIMEOUT_MS, MAX_RETRIES, RETRY_BACKOFF_MS, SCAN_PARAMS } from "./config.js";

const SYSTEM_PROMPT = `You are a squeeze-candidate scanner. For the provided ticker list, use the Unusual Whales MCP tools to:
1. Fetch flow alerts (bullish, premium > $${SCAN_PARAMS.minPremium}, DTE > ${SCAN_PARAMS.minDTE})
2. Fetch recent dark pool prints (premium > $${SCAN_PARAMS.dpMinPremium}, last ${SCAN_PARAMS.dpLookbackDays} trading days)
3. Fetch market tide / GEX context

CRITICAL: Limit yourself to AT MOST 3 MCP tool calls total. More than 3 concurrent tool calls cause JSON parse failures.

Return ONLY a JSON array. No prose, no markdown fences. Schema:
[
  {
    "ticker": "XYZ",
    "score": 0-100,
    "flow_signal": "purple|yellow|white|none",
    "dp_accumulation_days": 0-5,
    "gex_cluster_above": true|false,
    "short_interest_pct": number or null,
    "thesis": "one sentence",
    "entry_zone": "price range",
    "stop_zone": "price range"
  }
]

Only include tickers scoring ${SCAN_PARAMS.minScore}+. Empty array [] is valid output. First char MUST be [. Last char MUST be ].`;

function stripFences(s) {
  if (!s) return s;
  return s.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function parseArr(raw) {
  if (!raw) return [];
  const cleaned = stripFences(raw);
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    const start = cleaned.indexOf("[");
    const end   = cleaned.lastIndexOf("]");
    if (start >= 0 && end > start) {
      try { return JSON.parse(cleaned.slice(start, end + 1)); } catch (_) {}
    }
    return [];
  }
}

async function callOnce(client, watchlist, uwToken) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), SCAN_TIMEOUT_MS);
  try {
    const resp = await client.beta.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Scan these tickers: ${watchlist.join(", ")}` }],
      mcp_servers: [{
        type: "url",
        url: "https://api.unusualwhales.com/api/mcp",
        name: "unusual-whales",
        authorization_token: uwToken,
      }],
      betas: ["mcp-client-2025-04-04"],
    }, { signal: ctrl.signal });
    return resp;
  } finally {
    clearTimeout(timer);
  }
}

export async function runScan(watchlist) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const uwToken      = process.env.UW_API_TOKEN;
  if (!anthropicKey) throw new Error("Missing ANTHROPIC_API_KEY secret");
  if (!uwToken)      throw new Error("Missing UW_API_TOKEN secret");

  const client = new Anthropic({ apiKey: anthropicKey });

  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      const resp = await callOnce(client, watchlist, uwToken);
      const tools = (resp.content || []).filter(b => b.type === "mcp_tool_use");
      if (tools.length) console.log(`  tools used: ${[...new Set(tools.map(t => t.name))].join(", ")}`);
      const text = (resp.content || []).find(b => b.type === "text")?.text || "";
      const usage = resp.usage || {};
      const inTok  = (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0);
      const outTok = usage.output_tokens || 0;
      const cost   = (inTok * 3 + outTok * 15) / 1e6;
      console.log(`  tokens: ${inTok} in / ${outTok} out · ~$${cost.toFixed(4)}`);
      const arr = parseArr(text);
      return arr.filter(c => c && c.ticker && typeof c.score === "number" && c.score >= SCAN_PARAMS.minScore);
    } catch (err) {
      lastErr = err;
      const aborted = err?.name === "AbortError";
      const why = aborted ? `timed out after ${SCAN_TIMEOUT_MS/1000}s` : (err?.message || String(err));
      if (attempt <= MAX_RETRIES) {
        console.log(`  attempt ${attempt}/${MAX_RETRIES + 1} failed (${why}) — retrying in ${RETRY_BACKOFF_MS/1000}s…`);
        await new Promise(r => setTimeout(r, RETRY_BACKOFF_MS));
        continue;
      }
      throw new Error(`Scan failed after ${MAX_RETRIES + 1} attempts: ${why}`);
    }
  }
  throw lastErr || new Error("Unknown scan failure");
}
