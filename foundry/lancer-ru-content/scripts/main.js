import runtime from "../generated/runtime-data.js";
import { overlay, registerBabele, refreshIndexes } from "./overlay.js";
import { translateSheetLabels, translateMechPreview } from "./ui.js";

const ID = "lancer-ru-content";
const russianLancer = () => game.system.id === "lancer" && game.i18n.lang === "ru";

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

// Foundry 13 ends each sheet's render hook chain at ActorSheet or ItemSheet.
for (const hook of ["renderActorSheet", "renderItemSheet"]) {
  Hooks.on(hook, (app, html) => {
    if (!russianLancer()) return;
    const root = html[0] ?? html;
    if (app.item?.type === "frame") translateSheetLabels(root);
    if (app.actor?.type === "pilot") translateMechPreview(root);
  });
}
