import runtime from "../generated/runtime-data.js";
import labels from "../generated/ui-labels.js";
import { overlay, registerBabele, refreshIndexes } from "./overlay.js";
import { translateSheetLabels, translateMechPreview, translateMechLoadout, translateStabilizeDialog, translateOverheatChat, translateStructureChat } from "./ui.js";
import { observeRollHuds } from "./roll-hud.js";
import { observeAutomations, translateFormatData } from "./automations.js";

const ID = "lancer-ru-content";
const russianLancer = () => game.system.id === "lancer" && game.i18n.lang === "ru";
const russianAutomations = () => russianLancer() && game.modules?.get("lancer-automations")?.active;

function statusName(name, ids) {
  for (const id of ids) {
    const pair = runtime.statusNames[id];
    if (!pair) continue;
    const key = `lancer.statusIconsNames.${id}`;
    if (pair.en.includes(name) || name === pair.ru || name === key || name === game.i18n.localize(key)) return pair.en[0];
  }
  return name;
}

function preserveStatusNames() {
  if (!russianAutomations()) return;
  // LANCER rebuilds this list from Babele-translated items on compendium/world changes.
  for (const status of CONFIG.statusEffects) status.name = statusName(status.name, [status.id]);
}

Hooks.on("lancer.statusesReady", preserveStatusNames);
Hooks.on("preCreateActiveEffect", effect => {
  if (!russianAutomations()) return;
  const name = statusName(effect.name, effect.statuses);
  if (name !== effect.name) effect.updateSource({ name });
});

Hooks.once("i18nInit", () => {
  // Apply after language files so ru-ru's load order cannot replace the builder term.
  if (russianLancer()) game.i18n.translations.lancer.statusIconsNames.exposed = labels.statusIconsNames.exposed;
  // Some LA.* strings get raw data values such as a mount type ("{type} Mount").
  if (russianAutomations()) {
    libWrapper.register(ID, "game.i18n.format", function (wrapped, key, data) {
      return wrapped(key, translateFormatData(key, data));
    }, "WRAPPER");
  }
});

Hooks.once("ready", () => {
  if (russianLancer()) observeRollHuds(document);
  if (russianAutomations()) {
    preserveStatusNames();
    observeAutomations(document);
  }
});

Hooks.once("babele.init", babele => {
  if (game.system.id === "lancer") registerBabele(babele);
});

Hooks.once("setup", () => {
  if (game.system.id !== "lancer") return;
  for (const field of ["type", "system.lid"]) {
    if (!CONFIG.Item.compendiumIndexFields.includes(field)) CONFIG.Item.compendiumIndexFields.push(field);
  }
  // Tag.save() serializes only lid/val; translating the hydrated Tag cannot persist text.
  libWrapper.register(ID, "CONFIG.Item.dataModels.mech_system.schema.fields.tags.element.constructor.prototype.initialize", function (wrapped, ...args) {
    const tag = wrapped(...args);
    if (russianLancer() && tag?.lid) {
      const translated = overlay(tag, runtime.tags[tag.lid]);
      tag.name = translated.name;
      tag.description = translated.description;
    }
    return tag;
  }, "WRAPPER");
});

Hooks.on("createCompendium", () => {
  // LCP Manager can create world packs after Babele has materialized its session.
  if (russianLancer()) ui.notifications.info("LANCER RU: после импорта LCP перезагрузите страницу для перевода новых справочников.");
});

Hooks.on("babele.ready", async () => {
  if (!russianLancer()) return;
  try {
    await refreshIndexes(game.packs, game.babele);
  } catch (error) {
    console.error("LANCER RU: failed to load translated indexes", error);
    ui.notifications.error("LANCER RU: не удалось загрузить перевод списка справочников. Подробности в консоли.");
  }
});

Hooks.on("renderDialog", (app, html) => {
  if (!russianLancer()) return;
  if (translateStabilizeDialog(app.element?.[0] ?? html[0] ?? html)) app.setPosition({ height: "auto" });
});

Hooks.on("renderChatMessageHTML", (_message, html) => {
  if (!russianLancer()) return;
  translateOverheatChat(html);
  translateStructureChat(html);
});

// Foundry 13 ends each sheet's render hook chain at ActorSheet or ItemSheet.
for (const hook of ["renderActorSheet", "renderItemSheet"]) {
  Hooks.on(hook, (app, html) => {
    if (!russianLancer()) return;
    const root = html[0] ?? html;
    if (app.item?.type === "frame") translateSheetLabels(root);
    if (app.actor?.type === "pilot") translateMechPreview(root);
    if (app.actor?.type === "mech") translateMechLoadout(root);
  });
}
