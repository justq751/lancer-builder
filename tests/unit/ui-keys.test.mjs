// Interface strings stay in step with the code: every key the code uses is in
// data/ui.json, nothing in data/ui.json is dead, and locales/ru/ui.json has a
// complete, placeholder-faithful Russian for each. Keys are literals in the
// code — t("pilot.field.name"), data-i18n="…", data-i18n-attr="title:…" — or
// listed in a `i18n-dynamic: a.b, a.c` comment next to a computed key.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readJSON } from "./load.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

function sources() {
  const files = ["index.html"];
  const walk = dir => {
    for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".js")) files.push(p);
    }
  };
  walk("js");
  return files.map(f => ({ file: f, text: readFileSync(join(ROOT, f), "utf8") }));
}

function usedKeys() {
  const used = new Map(); // key -> first file
  const add = (k, f) => { if (!used.has(k)) used.set(k, f); };
  for (const { file, text } of sources()) {
    // A whole literal argument only: t("a.b_"+x) is a computed key — declare
    // its family with i18n-dynamic.
    for (const m of text.matchAll(/\b(?:t|tText)\(\s*(["'`])([\w.-]+)\1\s*[,)]/g)) add(m[2], file);
    for (const m of text.matchAll(/data-i18n="([\w.-]+)"/g)) add(m[1], file);
    for (const m of text.matchAll(/data-i18n-attr="([^"]+)"/g))
      for (const pair of m[1].split(";")) add(pair.split(":")[1].trim(), file);
    for (const m of text.matchAll(/i18n-dynamic:([^\n*]*)/g))
      for (const k of m[1].split(",").map(s => s.trim()).filter(Boolean)) add(k, file);
  }
  return used;
}

const EN = readJSON("data/ui.json");
const RU = readJSON("locales/ru/ui.json");
const placeholders = v => new Set(
  (typeof v === "string" ? [v] : Object.values(v)).flatMap(s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1])));

test("every key the code uses exists in data/ui.json", () => {
  const missing = [...usedKeys()].filter(([k]) => !(k in EN)).map(([k, f]) => `${k} (${f})`);
  assert.deepEqual(missing, []);
});

test("data/ui.json has no unused keys", () => {
  const used = usedKeys();
  assert.deepEqual(Object.keys(EN).filter(k => !used.has(k)), []);
});

test("locales/ru/ui.json mirrors data/ui.json and is fully translated", () => {
  assert.deepEqual(Object.keys(RU).sort(), Object.keys(EN).sort());
  const problems = [];
  for (const [k, en] of Object.entries(EN)) {
    const pair = RU[k];
    if (JSON.stringify(pair.en) !== JSON.stringify(en)) problems.push(`${k}: stale "en"`);
    const ru = pair.ru;
    const filled = typeof en === "string"
      ? typeof ru === "string" && ru.trim() !== ""
      : ru && ["one", "few", "many"].every(f => typeof ru[f] === "string" && ru[f].trim());
    if (!filled) problems.push(`${k}: no Russian`);
  }
  assert.deepEqual(problems, []);
});

test("Russian strings use the same {placeholders} as English", () => {
  const problems = [];
  for (const [k, en] of Object.entries(EN)) {
    const a = [...placeholders(en)].sort().join(","), b = [...placeholders(RU[k].ru)].sort().join(",");
    if (a !== b) problems.push(`${k}: en {${a}} ≠ ru {${b}}`);
  }
  assert.deepEqual(problems, []);
});

test("no local variable is named t — it would hide t() inside its scope", () => {
  // A talent loop `L.talents.map(t=>…)` calling t("…") inside crashes with
  // "t is not a function" — only on the screens that render that loop.
  const decl = /(?:\b(?:const|let|var)\s+t\b|[(,]\s*t\s*(?:=>|[,)]\s*=>)|\(\s*t\s*\)\s*=>|\bfunction\s*\w*\s*\(\s*t\b)/;
  const hits = [];
  for (const { file, text } of sources()) {
    if (file === "js/core/i18n.js" || !file.endsWith(".js")) continue;
    text.split("\n").forEach((line, i) => { if (decl.test(line)) hits.push(`${file}:${i + 1}`); });
  }
  assert.deepEqual(hits, []);
});
