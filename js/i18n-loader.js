/* =================================================================
   LANCER // REGISTRY — I18N DATA LOADER
   -----------------------------------------------------------------
   Loads the canonical (English) game data from data/lancer-data.json
   and, if a translation exists, overlays it with locales/<lang>/*.json.

   IMPORTANT — why some fields are never translated in-place:
   A few fields double as *logic keys*, not just display text:
     - frame.name is used to key licenses (state.licenses[frame.name])
       and to match weapons/systems to their unlocking frame
       (item.license === frame.name). Translating it would silently
       break license unlocking, so it is intentionally left in English.
       Variant frames (frame.variant set, e.g. Enkidu -> "Tokugawa")
       key off frame.variant instead — see licenseKeyFor() — so they
       share their base frame's license rank rather than tracking their
       own; frame.variant is likewise left untranslated for the same
       reason.
     - mount/type/source/tags/mechtype values (e.g. "Main", "Rifle",
       "GMS", "Reliable 2") are compared literally elsewhere in the
       app logic (mount-matching, filters, source colors). These are
       NEVER mutated on the data objects — they are translated only
       at render time via tr()/trTag(), defined below, using the
       shared locales/<lang>/enums.json dictionary.
   Everything else (description, effect, detail, terse, trait/rank
   text, core system text, on_hit/on_attack/on_crit) is pure prose
   and is safely overlaid in place.
   ================================================================= */

let ENUMS = null;                 // parsed locales/<lang>/enums.json
let currentLang = localStorage.getItem("lancer_lang") || "ru";

const LOCALE_CATEGORY_FILES = [
  "enums", "frames", "weapons", "systems", "talents",
  "skills", "core_bonuses", "pilot_gear", "backgrounds", "manufacturers", "tags", "glossary", "stat_labels", "mods"
];

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("HTTP " + r.status + " for " + url);
  return r.json();
}

/* Additional community/official content packs merged into the core data.
   Each pack file is pre-normalized (see tools/normalize_pack.py) into the
   same flat shape as data/lancer-data.json, so no renderer changes are
   needed. Packs only cover categories the app already has a UI for
   (frames/weapons/systems/talents/pilot_gear/core_bonuses/mods) — pack
   categories with no app support (e.g. reserves, environments) are
   intentionally omitted; see README. */
const CONTENT_PACKS = [
  "data/packs/osr-data.json", "data/packs/wallflower-data.json",
  "data/packs/ows-data.json", "data/packs/long-rim-data.json",
  "data/packs/dustgrave-data.json", "data/packs/ktb-data.json",
  "data/packs/sotw-data.json", "data/packs/ssmr-data.json",
];
/* Packs that failed to load on the last loadBaseData() — "DUSTGRAVE", … A
   missing pack makes its content look nonexistent, so anything built on it
   would be dropped on restore; startApp() uses this to tell a network hiccup
   from content that really is gone, and to keep autosave off the stored
   build until the data is complete again. */
