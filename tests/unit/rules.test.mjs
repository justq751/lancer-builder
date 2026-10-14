import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts, coreData, plain } from "./load.mjs";
import { FULL_BUILD } from "../fixtures/builds.mjs";

function withState(state) {
  const { L, M } = coreData();
  return loadScripts(["js/core/build.js", "js/core/rules.js"], { L, M, state: structuredClone(state) });
}

test("derived(): the reference build, worked out by hand", () => {
  const d = plain(withState(FULL_BUILD)("derived()"));
  assert.equal(d.ll, 3);
  assert.equal(d.grit, 2);
  assert.deepEqual(d.b, {
    skill: { cap: 7, used: 4 }, talent: { cap: 6, used: 3 }, hase: { cap: 5, used: 5 },
    license: { cap: 3, used: 3 }, core: { cap: 1, used: 1 },
  });
  // Blackbeard hp 12 + grit 2 + 2×hull 2 + Personalizations 2
  assert.equal(d.mech.hp, 20);
  assert.equal(d.mech.evasion, 9);
  assert.equal(d.mech.edef, 8);
  assert.equal(d.mech.save, 12);
  // Muscle Netting 2 + Paint Job 1 + Personalizations 1 + Thermal Charge mod 2
  assert.deepEqual(d.sp, { cap: 6, used: 6 });
});

test("derived(): no frame → no mech block", () => {
  const run = withState(withState({})("defaultState()"));
  const d = plain(run("derived()"));
  assert.equal(d.mech, null);
  assert.deepEqual(d.sp, { cap: 0, used: 0 });
});

test("talentRankCap: rank 2 at LL1, rank 3 from LL2", () => {
  const run = withState(FULL_BUILD);
  assert.deepEqual([0, 1, 2, 3, 12].map(ll => run(`talentRankCap(${ll})`)), [1, 2, 3, 3, 3]);
});

test("unlocked / frameUnlocked follow license ranks; GMS is always open", () => {
  const run = withState({ ...FULL_BUILD, licenses: { Blackbeard: 1 } });
  assert.equal(run("unlocked(M.weapon.mw_assault_rifle)"), true, "GMS");
  assert.equal(run("unlocked(M.weapon.mw_chain_axe)"), true, "Blackbeard L1");
  assert.equal(run("unlocked(M.weapon.mw_nanocarbon_sword)"), false, "Blackbeard L2");
  assert.equal(run("frameUnlocked(M.frame.mf_blackbeard)"), false, "frame needs rank 2");
  assert.equal(run("frameUnlocked(M.frame.mf_standard_pattern_i_everest)"), true);
});

test("coreBonusUnlocked needs rank 3 in some frame of that manufacturer", () => {
  const ipsn = withState(FULL_BUILD)("L.core_bonuses.find(c => c.source === 'IPS-N').id");
  assert.equal(withState({ ...FULL_BUILD, licenses: { Blackbeard: 2 } })(`coreBonusUnlocked(M.core.${ipsn})`), false);
  assert.equal(withState({ ...FULL_BUILD, licenses: { Blackbeard: 3 } })(`coreBonusUnlocked(M.core.${ipsn})`), true);
});

test("pickerOrder: unlocked first, then manufacturer order, then name", () => {
  const run = withState({ ...FULL_BUILD, licenses: {} });
  const ids = plain(run(`[M.weapon.mw_chain_axe, M.weapon.mw_howitzer, M.weapon.mw_assault_rifle].sort(pickerOrder).map(w => w.id)`));
  assert.deepEqual(ids, ["mw_assault_rifle", "mw_howitzer", "mw_chain_axe"]);
});
