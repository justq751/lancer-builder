// Golden-file comparison for large JSON values (the localized dataset `L`).
// Unlike toMatchSnapshot's text diff, a mismatch lists the exact JSON paths
// that changed, so a 3 MB golden stays debuggable.
import { expect } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const GOLDEN_DIR = join(dirname(fileURLToPath(import.meta.url)), "golden");
const MAX_REPORTED = 40;

/** Writes the golden when it is missing or `--update-snapshots` was passed. */
export function expectGolden(testInfo, name, actual) {
  const file = join(GOLDEN_DIR, name);
  const update = ["all", "changed"].includes(testInfo.config.updateSnapshots);
  if (update || !existsSync(file)) {
    mkdirSync(GOLDEN_DIR, { recursive: true });
    writeFileSync(file, JSON.stringify(actual, null, 1) + "\n");
    testInfo.annotations.push({ type: "golden", description: `written ${name}` });
    return;
  }
  const expected = JSON.parse(readFileSync(file, "utf8"));
  const diffs = [];
  diff(expected, actual, "$", diffs);
  const shown = diffs.slice(0, MAX_REPORTED).join("\n");
  const more = diffs.length > MAX_REPORTED ? `\n… and ${diffs.length - MAX_REPORTED} more` : "";
  expect(diffs, `${name} differs at ${diffs.length} path(s) — ` +
    `if the change is intended (data/translation update), run \`npm run test:update\`:\n${shown}${more}`)
    .toEqual([]);
}

function diff(a, b, path, out) {
  if (out.length > MAX_REPORTED * 10) return;
  if (Object.is(a, b)) return;
  const ta = kind(a), tb = kind(b);
  if (ta !== tb) { out.push(`${path}: ${short(a)} → ${short(b)}`); return; }
  if (ta === "array") {
    if (a.length !== b.length) out.push(`${path}.length: ${a.length} → ${b.length}`);
    for (let i = 0; i < Math.min(a.length, b.length); i++) diff(a[i], b[i], `${path}[${label(a[i], i)}]`, out);
    return;
  }
  if (ta === "object") {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!(k in b)) out.push(`${path}.${k}: removed`);
      else if (!(k in a)) out.push(`${path}.${k}: added ${short(b[k])}`);
      else diff(a[k], b[k], `${path}.${k}`, out);
    }
    return;
  }
  out.push(`${path}: ${short(a)} → ${short(b)}`);
}

const kind = v => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v);
// Array elements are labelled by id where they have one — "frames[mf_drake]"
// reads better than "frames[3]" and survives reordering in the message.
const label = (v, i) => (v && typeof v === "object" && typeof v.id === "string" ? `${i}:${v.id}` : i);
const short = v => {
  const s = JSON.stringify(v);
  return s && s.length > 80 ? s.slice(0, 77) + "…" : s;
};
