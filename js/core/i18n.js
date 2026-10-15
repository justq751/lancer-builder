/* ============ CORE: i18n overlay ============
   Pure functions: localizeData(base, locale) deep-clones the English dataset
   and overlays non-empty "ru" strings. No DOM, no fetch, no globals — the
   loader (js/i18n-loader.js) feeds it, tests/unit/ calls it directly.
   ============================================================ */
/* pick the translation if present & non-empty, otherwise keep the English original */
function pickText(original, pair) {
  if (pair && typeof pair.ru === "string" && pair.ru.trim()) return pair.ru;
  return original;
}

function overlayKeyedPairs(items, overlayMap, fields, opts = {}) {
  items.forEach(item => {
    const t = overlayMap[item.id];
    if (!t) return;
    fields.forEach(f => {
      if (opts.skip && opts.skip.includes(f)) return;
      if (t[f] !== undefined) item[f] = pickText(item[f], t[f]);
    });
  });
}

function overlayNamedSublist(list, overlayNamedMap) {
  (list || []).forEach(sub => {
    const t = (overlayNamedMap || {})[sub.name];
    if (!t) return;
    if (t.name) sub.name = pickText(sub.name, t.name);
    if (t.description !== undefined) sub.description = pickText(sub.description, t.description);
  });
}

/* Actions nested inside a weapon profile — a stance's reaction, for example.
   Keyed by the English action name, like every other nested list here. The
   sheet renders these, so without this overlay they show up in English in an
   otherwise translated card. */
function overlayActionList(list, overlayNamedMap) {
  (list || []).forEach(a => {
    const t = (overlayNamedMap || {})[a.name];
    if (!t) return;
    ["trigger", "detail", "name"].forEach(k => {
      if (t[k] !== undefined && a[k] != null) a[k] = pickText(a[k], t[k]);
    });
  });
}

/* weapons: on_hit/on_attack/on_crit can be null | string | {detail,...} */
function overlayOnField(item, key, pair) {
  const val = item[key];
  if (val == null || !pair) return;
  const translated = pickText(typeof val === "string" ? val : val.detail, pair);
  if (typeof val === "string") item[key] = translated;
  else item[key] = { ...val, detail: translated };
}

function localizeData(base, locale) {
  const L = JSON.parse(JSON.stringify(base)); // deep clone, never mutate the fetched base
  if (!locale) return L; // "en" — nothing to overlay, English IS the source data

  // frames: fr.name stays English — it's a logic key (state.licenses[fr.name],
  // item.license === fr.name for unlocking). We instead populate fr.display_name
  // with the translation, purely for rendering; see dispName() and its call sites.
  const frOverlay = locale.frames || {};
  L.frames.forEach(fr => {
    fr.display_name = fr.name; // default: no translation yet -> show the English name
    const t = frOverlay[fr.id];
    if (!t) return;
    if (t.name) fr.display_name = pickText(fr.name, t.name);
    if (t.description !== undefined) fr.description = pickText(fr.description, t.description);
    overlayNamedSublist(fr.traits, t.traits);
    if (fr.core_system && t.core_system) {
      const cs = fr.core_system, tcs = t.core_system;
      ["name", "description", "passive_name", "passive_effect", "active_name", "active_effect"]
        .forEach(k => { if (tcs[k] !== undefined) cs[k] = pickText(cs[k], tcs[k]); });
      ["passive_actions", "active_actions"].forEach(actKey => {
        const acts = cs[actKey], tacts = tcs[actKey];
        if (!acts || !tacts) return;
        acts.forEach(a => {
          const ta = tacts[a.name];
          if (!ta) return;
          if (ta.name) a.name = pickText(a.name, ta.name);
          overlayOnField(a, "trigger", ta.trigger);
          overlayOnField(a, "detail", ta.detail);
        });
      });
    }
  });

  overlayKeyedPairs(L.weapons, locale.weapons || {}, ["name", "effect"]);
  (locale.weapons ? L.weapons : []).forEach(w => {
    const t = (locale.weapons || {})[w.id];
    if (!t) return;
    overlayOnField(w, "on_hit", t.on_hit);
    overlayOnField(w, "on_attack", t.on_attack);
    overlayOnField(w, "on_crit", t.on_crit);
    if (w.profiles && t.profiles) {
      w.profiles.forEach(p => {
        const tp = t.profiles[p.name];
        if (!tp) return;
        if (tp.name) p.name = pickText(p.name, tp.name);
        if (p.effect !== undefined && tp.effect) p.effect = pickText(p.effect, tp.effect);
        overlayOnField(p, "on_hit", tp.on_hit);
        overlayOnField(p, "on_attack", tp.on_attack);
        overlayOnField(p, "on_crit", tp.on_crit);
        overlayActionList(p.actions, tp.actions);
      });
    }
  });

  // mods: weapon-mod cards read name/effect/description + on_hit/on_attack/
  // on_crit exactly like weapons — same overlay shape, see modCardBody().
  overlayKeyedPairs(L.mods || [], locale.mods || {}, ["name", "effect", "description"]);
  (locale.mods ? (L.mods || []) : []).forEach(m => {
    const t = (locale.mods || {})[m.id];
    if (!t) return;
    overlayOnField(m, "on_hit", t.on_hit);
    overlayOnField(m, "on_attack", t.on_attack);
    overlayOnField(m, "on_crit", t.on_crit);
  });

  overlayKeyedPairs(L.systems, locale.systems || {}, ["name", "effect", "description"]);

  const talOverlay = locale.talents || {};
  L.talents.forEach(tl => {
    const t = talOverlay[tl.id];
    if (!t) return;
    if (t.name) tl.name = pickText(tl.name, t.name);
    if (t.terse !== undefined) tl.terse = pickText(tl.terse, t.terse);
    if (t.description !== undefined) tl.description = pickText(tl.description, t.description);
    overlayNamedSublist(tl.ranks, t.ranks);
  });

  overlayKeyedPairs(L.skills, locale.skills || {}, ["name", "description", "detail"]);
  overlayKeyedPairs(L.core_bonuses, locale.core_bonuses || {}, ["name", "effect", "mounted_effect"]);
  overlayKeyedPairs(L.pilot_gear, locale.pilot_gear || {}, ["name", "description", "effect"]);
  overlayKeyedPairs(L.backgrounds, locale.backgrounds || {}, ["name", "description"]);
  overlayKeyedPairs(L.manufacturers || [], (locale.manufacturers || {}), ["name", "description"]);
  overlayKeyedPairs(L.tags || [], (locale.tags || {}), ["name", "description"]);

  // glossary: a dict keyed by our internal stat key (hp/armor/...), not an
  // array with .id like everything else — overlay it directly.
  if (L.glossary && locale.glossary) {
    for (const key in L.glossary) {
      const t = locale.glossary[key];
      if (!t) continue;
      if (t.name) L.glossary[key].name = pickText(L.glossary[key].name, t.name);
      if (t.description !== undefined) L.glossary[key].description = pickText(L.glossary[key].description, t.description);
    }
  }

  // stat_labels: flat {key: "TEXT"} map (full-length stat names shown in the
  // ВЫБРАННОЕ ШАССИ row layout) — same overlay idea as glossary, but each
  // value is a bare string rather than {name, description}.
  if (L.stat_labels && locale.stat_labels) {
    for (const key in L.stat_labels) {
      const t = locale.stat_labels[key];
      if (!t) continue;
      L.stat_labels[key] = pickText(L.stat_labels[key], t);
    }
  }

  return L;
}

