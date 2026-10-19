# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working agreements

- **Sub-agents are allowed when a skill's procedure requires them** (e.g. `impeccable critique` runs its design review and detector assessment as two isolated sub-agents). Treat this as the user's standing, explicit permission — do not fall back to a degraded single-context run for that reason. Outside such skill requirements, the default applies: spawn sub-agents only when asked.

## What this is

A static, no-build, single-page character/mech builder for the tabletop RPG **Lancer**, reworked from the original monolithic community builder specifically to support **incremental Russian localization**. The app is vanilla HTML/CSS/JS with no framework and no build step: `index.html` (markup only), `css/*.css`, and plain `<script src>` files in `js/` (see **Code layout**). Locate code by function name (`grep -rn 'function derived' js/`) rather than line numbers.

Work in progress is tracked in `PLAN.md` (phased improvement plan with checklists). Product context lives in `PRODUCT.md`, the visual system in `DESIGN.md`.

The core motivation: the original app had the ~300KB `lancer-data` dataset inlined as a single string in a `<script>` tag, making translation impossible. This version extracts it into `data/*.json` (canonical English) plus per-category `locales/ru/*.json` translation files, overlaid onto the English data at load time.

## Running locally

There is no build step. `index.html` cannot be opened via `file://` because the browser blocks `fetch()` of local files — you must serve it:

```bash
python3 -m http.server 8000   # on Windows: py -m http.server 8000 (python3 is not on PATH there)
```

Then open `http://localhost:8000/` (or `npm run serve` → `http://localhost:4173/`, a dependency-free Node server).

## Testing

Playwright characterization tests in `tests/` (details: `tests/README.md`). npm is dev-only — the site still has no build step and no runtime dependencies.

```bash
npm install && npx playwright install chromium   # once
npm test                                         # JSON validity + unit (~0.2 s) + browser (~25 s)
npm run test:unit                                # js/core/ only, no browser
npm run test:update                              # rewrite goldens + screenshots after an INTENDED change
```

- **Unit tests** (`tests/unit/*.test.mjs`, `node --test`) load `js/core/*.js` into an isolated Node `vm` context via `tests/unit/load.mjs` — the same plain scripts the browser runs, no export statements. Set `L`/`M`/`state` as context globals; `coreData()` gives the real core dataset indexed like `rebuildIndexes()`.
- **Browser tests** reach into the page's globals (`state`, `L`, `derived()`, `applyBuildState()`, `encodeShare()`, `fetchAndLocalize()`) via `page.evaluate`. If a refactor renames or un-globals one of these, update the tests in the same change.
- `tests/golden/L.{ru,en}.json` pin the full localized dataset, so **any edit to `data/` or `locales/` fails `data.spec.mjs` until goldens are updated** — that is intended; review `git diff tests/golden/` before committing.
- Screenshot baselines are per-platform (`tests/__screenshots__/win32/` only so far).
- `test.fail(...)` marks a known, unfixed bug; delete that line once the bug is fixed.
- Run `npm test` before claiming a change to the app works.

## Deployment

The site needs only `index.html`, `css/`, `js/`, `data/`, `locales/` and `assets/`; everything else in the repo (`.claude/`, `.github/`, `tools/`, `tests/`, `docs/`, `*.md`, …) is tooling and must not be published. Two deploy targets, each with its own filter — **when adding a new top-level folder, check both**:

- **GitHub Pages** — `.github/workflows/deploy.yml` on push to `main` first runs a `test` job (`test:json`, `test:unit`, `playwright test --ignore-snapshots` — screenshot baselines are win32-only, so CI skips them), then the `deploy` job (`needs: test`) copies the paths listed in `SITE_PATHS` (an allowlist) into `_site/` and uploads that. Red tests = no deploy.
- **Cloudflare** — deploys on its own, without waiting for the tests. `wrangler.jsonc` serves the repo root as static assets; `.assetsignore` (a denylist, `.gitignore` syntax) excludes the tooling. A new root-level tooling file/folder must be added there.

## Architecture

### Code layout

All scripts are classic (non-module) scripts sharing one global scope, loaded by `index.html` in a fixed order — **later files use top-level names from earlier ones, so a new file goes in its place in that list**. Top-level code must not call a function from a file loaded later (only code that runs at event/boot time may).

