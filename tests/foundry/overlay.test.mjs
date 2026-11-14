import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { overlay, translateText, registerBabele, refreshIndexes } from "../../foundry/lancer-ru-content/scripts/overlay.js";
import { translateLabel } from "../../foundry/lancer-ru-content/scripts/ui.js";
import runtime from "../../foundry/lancer-ru-content/generated/runtime-data.js";

const pack = name => JSON.parse(readFileSync(new URL(`../../foundry/lancer-ru-content/compendium/world.${name}.json`, import.meta.url)));
const pair = (en, ru) => ({ en: [en], ru });

test("text guards preserve changed English, homebrew, empty and stale translations", () => {
  assert.equal(translateText("old", pair("old", "новое")), "новое");
  for (const p of [pair("new", "новое"), pair("old", ""), { ...pair("old", "новое"), stale: true }, null]) {
    assert.equal(translateText("old", p), "old");
  }
  assert.equal(translateText(null, pair("old", "новое")), null);
});

test("Foundry HTML serialization and REPAIRS emphasis do not block Balor translations", () => {
  const entry = pack("mech-items").entries["frame:mf_balor"];
  const actualDescription = entry.content.description.en[0].replaceAll("<br>", "<br/>");
  assert.equal(translateText(actualDescription, entry.content.description), entry.content.description.ru);
  const trait = entry.content.traits.$items["Self-Perpetuating"];
  assert.equal(translateText("When you rest, the Balor regains full HP automatically and without REPAIRS.", trait.description), trait.description.ru);
  assert.equal(translateText("The Balor deals 3 kinetic.", entry.content.traits.$items["Scouring Swarm"].description), "The Balor deals 3 kinetic.");
});

test("nested overlays keep mechanics, ordering, missing fields and renamed user content", () => {
  const value = { lid: "test", ranks: [
    { name: "B", description: "second", bonuses: [{ val: "1d6" }], actions: [{ lid: "act_test" }] },
    { name: "A", description: "first", curr_rank: 2 },
    { name: "Custom", description: "user text" },
  ] };
  const original = structuredClone(value);
  const tree = { lid: null, nonexistent: pair("", "x"), ranks: { $items: {
    A: { name: pair("A", "А"), description: pair("first", "первый") },
    B: { name: pair("B", "Б"), description: pair("second", "второй") },
  } } };
  const translated = overlay(value, tree);
  assert.deepEqual(value, original);
  assert.deepEqual(translated.ranks.map(r => r.name), ["Б", "А", "Custom"]);
  assert.deepEqual(translated.ranks[0].bonuses, original.ranks[0].bonuses);
  assert.deepEqual(translated.ranks[0].actions, original.ranks[0].actions);
  assert.equal(translated.ranks[1].curr_rank, 2);
  assert.ok(!Object.hasOwn(translated, "nonexistent"));
  assert.deepEqual(overlay(translated, tree), translated);
  const duplicates = [value.ranks[0], value.ranks[0]];
  assert.deepEqual(overlay(duplicates, tree.ranks), duplicates);
});

test("real ordinary weapon translates inside its generated profile and preserves attack data", () => {
  const entries = pack("mech-items").entries;
  const entry = entries["mech_weapon:mw_assault_rifle"];
  assert.ok(entry);
  const profile = Object.values(entry.content.profiles.$items)[0];
  const system = { lid: "mw_assault_rifle", selected_profile_index: 0, license: "GMS", uses: { value: 3, max: 4 }, profiles: [{
    name: "Assault Rifle", effect: "", on_hit: "", on_crit: "", on_attack: "",
    damage: [{ type: "Kinetic", val: "1d6" }], tags: [{ lid: "tg_reliable", val: "2" }],
    range: [{ type: "Range", val: 10 }], actions: [], bonuses: [],
  }] };
  const translated = overlay(system, entry.content);
  assert.equal(translated.profiles[0].name, profile.name.ru);
  assert.deepEqual(translated.profiles[0].damage, system.profiles[0].damage);
  assert.deepEqual(translated.profiles[0].tags, system.profiles[0].tags);
  assert.deepEqual(translated.uses, system.uses);
  assert.equal(translated.license, system.license);
  assert.equal(translated.lid, system.lid);
});

test("real multi-profile weapon translates by name after profile reorder", () => {
  const entry = pack("mech-items").entries["mech_weapon:mw_leviathan_heavy_assault_cannon"];
  const profiles = Object.entries(entry.content.profiles.$items).reverse().map(([name, tree]) => ({
    name, effect: tree.effect?.en[0] ?? "", damage: [{ type: "Kinetic", val: "2d6" }],
  }));
  const translated = overlay({ profiles }, entry.content);
  assert.deepEqual(translated.profiles.map(p => p.name), Object.values(entry.content.profiles.$items).reverse().map(t => t.name.ru));
  assert.deepEqual(translated.profiles.map(p => p.damage), profiles.map(p => p.damage));
});

test("status aliases and ActiveEffect text keep changes intact", () => {
  const entries = pack("status-items").entries;
  assert.deepEqual(entries["status:shutdown"], entries["status:shut-down"]);
  const entry = entries["status:stunned"];
  const changes = [{ key: "system.evasion", mode: 5, value: "5" }];
  const effects = [{ name: "Stunned", description: entry.content.effects.en[0], changes }];
  const translated = overlay(effects, entry.statusEffects);
  assert.equal(translated[0].name, entry.name.ru);
  assert.deepEqual(translated[0].changes, changes);
});

