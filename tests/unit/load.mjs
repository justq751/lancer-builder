// Loads the browser's plain scripts into an isolated Node context, the way
// <script src> loads them into one page: top-level functions/consts land in a
// shared global scope. Production code needs no export statements for this.
import vm from "node:vm";
import { readFileSync } from "node:fs";

const ROOT = new URL("../../", import.meta.url);
export const readJSON = rel => JSON.parse(readFileSync(new URL(rel, ROOT), "utf8"));

/**
 * @param {string[]} files  e.g. ["js/core/build.js"], loaded in order
 * @param {object} globals  extra globals (L, M, state, …) set before loading
 * @returns {(expr: string) => any}  evaluate an expression in that context
 */
export function loadScripts(files, globals = {}) {
  const ctx = vm.createContext({
    console, structuredClone, TextEncoder, TextDecoder,
    CompressionStream, DecompressionStream, Blob, Response, btoa, atob,
    ...globals,
  });
  for (const f of files) vm.runInContext(readFileSync(new URL(f, ROOT), "utf8"), ctx, { filename: f });
  const run = expr => vm.runInContext(expr, ctx);
  run.ctx = ctx;
  return run;
}

/** Core dataset (no packs) indexed the way rebuildIndexes() does it. */
export function coreData() {
  const L = readJSON("data/lancer-data.json");
  L.core_stat_mods = readJSON("data/core_bonus_stat_mods.json");
  const byId = arr => Object.fromEntries((arr || []).map(x => [x.id, x]));
  const M = {
    frame: byId(L.frames), weapon: byId(L.weapons), system: byId(L.systems),
    talent: byId(L.talents), skill: byId(L.skills), core: byId(L.core_bonuses),
    gear: byId(L.pilot_gear), bg: byId(L.backgrounds), mod: byId(L.mods),
  };
  return { L, M };
}

/** JSON round-trip: values coming out of the vm context have a foreign
 *  Object prototype, which deepStrictEqual rejects. */
export const plain = v => JSON.parse(JSON.stringify(v));

/** The interface strings as the app holds them for `lang` (UI global): the
 *  English data/ui.json, with locales/ru/ui.json laid over it for "ru".
 *  Uses the app's own overlayUiStrings() from js/core/i18n.js. */
export function uiStrings(lang = "ru") {
  const run = loadScripts(["js/core/i18n.js"]);
  run.ctx.en = readJSON("data/ui.json");
  run.ctx.ru = lang === "ru" ? readJSON("locales/ru/ui.json") : null;
  return JSON.parse(JSON.stringify(run("overlayUiStrings(en, ru)")));
}
