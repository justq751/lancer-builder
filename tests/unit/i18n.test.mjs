import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts, readJSON } from "./load.mjs";

const run = loadScripts(["js/core/i18n.js"]);

test("pickText: non-empty translation wins, otherwise the original stays", () => {
  assert.equal(run(`pickText("Assault", {en:"Assault", ru:"Штурмовать"})`), "Штурмовать");
  assert.equal(run(`pickText("Assault", {en:"Assault", ru:""})`), "Assault");
  assert.equal(run(`pickText("Assault", {en:"Assault", ru:"   "})`), "Assault");
  assert.equal(run(`pickText("Assault", undefined)`), "Assault");
});

test("localizeData with the real data: translates text, never logic keys, never mutates base", () => {
  const base = readJSON("data/lancer-data.json");
  const locale = {};
  for (const f of ["skills", "frames", "weapons", "enums"]) locale[f] = readJSON(`locales/ru/${f}.json`);
  const before = JSON.stringify(base);
  run.ctx.base = base; run.ctx.locale = locale;
  const L = run(`localizeData(base, locale)`);

  assert.equal(JSON.stringify(base), before, "base must not be mutated");
  const skill = L.skills.find(s => s.id === "sk_act_unseen_or_unheard");
  assert.equal(skill.name, locale.skills.sk_act_unseen_or_unheard.name.ru);

  const bb = L.frames.find(f => f.id === "mf_blackbeard");
  assert.equal(bb.name, "Blackbeard", "frame.name is a license key — stays English");
  const rifle = L.weapons.find(w => w.id === "mw_assault_rifle");
  assert.equal(rifle.mount, "Main");
  assert.equal(rifle.type, "Rifle");
});

// localizeData expects the full dataset shape (every category array present),
// so the tests below use the real base and edit the locale.
test("localizeData: an empty ru string falls back to English", () => {
  const base = readJSON("data/lancer-data.json");
  const skills = readJSON("locales/ru/skills.json");
  skills.sk_assault.name.ru = "";
  run.ctx.base = base; run.ctx.locale = { skills };
  const L = run(`localizeData(base, locale)`);
  const assault = L.skills.find(s => s.id === "sk_assault");
  assert.equal(assault.name, base.skills.find(s => s.id === "sk_assault").name);
  assert.equal(assault.description, skills.sk_assault.description.ru, "other fields still translate");
});

test("localizeData: no locale (English) returns an equal, separate copy", () => {
  const base = readJSON("data/lancer-data.json");
  run.ctx.base = base;
  const L = run(`localizeData(base, null)`);
  assert.deepEqual(JSON.parse(JSON.stringify(L)), base);
  assert.notEqual(L, base);
});