test("hydrated tags translate placeholders without changing serialization or numeric values", () => {
  class Tag {
    constructor() { this.lid = "tg_burn"; this.val = "3"; this.name = "Burn {VAL}"; this.description = runtime.tags.tg_burn.description.en[0]; }
    save() { return { lid: this.lid, val: this.val }; }
  }
  const tag = new Tag();
  const original = tag.save();
  Object.assign(tag, overlay(tag, runtime.tags[tag.lid]));
  assert.match(tag.name, /\{VAL\}/);
  assert.equal(tag.name.replace("{VAL}", tag.val), "Огонь 3");
  assert.deepEqual(tag.save(), original);
  assert.equal(tag.constructor, Tag);
});

test("Babele registrations use typed LID, guarded converters, and Russian-only source", () => {
  const calls = {};
  registerBabele({
    registerIdentityExtractor: (name, fn) => { calls.extract = fn; },
    registerConverters: value => { calls.converters = value; },
    registerMapping: value => { calls.mapping = value; },
    register: value => { calls.source = value; },
  });
  assert.equal(calls.extract({ name: "custom", type: "frame", system: { lid: "mf_everest" } }), "frame:mf_everest");
  assert.equal(calls.extract({ type: "frame", name: "Everest" }), null);
  assert.equal(calls.converters.lancerRuContent, overlay);
  assert.equal(calls.mapping.Item.content.path, "system");
  assert.equal(calls.source.lang, "ru");
});

test("initial indexes request LIDs before translating and refresh open compendium apps", async () => {
  const entry = pack("mech-items").entries["frame:mf_balor"];
  const index = [{ _id: "random", name: "Balor", type: "frame" }];
  let rendered = 0, tree = 0, invalidated = 0;
  const packs = new Map([["world.mech-items", {
    index, apps: { test: { render: () => rendered++ } }, initializeTree: () => tree++,
    getIndex: async ({ fields }) => {
      assert.deepEqual(fields, ["type", "system.lid"]);
      index[0].system = { lid: "mf_balor" };
    },
  }]]);
  await refreshIndexes(packs, {
    invalidateCaches: () => invalidated++,
    translatedCompendiumFor: () => ({ translateIndex: rows => {
      assert.equal(rows[0].system.lid, "mf_balor");
      rows[0].name = translateText(rows[0].name, entry.name);
    } }),
  });
  assert.equal(index[0].name, "Балор");
  assert.deepEqual([rendered, tree, invalidated], [1, 1, 1]);
});

test("frame UI covers uppercase helper arguments without altering mount values", () => {
  const lang = JSON.parse(readFileSync(new URL("../../foundry/lancer-ru-content/lang/ru.json", import.meta.url)));
  for (const key of ["HP", "ARMOR", "REPAIRS", "EVASION", "E-DEF", "HEAT CAP", "SPEED", "TECH ATK", "SENSORS", "SAVE", "SYS POINTS", "SIZE"]) {
    assert.ok(lang.lancer["common-sheet"].shortStats[key]);
  }
  assert.equal(translateLabel("  // BONUSES "), "  // БОНУСЫ ");
  assert.equal(translateLabel("AVAILABLE WEAPON MOUNTS"), "ДОСТУПНЫЕ ОРУЖЕЙНЫЕ КРЕПЛЕНИЯ");
  assert.equal(translateLabel("MAIN"), "ОСНОВНОЕ");
  assert.equal(translateLabel("Player's custom name"), "Player's custom name");
  assert.equal(translateLabel("CORE SYSTEM"), "CORE-СИСТЕМА");
  assert.equal(translateLabel("INTEGRATED"), "ИНТЕГРИРОВАННОЕ");
  assert.equal(translateLabel("  // MAIN/AUX "), "  // ОСНОВНОЕ/ВСПОМ. ");
});

test("merged UI retains every patch key and uses builder terminology", () => {
  const lang = JSON.parse(readFileSync(new URL("../../foundry/lancer-ru-content/lang/ru.json", import.meta.url))).lancer;
  const common = lang["common-sheet"];
  assert.ok(common.headers.combatUtilities);
  for (const key of ["basicAttack", "damage", "fullRepair", "overheat", "scan", "stabilize", "structure", "tech"]) {
    assert.ok(common.buttons[key], key);
  }
  for (const key of ["hull", "agi", "sys", "eng", "level", "grit", "tier", "activations", "hp", "evasion", "armor",
    "structure", "heat", "heatcap", "edef", "stress", "speed", "save", "sensor_range", "tech_attack", "overcharge",
    "burn", "overshield", "repairs", "size", "cost"]) {
    assert.ok(common.shortStats[key], key);
  }
  assert.ok(lang["deployable-sheet"].header.owner);
  assert.ok(lang["mech-sheet"].header["inactive-warning"]);
  assert.ok(lang["npc-sheet"].header.templates);
  assert.ok(lang["pilot-sheet"]["cloud-download"].description);
  assert.ok(lang["pilot-sheet"]["json-import"].description);
  assert.ok(lang["pilot-sheet"]["json-import"].placeholder);
  assert.equal(lang["pilot-sheet"].dossier.background, "ПРОИСХОЖДЕНИЕ");
  assert.equal(common.shortStats.grit, "GRIT");
  assert.equal(common.shortStats.overcharge, "ФОРСАЖ");
  assert.equal(common.shortStats.overshield, "ОВЕРШИЛД");
  assert.equal(common.shortStats.burn, "ОГОНЬ");
  assert.equal(common.shortStats["e-def"], common.shortStats["E-DEF"]);
  const manifest = JSON.parse(readFileSync(new URL("../../foundry/lancer-ru-content/module.json", import.meta.url)));
  assert.ok(!manifest.relationships.recommends.some(module => module.id === "lancer-ru-ui-patch"));
  assert.equal(manifest.languages[0].system, "lancer");
  assert.equal(manifest.languages[0].lang, "ru");
});