let PACK_LOAD_FAILURES = [];
const packLabel = url => url.replace(/^.*\//, "").replace(/-data\.json$/, "").toUpperCase();

async function loadBaseData() {
  try {
    // One wave, not fifteen. These files do not depend on each other, and
    // awaiting them in sequence cost eight round-trips before the packs even
    // started — invisible on localhost, roughly a second on mobile data.
    // Only lancer-data.json is allowed to reject: without it there is no app,
    // and the catch below explains the file:// case. Everything else degrades
    // to an empty default the way it always did.
    const soft = (url, fallback) => fetchJSON(url).catch(e => {
      console.warn(url + " failed to load:", e); return fallback;
    });
    const [core, tags, glossary, stat_labels, core_stat_mods, core_terse, frame_images, ...packs] =
      await Promise.all([
        fetchJSON("data/lancer-data.json"),
        soft("data/tags.json", []),
        soft("data/glossary.json", {}),
        soft("data/stat_labels.json", {}),
        soft("data/core_bonus_stat_mods.json", {}),
        soft("data/core_bonus_terse.json", {}),
        // Map of frame id -> official portrait URL (hosted on Massif Press's
        // own CDN, not bundled here — see data/frame_images.json for why
        // these are linked rather than downloaded).
        soft("data/frame_images.json", {}),
        ...CONTENT_PACKS.map(p => soft(p, null)),
      ]);
    Object.assign(core, { tags, glossary, stat_labels, core_stat_mods, core_terse, frame_images });
    PACK_LOAD_FAILURES = CONTENT_PACKS.filter((url, i) => !packs[i]).map(packLabel);
    for (const pack of packs) {
      if (!pack) continue;
      for (const cat of ["frames", "weapons", "systems", "talents", "pilot_gear", "core_bonuses", "mods"]) {
        if (pack[cat] && pack[cat].length) core[cat] = (core[cat] || []).concat(pack[cat]);
      }
    }
    return core;
  } catch (e) {
    document.body.innerHTML =
      "<div style='padding:40px;font-family:monospace;color:#e5604f'>" +
      "Не удалось загрузить data/lancer-data.json.<br><br>" +
      "Если вы открыли index.html прямо из файловой системы (file://), " +
      "браузер блокирует fetch() локальных файлов. Запустите локальный сервер, например:<br><br>" +
      "<code>python3 -m http.server</code><br><br>" +
      "…в папке проекта и откройте http://localhost:8000/ — подробнее в README.md." +
      "</div>";
    throw e;
  }
}

async function loadLocaleFiles(lang) {
  if (lang === "en") return null; // base data already IS the English text
  const out = {};
  await Promise.all(LOCALE_CATEGORY_FILES.map(async (name) => {
    try { out[name] = await fetchJSON(`locales/${lang}/${name}.json`); }
    catch (e) { out[name] = {}; }
  }));
  return out;
}

/* localizeData() and its overlay helpers: js/core/i18n.js */

/* ---- enum / tag translation used ONLY at render time (see comment above) ---- */
function tr(word) {
  if (currentLang === "en" || !ENUMS || word == null) return word;
  for (const catKey in ENUMS) {
    if (catKey === "_comment") continue;
    const cat = ENUMS[catKey];
    if (cat[word]) return cat[word][currentLang] || word;
  }
  return word;
}
function trTag(tag) {
  if (currentLang === "en" || !ENUMS || tag == null) return tag;
  const dict = ENUMS.tag_words || {};
  if (dict[tag]) return dict[tag][currentLang] || tag;
  // "N/Round", "N/Turn" — number comes first, word comes after the slash
  const slashM = String(tag).match(/^([\d./+-]+)\/(\w+)$/);
  if (slashM) {
    const word = slashM[2];
    const wordT = dict[word] ? (dict[word][currentLang] || word) : tr(word);
    return slashM[1] + "/" + wordT;
  }
  const m = String(tag).match(/^(.+?)(\s+[\w./+-]+)?(\s*\([^)]*\))?$/);
  if (!m) return tag;
  const base = m[1].trim(), num = m[2] || "", paren = (m[3] || "").trim();
  const baseT = dict[base] ? (dict[base][currentLang] || base) : tr(base);
  const parenT = paren && dict[paren] ? " " + (dict[paren][currentLang] || paren) : (paren ? " " + paren : "");
  return (baseT + num + parenT);
}

/* Display-only translated frame name. frame.name itself is NEVER used here —
   it must stay English everywhere else (license keys / matching), see
   localizeData() above. Falls back to the English name if untranslated. */
const dispName = f => (f && (f.display_name || f.name)) || "";

/* Fetches everything needed for `lang` and returns the ready-to-use L object. */
/* Bump this string whenever the app's code (index.html, css/, js/) changes — printed on load so you can
   verify in the browser console (F12) that the deployed copy is current,
   instead of guessing whether a cached/older file is being served. */
const APP_BUILD = "2026-10-15-mobile-dock";
console.log("[Lancer Registry] build:", APP_BUILD);

async function fetchAndLocalize(lang) {
  const [base, locale] = await Promise.all([loadBaseData(), loadLocaleFiles(lang)]);
  ENUMS = locale ? locale.enums : null;
  currentLang = lang;
  localStorage.setItem("lancer_lang", lang);
  return localizeData(base, locale);
}
