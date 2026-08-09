import fs from "node:fs";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
for (const token of ["Education only", "Not financial advice", "/api/bars", "A high score is not a guarantee"]) {
  if (!html.includes(token)) throw new Error(`release check: missing ${token}`);
}
for (const token of ["Sharp sustained drop incoming.", "High SI + institutional accumulation = explosive forced covering."]) {
  if (html.includes(token)) throw new Error(`release check: unsupported claim remains: ${token}`);
}
for (const path of ["docs/OPTIONS_TRADING_SCOPE.md", "docs/RELEASE_STATUS.md", "evidence/thinkorswim/thinkorswim_scanner_evidence_2026-08-06.zip", "evidence/thinkorswim/thinkorswim_scanner_evidence_2026-08-06.sha256.txt"]) {
  if (!fs.existsSync(new URL(`../${path}`, import.meta.url))) throw new Error(`release check: missing ${path}`);
}
console.log("PASS release-readiness static checks");
