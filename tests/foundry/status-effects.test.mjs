import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { overlay } from "../../foundry/lancer-ru-content/scripts/overlay.js";
import runtime from "../../foundry/lancer-ru-content/generated/runtime-data.js";

const hooks = new Map();
globalThis.Hooks = {
  on(name, fn) { hooks.set(name, fn); },
  once() {},
};
globalThis.game = {
  system: { id: "lancer" },
  i18n: { lang: "ru", localize: key => key === "lancer.statusIconsNames.invisible" ? "Невидимость" : key },
  modules: new Map([["lancer-automations", { active: true }]]),
};
await import("../../foundry/lancer-ru-content/scripts/main.js");
const entries = JSON.parse(readFileSync(new URL("../../foundry/lancer-ru-content/compendium/world.status-items.json", import.meta.url))).entries;

test("translated compendium statuses remain findable by automations' English name", () => {
  const entry = entries["status:invisible"];
  const effect = { id: "invisible", name: overlay("Invisible", entry.name), changes: [{ key: "test", value: "1" }] };
  globalThis.CONFIG = { statusEffects: [effect] };
  hooks.get("lancer.statusesReady")?.();
  assert.equal(CONFIG.statusEffects.find(s => s.name === "Invisible")?.id, "invisible");
  assert.deepEqual(effect.changes, [{ key: "test", value: "1" }]);
});

test("new localized effects keep English identity without changing mechanics or custom names", () => {
  globalThis.CONFIG = { statusEffects: [{ id: "invisible", name: "Invisible" }] };
  for (const [name, expected] of [["Невидим", "Invisible"], ["Невидимость", "Invisible"], ["My cloak", "My cloak"]]) {
    const effect = { name, statuses: new Set(["invisible"]), updateSource(data) { Object.assign(this, data); } };
    hooks.get("preCreateActiveEffect")?.(effect);
    assert.equal(effect.name, expected);
    assert.deepEqual([...effect.statuses], ["invisible"]);
  }
});

test("every exported status survives keys, translations and repeated list rebuilds", () => {
  for (const [id, pair] of Object.entries(runtime.statusNames)) {
    for (const name of [pair.ru, `lancer.statusIconsNames.${id}`, pair.en[0]]) {
      globalThis.CONFIG = { statusEffects: [{ id, name }] };
      hooks.get("lancer.statusesReady")();
      assert.equal(CONFIG.statusEffects[0].name, pair.en[0], id);
    }
  }
  globalThis.CONFIG = { statusEffects: [{ id: "invisible", name: "My cloak" }, { id: "homebrew", name: "Невидим" }] };
  hooks.get("lancer.statusesReady")();
  assert.deepEqual(CONFIG.statusEffects.map(s => s.name), ["My cloak", "Невидим"]);
});

test("English, other systems and worlds without automations retain their data", () => {
  for (const [lang, system, active] of [["en", "lancer", true], ["ru", "other", true], ["ru", "lancer", false]]) {
    game.i18n.lang = lang;
    game.system.id = system;
    game.modules.get("lancer-automations").active = active;
    globalThis.CONFIG = { statusEffects: [{ id: "invisible", name: "Невидим" }] };
    hooks.get("lancer.statusesReady")();
    assert.equal(CONFIG.statusEffects[0].name, "Невидим");
  }
  game.i18n.lang = "ru";
  game.system.id = "lancer";
  game.modules.get("lancer-automations").active = true;
});
