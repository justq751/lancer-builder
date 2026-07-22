# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, no-build, single-page character/mech builder for the tabletop RPG **Lancer**, reworked from the original monolithic community builder specifically to support **incremental Russian localization**. The entire app is vanilla HTML/CSS/JS in `index.html` (~3300 lines); there is no framework, package manager, or build step.

The core motivation: the original app had the ~300KB `lancer-data` dataset inlined as a single string in a `<script>` tag, making translation impossible. This version extracts it into `data/*.json` (canonical English) plus per-category `locales/ru/*.json` translation files, overlaid onto the English data at load time.

## Running locally

There is no build step. `index.html` cannot be opened via `file://` because the browser blocks `fetch()` of local files — you must serve it:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/`. No test suite, linter, or CI checks exist beyond the GitHub Pages deploy workflow (`.github/workflows/deploy.yml`), which just uploads the repo as-is (no build step) on push to `main`.

## Architecture

### Data loading & i18n overlay (index.html, "I18N DATA LOADER" section, ~line 736+)

1. `loadBaseData()` fetches `data/lancer-data.json` (canonical English core data) plus several standalone files (`tags.json`, `glossary.json`, `stat_labels.json`, `core_bonus_stat_mods.json`, `core_bonus_terse.json`, `frame_images.json`), and all packs listed in `CONTENT_PACKS` (`data/packs/*.json` — official Massif Press content packs like osr-data, wallflower-data, long-rim-data, dustgrave-data, ktb-data, ows-data, sotw-data, ssmr-data). Pack arrays (`frames`, `weapons`, `systems`, `talents`, `pilot_gear`, `core_bonuses`, `mods`) are concatenated onto the core data's arrays.
2. `loadLocaleFiles(lang)` fetches `locales/<lang>/*.json` (category files listed in `LOCALE_CATEGORY_FILES`).
3. `localizeData(base, locale)` deep-clones the base data and overlays translated strings via `pickText()`/`overlayKeyedPairs()`/`overlayNamedSublist()`/`overlayOnField()`: a translated `"ru"` value is used if non-empty, otherwise the English original is kept. This means the site is always fully functional even with partial translation coverage.
4. The result becomes the global `L` used by all rendering/logic code — nothing downstream needs to know localization happened.

**Critical constraint — some fields are logic keys, never translated in-place:**
- `frame.name` (and `frame.variant` for variant frames) keys `state.licenses[...]` and is compared via `item.license === frame.name` to unlock weapons/systems. Translating it in the data would break license unlocking. See `licenseKeyFor()` (~line 1332).
- `mount`, `type`, `source`, `tags`, `mechtype` values (e.g. `"Main"`, `"Rifle"`, `"GMS"`, `"Reliable 2"`) are compared literally throughout the app logic (mount matching, filters, source colors) and are never mutated on data objects.

Instead, these "structural" values are translated **only at render time** via `tr()` (~line 980) and `trTag()` (~line 989), which look up `locales/<lang>/enums.json`. If you ever need chassis names to visibly translate while keeping license logic intact, the intended approach (documented in README) is adding a separate `frame.display_name` field rather than mutating `frame.name`.

### App state & rendering

- Global mutable `state` object (~line 1217) holds the in-progress build (licenses, loadout, skills, etc.); `derived()` (~line 1272) computes derived stats from it.
- `render()` → `renderHUD()` + `renderTab()` + `renderTabBar()`; all state mutations should go through `setState(fn)` (~line 1422), which runs `fn` then re-renders — don't mutate `state` and expect the UI to update without going through `setState`.
- Tab-specific render functions follow `render<TabName>()` naming (`renderPilot`, `renderSkills`, `renderTalents`, `renderHase`, etc.).
- `localStorage` persists language choice (`lancer_lang`), talent view mode (`talents_view_mode`), and presumably the build itself — check `migrateLicenseKeys()`/`migrateWeaponSlots()` (~line 1053/1069) if changing how state is keyed, since these exist specifically to migrate old localStorage saves forward.

### Known unimplemented feature (not a bug)

Pack categories `reserves` and `environments` are intentionally not loaded/merged — the app has no UI tab for them at all. This is a deliberate scope decision documented in the README, not a missing translation.

## Python tooling (`tools/`)

These operate on the JSON data files, not the app itself:

- **`extract_locale_template.py --lang ru`** — regenerates `locales/ru/*.json` from `data/lancer-data.json` + `data/packs/*.json`. Preserves existing `"ru"` translations, adds empty `"ru"` entries for new/changed fields, drops entries for fields that disappeared. Run this after updating `data/lancer-data.json` or adding a new pack.
- **`normalize_pack.py <lib_dir> data/packs/<name>.json "<label>"`** — converts a pack using the newer upstream `lancer-data` schema (tag objects like `{"id":"tg_reliable","val":2}`, ability text in `actions`/`deployables` arrays) into the flat shape `data/lancer-data.json` already uses (plain tag strings like `"Reliable 2"`, ability text folded into `effect`/`*_effect`), so the renderer needs zero changes to support a new pack.
- **`merge_frames.py <normalized_file> <target_file>`** — merges just the `frames` array from a normalized pack output into a target data file, leaving every other key untouched. Writes a `.bak` backup of the target before overwriting.

Typical workflow for adding/updating a content pack:
```bash
python3 tools/normalize_pack.py <lib_dir> data/packs/<name>.json "<label>"
python3 tools/extract_locale_template.py --lang ru
```
Then translate the newly-appeared empty `"ru": ""` entries.

## Translating content

Each `locales/ru/*.json` entry is keyed by item `id` (e.g. `"mf_blackbeard"`), with fields as `{"en": "...", "ru": ""}` pairs — fill in `"ru"`. Nested lists (`traits`, `ranks`) are keyed by the English element name, not index, so translations don't desync if item order changes upstream. `locales/ru/enums.json` holds shared terms (mounts, weapon types, tags, damage types, mech roles) applied everywhere via `tr()`/`trTag()` — translate a term there once rather than per-item.
