// derived(): the numbers the player actually reads. Expected values are
// worked out by hand from the rules, not copied from the app's output.
import { test, expect } from "@playwright/test";
import { FULL_BUILD } from "./fixtures/builds.mjs";
import { openApp } from "./helpers.mjs";

test("derived stats of the reference build", async ({ page }) => {
  await openApp(page, { build: FULL_BUILD });
  const d = await page.evaluate(() => { const d = derived(); return { ll: d.ll, grit: d.grit, b: d.b, mech: d.mech, sp: d.sp }; });

  // LL3 → GRIT = ceil(3/2) = 2
  expect(d.ll).toBe(3);
  expect(d.grit).toBe(2);
  expect(d.b).toEqual({
    skill:   { cap: 4 + 3, used: (2 + 4 + 2) / 2 }, // skill ranks cost 1 point per +2
    talent:  { cap: 3 + 3, used: 2 + 1 },
    hase:    { cap: 2 + 3, used: 2 + 1 + 2 + 0 },
    license: { cap: 3,     used: 1 + 2 },
    core:    { cap: 1,     used: 1 },               // floor(LL/3)
  });

  // Blackbeard base: hp 12, evasion 8, edef 6, heat 4, repcap 5, tech -2,
  // save 10, speed 5, sp 5, armor 1, size 1. HASE: hull 2, agility 1, systems 2.
  expect(d.mech).toEqual({
    size: 1, structure: 4, stress: 4,
    armor: 1,                       // Auto-Stabilizing Hardpoints adds no armor
    hp: 12 + 2 + 2 * 2 + 2,         // base + grit + 2×hull + Personalizations
    repcap: 5 + Math.floor(2 / 2),  // + hull/2
    evasion: 8 + 1,                 // + agility
    speed: 5 + Math.floor(1 / 2),   // + agility/2
    edef: 6 + 2,                    // + systems
    tech_attack: -2 + 2,            // + systems
    heatcap: 4 + 0,                 // + engineering
    sensor_range: 5,
    save: 10 + 2,                   // + grit
    sp: 5 + Math.floor(2 / 2),      // + systems/2
    limited_bonus: 0,               // engineering/2
    attack: 2,                      // grit
  });
  // Muscle Netting 2 + Paint Job 1 + Personalizations 1 + Thermal Charge mod 2
  expect(d.sp).toEqual({ cap: 6, used: 6 });
});

test("budget caps grow with license level", async ({ page }) => {
  await openApp(page);
  const rows = await page.evaluate(() => [0, 1, 2, 3, 6, 12].map(ll => {
    state.pilot.ll = ll;
    const d = derived();
    return [ll, d.grit, d.b.skill.cap, d.b.talent.cap, d.b.hase.cap, d.b.license.cap, d.b.core.cap, talentRankCap(ll)];
  }));
  //        LL grit skill talent hase lic core rankCap
  expect(rows).toEqual([
    [0,  0,  4,  3,  2,  0, 0, 1],
    [1,  1,  5,  4,  3,  1, 0, 2],
    [2,  1,  6,  5,  4,  2, 0, 3],
    [3,  2,  7,  6,  5,  3, 1, 3],
    [6,  3, 10,  9,  8,  6, 2, 3],
    [12, 6, 16, 15, 14, 12, 4, 3],
  ]);
});
