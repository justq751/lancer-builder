import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts, coreData, plain } from "./load.mjs";
import { FULL_BUILD } from "../fixtures/builds.mjs";

// Fresh context per test: applyBuildState() writes into the global `state`.
function setup(extraL = {}) {
  const { L, M } = coreData();
  Object.assign(L, extraL);
  const run = loadScripts(["js/core/build.js", "js/core/rules.js"], { L, M });
  run.ctx.state = run("defaultState()");
  return run;
}

test("defaultState has every part of a build, empty", () => {
  const s = plain(setup()("defaultState()"));
  assert.deepEqual(Object.keys(s), ["pilot", "skills", "customSkills", "talents", "hase", "licenses", "gear", "cores", "mech"]);
  assert.deepEqual(s.mech, { frameId: null, mounts: [], systems: [] });
  assert.equal(setup()("buildIsEmpty()"), true);
});

test("applyBuildState keeps a valid build exactly", () => {
  const run = setup();
  run.ctx.raw = structuredClone(FULL_BUILD);
  assert.deepEqual(plain(run("applyBuildState(raw)")), []);
  assert.deepEqual(plain(run("state")), FULL_BUILD);
});

test("applyBuildState clamps numbers and trims strings from untrusted input", () => {
  const run = setup();
  run.ctx.raw = {
    pilot: { name: "x".repeat(500), callsign: 42, ll: 99 },
    skills: { sk_assault: 9 }, talents: { t_ace: 0 },
    hase: { hull: -3, agility: "4" }, licenses: { Blackbeard: 7 },
  };
  run("applyBuildState(raw)");
  const s = plain(run("state"));
  assert.equal(s.pilot.name.length, 120);
  assert.equal(s.pilot.callsign, "");
  assert.equal(s.pilot.ll, 12);
  assert.equal(s.skills.sk_assault, 6);
  assert.equal(s.talents.t_ace, 1);
  assert.deepEqual(s.hase, { hull: 0, agility: 4, systems: 0, engineering: 0 });
  assert.equal(s.licenses.Blackbeard, 3);
});

test("applyBuildState drops unknown ids and names each one", () => {
  const run = setup();
  run.ctx.raw = {
    ...structuredClone(FULL_BUILD),
    talents: { t_ace: 1, t_nope: 2 },
    mech: { ...structuredClone(FULL_BUILD.mech), systems: ["ms_custom_paint_job", "ms_nope"] },
  };
  const dropped = plain(run("applyBuildState(raw)"));
  assert.deepEqual(dropped, ["талант «t_nope»", "система «ms_nope»"]);
  assert.deepEqual(plain(run("state.talents")), { t_ace: 1 });
});

test("applyBuildState: weapons without a frame are dropped and say why", () => {
  const run = setup();
  run.ctx.raw = { mech: { frameId: "mf_missing", mounts: [{ type: "Main", items: ["mw_assault_rifle"] }] } };
  const dropped = plain(run("applyBuildState(raw)"));
  assert.equal(dropped[0], "шасси «mf_missing»");
  assert.match(dropped[1], /\(нет шасси\)$/);
  assert.equal(run("state.mech.frameId"), null);
});

test("migrateWeaponSlots turns legacy string slots into {id, mod}", () => {
  const run = setup();
  run("state.mech.mounts = [{type:'Main', items:['mw_assault_rifle', {id:'mw_charged_blade', mod:null}]}]");
  run("migrateWeaponSlots()");
  assert.deepEqual(plain(run("state.mech.mounts[0].items")),
    [{ id: "mw_assault_rifle", mod: null }, { id: "mw_charged_blade", mod: null }]);
});

test("migrateLicenseKeys folds a variant's own key into its base frame", () => {
  const run = setup({ frames: [{ id: "mf_v", name: "Variant", variant: "Base" }, { id: "mf_b", name: "Base" }] });
  run("state.licenses = { Variant: 2, Base: 1 }");
  run("migrateLicenseKeys()");
  assert.deepEqual(plain(run("state.licenses")), { Base: 2 });
});

test("allowedNext: what each mount type still accepts", () => {
  const run = setup();
  const a = (type, sizes) => plain(run(`allowedNext(${JSON.stringify(type)}, ${JSON.stringify(sizes)})`));
  assert.deepEqual(a("Main", []), ["Main", "Auxiliary"]);
  assert.deepEqual(a("Main", ["Main"]), []);
  assert.deepEqual(a("Flex", []), ["Main", "Auxiliary"]);
  assert.deepEqual(a("Flex", ["Auxiliary"]), ["Auxiliary"]);
  assert.deepEqual(a("Flex", ["Main"]), []);
  assert.deepEqual(a("Heavy", []), ["Heavy", "Main", "Auxiliary", "Superheavy"]);
  assert.deepEqual(a("Aux/Aux", ["Auxiliary"]), ["Auxiliary"]);
  assert.deepEqual(a("Main/Aux", ["Main"]), ["Auxiliary"]);
});

test("buildMounts adds a pre-filled Integrated mount for frames with a built-in weapon", () => {
  const run = setup();
  const mounts = plain(run("buildMounts(M.frame.mf_lancaster)"));
  assert.deepEqual(mounts.at(-1), { type: "Integrated", items: [{ id: "mw_lancaster_integrated", mod: null }] });
  assert.ok(plain(run("buildMounts(M.frame.mf_blackbeard)")).every(m => m.items.length === 0));
});