/* ============ CORE: interface strings ============
   t() reads two globals the loader owns (js/i18n-loader.js): UI — the flat
   {key: text | plural forms} map for the interface language — and UI_LANG.
   Keys are literals in the code; tests/unit/ui-keys.test.mjs checks them
   against data/ui.json. See docs/adr/0005-ui-localization.md. */
const UI_LANGS = ["ru", "en"];
const uiWarned = new Set();
const uiEsc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

/* The string for `key`, with {name} filled from params (escaped — params
   carry user text such as a callsign; the string's own markup is ours and
   stays). A plural entry {one, few, many, other} is picked by params.n. A
   missing key renders as the key itself, so a gap is visible, not fatal. */
function t(key, params) { return uiFormat(key, params, uiEsc); }
/* The same string for text contexts — textContent, title/aria-label, and
   lists that esc() their own items: parameters go in raw, or the reader
   would see "&lt;b&gt;". Never put its result into innerHTML. */
function tText(key, params) { return uiFormat(key, params, String); }
function uiFormat(key, params, fill) {
  let s = UI && UI[key];
  if (s == null) {
    if (!uiWarned.has(key)) { uiWarned.add(key); console.warn("[i18n] missing UI string:", key); }
    return key;
  }
  if (typeof s === "object") {
    const form = new Intl.PluralRules(UI_LANG).select(Number(params && params.n));
    s = s[form] ?? s.other ?? Object.values(s)[0];
  }
  if (!params) return s;
  // A parameter named …Html is markup the caller built (and escaped) itself —
  // e.g. a list of <b>names</b> — and goes in as is.
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? (k.endsWith("Html") ? String(params[k]) : fill(params[k])) : m));
}

/* English map + the ru {key: {en, ru}} file → one flat map. Plural forms are
   taken as a set: a Russian entry missing any of one/few/many would pick an
   empty form, so it keeps the English set instead. */
function overlayUiStrings(en, ruPairs) {
  const out = { ...en };
  if (!ruPairs) return out;
  for (const [k, pair] of Object.entries(ruPairs)) {
    if (!(k in en) || !pair) continue;
    const ru = pair.ru;
    if (typeof ru === "string") { if (ru.trim()) out[k] = ru; }
    else if (ru && ["one", "few", "many"].every(f => typeof ru[f] === "string" && ru[f].trim())) out[k] = ru;
  }
  return out;
}

/* Which interface/data languages to start in. Stored choices win. A visitor
   from before stage 4 has only the data language stored and always had a
   Russian interface — they keep it. A first visit follows the browser. */
function detectLanguages(navLang, stored) {
  const ok = v => (UI_LANGS.includes(v) ? v : null);
  const browser = /^ru\b/i.test(navLang || "") ? "ru" : "en";
  const ui = ok(stored && stored.ui), data = ok(stored && stored.data);
  return {
    ui: ui || (data ? "ru" : browser),
    data: data || browser,
  };
}
