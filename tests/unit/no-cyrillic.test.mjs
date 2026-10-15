// Interface text lives in data/ui.json (English) + locales/ru/ui.json, never in
// the code (ADR 0005). Comments may be in any language; <head> keeps a Russian
// <title>/description for crawlers and link previews and is translated at
// runtime by data-i18n.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const CYR = /[А-Яа-яЁё]/;

function jsFiles(dir = "js") {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? jsFiles(`${dir}/${e.name}`) : e.name.endsWith(".js") ? [`${dir}/${e.name}`] : []);
}

/* Blanks comments but keeps line numbers. Block comments go whole; a line
   comment counts only at the start of a line or after code punctuation —
   `<b>//</b>` inside a template is markup, not a comment. */
function stripJsComments(text) {
  const noBlocks = text.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, " "));
  return noBlocks.split("\n").map(line =>
    /^\s*\/\//.test(line) ? "" : line.replace(/([;,{}()\[\]])\s*\/\/.*$/, "$1")).join("\n");
}

test("no Cyrillic in js/ outside comments", () => {
  const hits = [];
  for (const f of jsFiles()) {
    stripJsComments(readFileSync(join(ROOT, f), "utf8")).split("\n").forEach((line, i) => {
      if (CYR.test(line)) hits.push(`${f}:${i + 1}: ${line.trim().slice(0, 80)}`);
    });
  }
  assert.deepEqual(hits, []);
});

test("no Cyrillic in index.html outside <head> and comments", () => {
  const html = readFileSync(join(ROOT, "index.html"), "utf8")
    .replace(/<head>[\s\S]*?<\/head>/, m => m.replace(/[^\n]/g, " "))
    .replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, " "));
  const hits = [];
  html.split("\n").forEach((line, i) => { if (CYR.test(line)) hits.push(`index.html:${i + 1}: ${line.trim().slice(0, 80)}`); });
  assert.deepEqual(hits, []);
});
