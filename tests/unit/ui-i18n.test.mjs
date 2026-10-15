// t(), plural forms, the ru-over-en overlay of interface strings, and the
// first-visit language choice — all pure, in js/core/i18n.js. UI and UI_LANG
// are the loader's globals; here they are set on the vm context directly.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts, plain } from "./load.mjs";

function withUI(UI, UI_LANG = "en") {
  const warnings = [];
  const run = loadScripts(["js/core/i18n.js"], {
    UI, UI_LANG,
    console: { ...console, warn: (...a) => warnings.push(a.join(" ")) },
  });
  return { run, warnings };
}

test("t: looks a key up", () => {
  const { run } = withUI({ a: "Alpha" });
  assert.equal(run(`t("a")`), "Alpha");
});

test("t: a missing key renders as itself and warns once", () => {
  const { run, warnings } = withUI({});
  assert.equal(run(`t("missing.key")`), "missing.key");
  assert.equal(run(`t("missing.key")`), "missing.key");
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /missing\.key/);
});

test("t: escapes parameters, keeps the string's own markup", () => {
  const { run } = withUI({ hi: "Hi, <i>{name}</i>" });
  assert.equal(run(`t("hi", {name: "<b>X</b>"})`), "Hi, <i>&lt;b&gt;X&lt;/b&gt;</i>");
});

test("t: an unknown parameter stays as written", () => {
  const { run } = withUI({ s: "Spent {used} of {cap}" });
  assert.equal(run(`t("s", {used: 2})`), "Spent 2 of {cap}");
});

test("t: Russian plural forms", () => {
  const { run } = withUI({ n: { one: "{n} навык", few: "{n} навыка", many: "{n} навыков" } }, "ru");
  assert.equal(run(`t("n", {n: 1})`), "1 навык");
  assert.equal(run(`t("n", {n: 2})`), "2 навыка");
  assert.equal(run(`t("n", {n: 5})`), "5 навыков");
  assert.equal(run(`t("n", {n: 21})`), "21 навык");
});

test("t: English plural forms", () => {
  const { run } = withUI({ n: { one: "{n} skill", other: "{n} skills" } }, "en");
  assert.equal(run(`t("n", {n: 1})`), "1 skill");
  assert.equal(run(`t("n", {n: 2})`), "2 skills");
});

test("t: a missing plural form falls back to other, then to any form", () => {
  assert.equal(withUI({ n: { one: "{n} x", other: "{n} xs" } }, "ru").run(`t("n", {n: 5})`), "5 xs");
  assert.equal(withUI({ n: { one: "{n} x" } }, "ru").run(`t("n", {n: 5})`), "5 x");
});

test("overlayUiStrings: non-empty ru wins, empty ru keeps English", () => {
  const { run } = withUI({});
  run.ctx.en = { a: "A", b: "B" };
  run.ctx.ru = { a: { en: "A", ru: "А" }, b: { en: "B", ru: "" } };
  assert.deepEqual(plain(run(`overlayUiStrings(en, ru)`)), { a: "А", b: "B" });
  assert.deepEqual(plain(run(`overlayUiStrings(en, null)`)), { a: "A", b: "B" });
});

test("overlayUiStrings: plural forms overlay as a whole, an incomplete ru set keeps English", () => {
  const { run } = withUI({});
  run.ctx.en = { n: { one: "{n} skill", other: "{n} skills" }, m: { one: "{n} x", other: "{n} xs" } };
  run.ctx.ru = {
    n: { en: run.ctx.en.n, ru: { one: "{n} навык", few: "{n} навыка", many: "{n} навыков" } },
    m: { en: run.ctx.en.m, ru: { one: "", few: "", many: "" } },
  };
  const out = plain(run(`overlayUiStrings(en, ru)`));
  assert.deepEqual(out.n, { one: "{n} навык", few: "{n} навыка", many: "{n} навыков" });
  assert.deepEqual(out.m, { one: "{n} x", other: "{n} xs" });
});

test("detectLanguages: first visit follows the browser", () => {
  const { run } = withUI({});
  assert.deepEqual(plain(run(`detectLanguages("en-US", {ui: null, data: null})`)), { ui: "en", data: "en" });
  assert.deepEqual(plain(run(`detectLanguages("ru-RU", {ui: null, data: null})`)), { ui: "ru", data: "ru" });
  assert.deepEqual(plain(run(`detectLanguages(undefined, {ui: null, data: null})`)), { ui: "en", data: "en" });
});

test("detectLanguages: a returning visitor keeps what they had", () => {
  const { run } = withUI({});
  // Before stage 4 only the data language was stored; the interface was Russian.
  assert.deepEqual(plain(run(`detectLanguages("en-US", {ui: null, data: "en"})`)), { ui: "ru", data: "en" });
  assert.deepEqual(plain(run(`detectLanguages("ru", {ui: "en", data: "ru"})`)), { ui: "en", data: "ru" });
});

test("detectLanguages: an unknown stored value counts as missing", () => {
  const { run } = withUI({});
  assert.deepEqual(plain(run(`detectLanguages("ru-RU", {ui: "de", data: "xx"})`)), { ui: "ru", data: "ru" });
});

test("tText: the same string for text contexts — parameters stay raw", () => {
  // For textContent, title/aria-label, and lists that esc() their items:
  // escaping here too would show "&lt;b&gt;" to the reader.
  const { run } = withUI({ p: "pilot {name}", n: { one: "{n} skill", other: "{n} skills" } }, "en");
  assert.equal(run(`tText("p", {name: "<b>X</b>"})`), "pilot <b>X</b>");
  assert.equal(run(`tText("n", {n: 3})`), "3 skills");
  assert.equal(run(`tText("nope")`), "nope");
});

test("t: a parameter named …Html goes in as markup — the caller built and escaped it", () => {
  const { run } = withUI({ s: "shared with {namesHtml} and {plain}" });
  assert.equal(run(`t("s", {namesHtml: "<b>A</b>, <b>B</b>", plain: "<i>"})`), "shared with <b>A</b>, <b>B</b> and &lt;i&gt;");
});
