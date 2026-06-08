/**
 * Code Improvement Agent
 *
 * Scans project JS files using Claude and reports readability,
 * performance, and best-practice issues with before/after examples.
 *
 * Usage:
 *   node improve-agent.js [file1.js file2.js ...]
 *
 * If no files are given it scans all .js files in the project root
 * (excluding node_modules and this script itself).
 */

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, basename } from "node:path";

const SYSTEM_PROMPT = `You are an expert JavaScript code reviewer.

For each file you receive you will output a JSON object with this schema:
{
  "file": "<filename>",
  "issues": [
    {
      "category": "readability" | "performance" | "best-practice" | "correctness",
      "severity": "low" | "medium" | "high",
      "title": "<short title>",
      "explanation": "<1-3 sentences explaining the problem and why it matters>",
      "before": "<the exact problematic snippet (≤15 lines)>",
      "after": "<the improved replacement snippet>"
    }
  ]
}

Rules:
- Only report genuine, actionable issues. Skip trivial nitpicks.
- "before" must be a verbatim excerpt from the supplied source.
- "after" must be a minimal, drop-in replacement — no unrelated refactors.
- If a file has no meaningful issues output "issues": [].
- Return ONLY valid JSON. No prose, no markdown fences.`;

async function analyzeFile(client, filename, source) {
  const resp = await client.messages.create({
    model: process.env.REVIEW_MODEL || "claude-sonnet-4-6",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `File: ${filename}\n\`\`\`js\n${source}\n\`\`\``,
      },
    ],
  });

  const text = (resp.content || []).find((b) => b.type === "text")?.text || "{}";
  try {
    return JSON.parse(text.trim());
  } catch {
    // Strip accidental fences
    const stripped = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    return JSON.parse(stripped);
  }
}

function projectFiles(root) {
  return readdirSync(root)
    .filter(
      (f) =>
        f.endsWith(".js") &&
        f !== "improve-agent.js" &&
        !f.startsWith(".")
    )
    .map((f) => resolve(root, f));
}

function severityColor(sev) {
  return { high: "\x1b[31m", medium: "\x1b[33m", low: "\x1b[36m" }[sev] ?? "";
}
const RESET = "\x1b[0m";
const BOLD  = "\x1b[1m";
const DIM   = "\x1b[2m";

function printReport(result) {
  if (!result?.file) return;
  console.log(`\n${BOLD}━━━ ${result.file} ━━━${RESET}`);
  const issues = result.issues || [];
  if (issues.length === 0) {
    console.log(`  ${DIM}No issues found.${RESET}`);
    return;
  }
  issues.forEach((issue, i) => {
    const col = severityColor(issue.severity);
    console.log(
      `\n  ${BOLD}${i + 1}. [${col}${issue.severity.toUpperCase()}${RESET}${BOLD}] ${issue.category} — ${issue.title}${RESET}`
    );
    console.log(`  ${DIM}${issue.explanation}${RESET}`);
    console.log(`\n  ${BOLD}Before:${RESET}`);
    issue.before.split("\n").forEach((l) => console.log(`    ${DIM}${l}${RESET}`));
    console.log(`\n  ${BOLD}After:${RESET}`);
    issue.after.split("\n").forEach((l) => console.log(`    ${l}`));
  });
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("Error: ANTHROPIC_API_KEY is not set.");
    process.exit(1);
  }

  const root = new URL(".", import.meta.url).pathname;
  const targets =
    process.argv.slice(2).length > 0
      ? process.argv.slice(2).map((f) => resolve(f))
      : projectFiles(root);

  if (targets.length === 0) {
    console.error("No JS files found to review.");
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });
  let totalIssues = 0;
  const summary = [];

  console.log(`${BOLD}Code Improvement Agent${RESET}`);
  console.log(`Reviewing ${targets.length} file${targets.length === 1 ? "" : "s"}…\n`);

  for (const filePath of targets) {
    const filename = basename(filePath);
    let source;
    try {
      source = readFileSync(filePath, "utf8");
    } catch {
      console.warn(`  Skipping ${filename} — could not read file.`);
      continue;
    }

    process.stdout.write(`  Analyzing ${filename}…`);
    let result;
    try {
      result = await analyzeFile(client, filename, source);
    } catch (err) {
      console.log(` failed (${err?.message || err})`);
      continue;
    }

    const count = result?.issues?.length ?? 0;
    console.log(` ${count} issue${count === 1 ? "" : "s"} found`);
    totalIssues += count;
    summary.push({ file: filename, count });
    printReport(result);
  }

  console.log(`\n${BOLD}━━━ Summary ━━━${RESET}`);
  summary.forEach(({ file, count }) =>
    console.log(`  ${file}: ${count} issue${count === 1 ? "" : "s"}`)
  );
  console.log(`  Total: ${totalIssues} issue${totalIssues === 1 ? "" : "s"} across ${targets.length} file${targets.length === 1 ? "" : "s"}`);
}

main().catch((err) => {
  console.error("Agent error:", err?.message || err);
  process.exit(1);
});