| Path | Role |
|---|---|
| `js/core/i18n.js` | `localizeData()` + overlay helpers; interface strings: `t()`, `tText()`, `overlayUiStrings()`, `detectLanguages()`. Pure (`t()` reads the `UI`/`UI_LANG` globals). |
| `js/core/build.js` | `defaultState()`, `HASE`, migrations, `applyBuildState()` (sanitizes untrusted builds), mount rules (`allowedNext`, `buildMounts`). |
| `js/core/rules.js` | `derived()`, license/unlock checks, `pickerOrder`. |
| `js/core/share.js` | `?s=` link codec (`packBuild`/`encodeShare`/…). |
| `js/i18n-loader.js` | fetching data/packs/locales, `tr()`/`trTag()`, `fetchAndLocalize()`, `UI`/`UI_LANG` + `loadUiStrings()`/`applyStaticStrings()`, `APP_BUILD`. |
| `js/app/*.js` | shared globals and helpers (`base`), `state` + autosave (`state`), license labels, frame swap, `render()`/HUD/tab bar (`render`), export/import (`transfer`). |
| `js/tabs/*.js` | one file per editor tab (`render<Tab>()`). |
| `js/ui/*.js` | modal + dialogs, weapon/system/gear/mod pickers. |
| `js/sheet.js`, `js/print.js`, `js/main.js` | read-only sheet view + share link I/O, print sheet, topbar wiring/boot. |
| `css/fonts.css`, `css/app.css`, `css/sheet.css` | self-hosted fonts (paths relative to `css/`), app styles, sheet/print styles — in cascade order. |

**`js/core/` contract:** no DOM, `localStorage`, or `fetch` — only the shared globals `L`, `M`, `state`, `UI`, `UI_LANG` (and web-standard APIs available in Node, incl. `Intl`). Core words its user-facing messages with `tText()`; unit tests pass a real `UI` via `uiStrings()` in `tests/unit/load.mjs`. That is what lets `tests/unit/` run it without a browser; keep new rules/logic there.

### Data loading & i18n overlay (`js/i18n-loader.js` + `js/core/i18n.js`)

1. `loadBaseData()` fetches `data/lancer-data.json` (canonical English core data) plus several standalone files (`tags.json`, `glossary.json`, `stat_labels.json`, `core_bonus_stat_mods.json`, `core_bonus_terse.json`, `frame_images.json`), and all packs listed in `CONTENT_PACKS` (`data/packs/*.json` — official Massif Press content packs like osr-data, wallflower-data, long-rim-data, dustgrave-data, ktb-data, ows-data, sotw-data, ssmr-data). Pack arrays (`frames`, `weapons`, `systems`, `talents`, `pilot_gear`, `core_bonuses`, `mods`, `backgrounds`) are concatenated onto the core data's arrays.
2. `loadLocaleFiles(lang)` fetches `locales/<lang>/*.json` (category files listed in `LOCALE_CATEGORY_FILES`).
3. `localizeData(base, locale)` deep-clones the base data and overlays translated strings via `pickText()`/`overlayKeyedPairs()`/`overlayNamedSublist()`/`overlayOnField()`: a translated `"ru"` value is used if non-empty, otherwise the English original is kept. This means the site is always fully functional even with partial translation coverage.
4. The result becomes the global `L` used by all rendering/logic code — nothing downstream needs to know localization happened.

**Critical constraint — some fields are logic keys, never translated in-place:**
- `frame.name` (and `frame.variant` for variant frames) keys `state.licenses[...]` and is compared via `item.license === frame.name` to unlock weapons/systems. Translating it in the data would break license unlocking. See `licenseKeyFor()`.
- `mount`, `type`, `source`, `tags`, `mechtype` values (e.g. `"Main"`, `"Rifle"`, `"GMS"`, `"Reliable 2"`) are compared literally throughout the app logic (mount matching, filters, source colors) and are never mutated on data objects.

Instead, these "structural" values are translated **only at render time** via `tr()` and `trTag()`, which look up `locales/<lang>/enums.json`. If you ever need chassis names to visibly translate while keeping license logic intact, the intended approach (documented in README) is adding a separate `frame.display_name` field rather than mutating `frame.name`.

### App state & rendering

- Global mutable `state` object holds the in-progress build (licenses, loadout, skills, etc.); `derived()` computes derived stats from it.
- `render()` → `renderHUD()` + `renderTab()` + `renderTabBar()`; all state mutations should go through `setState(fn)`, which runs `fn` then re-renders — don't mutate `state` and expect the UI to update without going through `setState`.
- **Keyboard/focus conventions:** anything clickable is a `<button>` (never `<div onclick>`). A card that opens a detail view uses `cardLinkHTML(kind, id, html)` — its name becomes a button stretched over the card (`.has-cardlink` on the card), and the click is handled once by delegation in `CARD_OPENERS` (`js/main.js`); add a new kind there. Focus survives re-renders: `render()` restores it via `keepFocusAcrossRender()` and `wireFocusNet()` covers partial redraws — both find "the same control" by `id` or all `data-*` attributes (`focusKeyOf()`), so give re-rendered buttons stable data attributes. A control that must stay focusable when inactive uses `aria-disabled="true"`, not `disabled`.
- Tab-specific render functions follow `render<TabName>()` naming (`renderPilot`, `renderSkills`, `renderTalents`, `renderHase`, etc.).
- `localStorage` persists the build itself (`lancer_build`, autosaved), data language (`lancer_lang`), interface language (`lancer_ui_lang`), build/sheet view (`view_mode`), and picker/talent view modes (`picker_view_mode`, `talents_view_mode`) — check `migrateLicenseKeys()`/`migrateWeaponSlots()` if changing how state is keyed, since these exist specifically to migrate old localStorage saves forward.

