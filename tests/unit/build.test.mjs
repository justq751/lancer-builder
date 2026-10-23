import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts, coreData, plain, uiStrings } from "./load.mjs";
import { FULL_BUILD } from "../fixtures/builds.mjs";

// Fresh context per test: applyBuildState() writes into the global `state`.
function setup(extraL = {}) {
  const { L, M } = coreData();
  Object.assign(L, extraL);
  // i18n.js too: applyBuildState() words its "dropped" list with tText().
  const run = loadScripts(["js/core/i18n.js", "js/core/build.js", "js/core/rules.js"], { L, M, UI: uiStrings("ru"), UI_LANG: "ru" });
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

test("superheavy: a Heavy mount offers it only when a second mount is free to take", () => {
  const run = setup();
  run.ctx.m = [{ type: "Heavy", items: [] }, { type: "Main", items: [] }, { type: "Integrated", items: [] }];
  assert.ok(plain(run("mountAllows(m, 0)")).includes("Superheavy"));
  assert.deepEqual(plain(run("extraMountCandidates(m, 0)")), [1], "never an integrated mount");
  run.ctx.m = [{ type: "Heavy", items: [] }, { type: "Integrated", items: [] }];
  assert.ok(!plain(run("mountAllows(m, 0)")).includes("Superheavy"));
});

test("superheavy: the second mount is cleared, then holds nothing else", () => {
  const run = setup();
  run.ctx.m = [{ type: "Heavy", items: [] }, { type: "Main", items: [{ id: "mw_assault_rifle", mod: null }] }];
  run("m[0].items.push({ id: 'mw_siege_cannon', mod: null })");
  const lost = plain(run("claimExtraMount(m, 0, 0, 1)"));
  assert.deepEqual(lost, [{ id: "mw_assault_rifle", mod: null }]);
  assert.equal(run("m[0].items[0].extra"), 1);
  assert.deepEqual(plain(run("mountAllows(m, 1)")), []);
  assert.deepEqual(plain(run("extraOwner(m, 1)")), { mi: 0, wi: 0 });
  assert.deepEqual(plain(run("superheavyMissingExtra(m)")), []);
});

test("removeMountAt keeps superheavy links pointing at the same mounts", () => {
  const run = setup();
  run.ctx.m = [
    { type: "Main", items: [] }, { type: "Flex", items: [], cb: "cb_improved_armament" },
    { type: "Heavy", items: [{ id: "mw_siege_cannon", mod: null, extra: 0 }] },
    { type: "Superheavy", items: [{ id: "mw_tachyon_lance", mod: null, extra: 1 }], cb: "cb_superheavy_mounting" },
  ];
  const next = plain(run("removeMountAt(m, 1)"));
  assert.equal(next[1].items[0].extra, 0, "below the removed mount: unchanged");
  assert.equal(next[2].items[0].extra, undefined, "its second mount is gone");
});

test("planCoreMounts: Improved Armament adds a Flex only below three mounts; Integrated Weapon takes one Aux", () => {
  const run = setup();
  const plan = (frame, cores) => plain(run(`planCoreMounts(M.frame.${frame}, ${JSON.stringify(cores)}, buildMounts(M.frame.${frame}))`));
  assert.deepEqual(plan("mf_tortuga", ["cb_improved_armament"]).mounts.at(-1), { type: "Flex", items: [], cb: "cb_improved_armament" });
  assert.equal(plan("mf_blackbeard", ["cb_improved_armament"]).mounts.length, 3);
  run.ctx.m = plan("mf_blackbeard", ["cb_integrated_weapon"]).mounts;
  assert.deepEqual(run.ctx.m.at(-1), { type: "Integrated", items: [], cb: "cb_integrated_weapon" });
  assert.deepEqual(plain(run("mountAllows(m, 3)")), ["Auxiliary"]);
});

test("planCoreMounts: removing the bonus takes its mount away and names what was on it", () => {
  const run = setup();
  run.ctx.m = [{ type: "Main", items: [] }, { type: "Heavy", items: [] },
    { type: "Flex", items: [{ id: "mw_assault_rifle", mod: null }], cb: "cb_improved_armament" }];
  const { mounts, lost } = plain(run("planCoreMounts(M.frame.mf_tortuga, [], m)"));
  assert.equal(mounts.length, 2);
  assert.deepEqual(lost, [{ id: "mw_assault_rifle", mod: null }]);
  assert.equal(run.ctx.m.length, 3, "the input is not mutated");
});

test("Mount Retrofitting: a chosen mount becomes Main/Aux and gets its type back with the bonus", () => {
  const run = setup();
  run.ctx.m = [{ type: "Flex", items: [] }, { type: "Main", items: [] }, { type: "Heavy", items: [{ id: "mw_heavy_machine_gun", mod: null }] }];
  assert.deepEqual(plain(run("retrofitCandidates(m)")), [0, 1, 2]);
  const r = plain(run("retrofitMount(m, 2)"));
  assert.deepEqual(r.mounts[2], { type: "Main/Aux", items: [], retro: "Heavy" });
  assert.deepEqual(r.lost, [{ id: "mw_heavy_machine_gun", mod: null }], "a Heavy weapon does not fit Main/Aux");
  run.ctx.r = r.mounts;
  const back = plain(run("planCoreMounts(M.frame.mf_blackbeard, [], r)"));
  assert.deepEqual(back.mounts[2], { type: "Heavy", items: [] });
});

test("applyBuildState: an older save gets its bonus mounts; a broken superheavy link is dropped", () => {
  const run = setup();
  run.ctx.raw = {
    ...structuredClone(FULL_BUILD), cores: ["cb_improved_armament"],
    mech: { frameId: "mf_tortuga", systems: [], mounts: [
      { type: "Main", items: [{ id: "mw_assault_rifle", mod: null }] },
      { type: "Heavy", items: [{ id: "mw_siege_cannon", mod: null, extra: 0 }] },
    ] },
  };
  run("applyBuildState(raw)");
  const mounts = plain(run("state.mech.mounts"));
  assert.deepEqual(mounts.at(-1), { type: "Flex", items: [], cb: "cb_improved_armament" });
  assert.equal(mounts[1].items[0].extra, undefined, "mount 0 is not empty, so it cannot be the second mount");
  assert.deepEqual(plain(run("superheavyMissingExtra(state.mech.mounts)")), [{ mi: 1, wi: 0 }]);
});
