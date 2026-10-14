// Build fixtures, in the exact shape `state` has (see defaultState() in
// index.html). Ids are real ones from data/lancer-data.json + data/packs.

/** A build that touches every part of the state, legal at LL3. */
export const FULL_BUILD = {
  pilot: { name: "Тест Пилотов", callsign: "ГОЛЕМ", background: "pbg_colonist", ll: 3 },
  skills: { sk_assault: 2, sk_act_unseen_or_unheard: 4, cs_kick_doors: 2 },
  customSkills: [{ id: "cs_kick_doors", name: "Выбивать двери", description: "Собственный триггер пилота." }],
  talents: { t_ace: 2, t_brawler: 1 },
  hase: { hull: 2, agility: 1, systems: 2, engineering: 0 },
  licenses: { Blackbeard: 1, Nelson: 2 },
  gear: { armor: "pg_assault_hardsuit", weapons: ["pg_archaic_melee"], gear: ["pg_patch", "pg_stims"] },
  cores: ["cb_auto_stabilizing_hardpoints"],
  mech: {
    frameId: "mf_blackbeard",
    mounts: [
      { type: "Flex", items: [{ id: "mw_chain_axe", mod: "wm_thermal_charge" }] },
      { type: "Main", items: [{ id: "mw_assault_rifle", mod: null }] },
      { type: "Heavy", items: [{ id: "mw_heavy_machine_gun", mod: null }] },
    ],
    systems: ["ms_synthetic_muscle_netting", "ms_custom_paint_job", "ms_personalizations"],
  },
};

/** Saved before migrateWeaponSlots()/migrateLicenseKeys() existed:
 *  weapon slots are bare id strings, and a variant frame (Störtebeker,
 *  variant of Raleigh, from the Dustgrave pack) has its own license key. */
export const LEGACY_BUILD = {
  pilot: { name: "", callsign: "СТАРЫЙ", background: "", ll: 2 },
  skills: {},
  talents: {},
  hase: { hull: 0, agility: 0, systems: 0, engineering: 0 },
  licenses: { "Störtebeker": 2 },
  gear: { armor: null, weapons: [], gear: [] },
  cores: [],
  mech: {
    frameId: "mf_standard_pattern_i_everest",
    mounts: [
      { type: "Main", items: ["mw_assault_rifle"] },
      { type: "Flex", items: ["mw_charged_blade"] },
      { type: "Heavy", items: ["mw_howitzer"] },
    ],
    systems: [],
  },
};

/** References content this dataset does not have (another pack, homebrew). */
export const UNKNOWN_IDS_BUILD = {
  ...structuredClone(FULL_BUILD),
  talents: { t_ace: 1, t_homebrew_does_not_exist: 2 },
  mech: {
    frameId: "mf_blackbeard",
    mounts: [
      { type: "Flex", items: [{ id: "mw_does_not_exist", mod: null }] },
      { type: "Main", items: [{ id: "mw_assault_rifle", mod: "wm_does_not_exist" }] },
      { type: "Heavy", items: [] },
    ],
    systems: ["ms_custom_paint_job", "ms_does_not_exist"],
  },
};

/** Wraps a state the way saveBuildNow() writes it to localStorage. */
export function savedEnvelope(state, savedAt = "2026-01-01T12:00:00.000Z") {
  return { _app: "lancer-registry", v: 1, savedAt, state };
}