### Known unimplemented feature (not a bug)

Pack categories `reserves` and `environments` are intentionally not loaded/merged — the app has no UI tab for them at all. This is a deliberate scope decision documented in the README, not a missing translation.

## Python tooling (`tools/`)

These operate on the JSON data files, not the app itself:

- **`extract_locale_template.py --lang ru [--only ui.json,mods.json]`** — regenerates `locales/ru/*.json` from `data/lancer-data.json` + `data/packs/*.json`, and `locales/ru/ui.json` from `data/ui.json`. Preserves existing `"ru"` translations, adds empty `"ru"` entries for new fields, drops entries for fields that disappeared (and the translation of a field whose English became empty). In every file a translation whose English changed is kept and marked `"stale": true` — recheck it, then delete the marker. A full run is safe (builders cover every field `localizeData()` overlays); `--only <files>` limits it.
- **`locale_coverage.py [--list] [--markdown]`** — translation coverage per locale file, the untranslated and `"stale"` paths, and "generator drift" (files a regeneration would rewrite). Informational, always exits 0; CI prints it to the run's Summary.
- **`sync_upstream.py status|pull [names] [--ref X]`** — keeps raw byte-for-byte snapshots of the 9 official `massif-press/*-data` repos' `lib/*.json` in `upstream/<repo>/`, pinned in `upstream/upstream.lock.json`. The site never reads `upstream/` (excluded from both deploys). Never hand-edit it; the full update procedure is `upstream/README.md`.
- **`normalize_pack.py upstream/<repo> <out.json> "<label>"`** — builds a site data file from an upstream snapshot: `data/lancer-data.json` from `upstream/lancer-data`, `data/packs/<repo>.json` from the rest. Both are pure generator output — **never hand-edit them**, change the normalizer instead. It flattens the upstream schema for the renderer: tag objects → `data/tags.json` names (`"Reliable 2"`, `"Heat 2 (Self)"`), `actions`/`deployables` folded into `effect` / rank `description` (skipped when the prose already says it, `already_described()`; reactions keep their trigger), engine hooks the app never reads dropped (`HOOKS`). Frame core systems keep structured `passive_actions`/`active_actions`.

Updating data from upstream (full version: `upstream/README.md`):
```bash
python3 tools/sync_upstream.py pull [<name>]      # then review git diff upstream/
python3 tools/normalize_pack.py upstream/lancer-data data/lancer-data.json core
python3 tools/normalize_pack.py upstream/<name> data/packs/<name>.json "<label>"
python3 tools/extract_locale_template.py --lang ru
```
Then translate the new empty `"ru": ""` entries and recheck the `"stale"` ones (`py tools/locale_coverage.py --list` finds both) — and review `git diff locales/` before keeping it. Terms follow `GLOSSARY.md`. On Windows use `py` (or `python`) instead of `python3`.

## UI strings (ADR 0005)

- No interface text in code: English lives in `data/ui.json`, Russian in `locales/ru/ui.json` (`{key: {en, ru}}`). Render with `t(key, params)` (returns HTML; params are escaped) or `tText(key, params)` (plain text — for `textContent`, `title`/`aria-label`, and lists that `esc()` their items). A param named `…Html` is inserted as markup (caller builds and escapes it). Plural strings are `{one, other}` / ru `{one, few, many}` objects, picked by `params.n`.
- Static markup in `index.html`: `data-i18n="key"` (content) / `data-i18n-attr="aria-label:key;title:key2"`; `applyStaticStrings()` fills them.
- Adding text: add the key to `data/ui.json`, run `py tools/extract_locale_template.py --lang ru --only ui.json`, fill `"ru"`. Keys in code are literals; a computed key family is declared with a `// i18n-dynamic: a.b, a.c` comment (checked by `tests/unit/ui-keys.test.mjs`). Never name a local variable `t` (it hides `t()`; guarded by a unit test).
- Two independent languages: interface (`UI_LANG`, `lancer_ui_lang`) and data (`currentLang`, `lancer_lang`). `tr()`/`trTag()` follow the data language; a game term with a data dictionary (`stat_labels`, `enums`, `glossary`) follows the data, everything else follows the interface.
- `tests/unit/no-cyrillic.test.mjs` fails on Cyrillic in `js/` or `index.html` (outside comments and `<head>`); `tests/en.spec.mjs` walks every screen in `en`/`en` for Cyrillic.
- Terminology: `GLOSSARY.md` (EN → RU, with open questions).

## Translating content

Each `locales/ru/*.json` entry is keyed by item `id` (e.g. `"mf_blackbeard"`), with fields as `{"en": "...", "ru": ""}` pairs — fill in `"ru"`. Nested lists (`traits`, `ranks`) are keyed by the English element name, not index, so translations don't desync if item order changes upstream. `locales/ru/enums.json` holds shared terms (mounts, weapon types, tags, damage types, mech roles) applied everywhere via `tr()`/`trTag()` — translate a term there once rather than per-item.
