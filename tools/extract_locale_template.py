#!/usr/bin/env python3
"""
extract_locale_template.py
---------------------------
Regenerates /locales/<lang>/*.json translation templates from the
canonical English data file /data/lancer-data.json.

Run this whenever lancer-data.json is updated (e.g. after pulling a new
version of massif-press/lancer-data) to pick up new/changed entries
without losing translations you already made.

Usage:
    python3 tools/extract_locale_template.py [--lang ru]

Output layout (per category file, e.g. locales/ru/frames.json):
{
  "<item_id>": {
    "name": {"en": "Everest", "ru": ""},
    "description": {"en": "...", "ru": ""},
    "traits": {
       "<english trait name>": {
          "name": {"en": "...", "ru": ""},
          "description": {"en": "...", "ru": ""}
       }
    },
    "core_system": { "name": {...}, "description": {...}, ... }
  }
}

Existing "ru" values already present in the old template file are
preserved. New fields appear with an empty "ru" (i.e. "needs translation").
Fields that disappeared from the source data are dropped.
"""
import json
import argparse
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA_FILE = ROOT / "data" / "lancer-data.json"
PACKS_DIR = ROOT / "data" / "packs"


def pair(en, old):
    """Build an {en, ru} pair, preserving a previous ru translation if any.
    Like build_ui(): when the English changed since the translation (an
    upstream update), the old Russian is kept and marked "stale": true until
    a translator rechecks it and deletes the marker. An emptied English field
    drops its translation too, or the Russian would show for nothing."""
    en = en or ""
    old = old if isinstance(old, dict) else {}
    entry = {"en": en, "ru": old.get("ru", "") if en else ""}
    if entry["ru"] and (("en" in old and old["en"] != en) or old.get("stale")):
        entry["stale"] = True
    return entry


def build_named_actions(items, old_map):
    """Actions/deployables keyed by English name, like every other sublist.
    trigger/detail may be a string or {detail: ...} (see overlayOnField)."""
    old_map = old_map or {}
    out = {}
    for a in items or []:
        key = a.get("name") or ""
        old_a = old_map.get(key, {})
        entry = {}
        for field in ("name", "trigger", "detail"):
            text = _on_field(a.get(field))
            if text:
                entry[field] = pair(text, old_a.get(field))
        if entry:
            out[key] = entry
    return out


def merge_dict_field(new_obj, old_obj, fields):
    old_obj = old_obj or {}
    out = {}
    for f in fields:
        out[f] = pair(new_obj.get(f), old_obj.get(f))
    return out


def build_frames(data, old):
    out = {}
    for fr in data["frames"]:
        old_e = old.get(fr["id"], {})
        entry = {
            "name": pair(fr.get("name"), old_e.get("name")),
            "description": pair(fr.get("description"), old_e.get("description")),
        }
        traits = {}
        old_traits = old_e.get("traits", {})
        for tr in fr.get("traits", []):
            key = tr["name"]
            old_t = old_traits.get(key, {})
            traits[key] = {
                "name": pair(tr.get("name"), old_t.get("name")),
                "description": pair(tr.get("description"), old_t.get("description")),
            }
        entry["traits"] = traits

        cs = fr.get("core_system") or {}
        old_cs = old_e.get("core_system", {})
        entry["core_system"] = merge_dict_field(
            cs, old_cs,
            ["name", "description", "passive_name", "passive_effect",
             "active_name", "active_effect"]
        )
        # localizeData() overlays core-system actions by English name.
        for k in ("passive_actions", "active_actions"):
            acts = build_named_actions(cs.get(k), old_cs.get(k))
            if acts:
                entry["core_system"][k] = acts
        out[fr["id"]] = entry
    return out


def _on_field(val):
    """weapons on_hit/on_attack/on_crit can be null, a string, or {detail:...}."""
    if val is None:
        return None
    if isinstance(val, str):
        return val
    if isinstance(val, dict):
        return val.get("detail")
    return None


def build_weapons(data, old):
    out = {}
    for w in data["weapons"]:
        old_e = old.get(w["id"], {})
        entry = {
            "name": pair(w.get("name"), old_e.get("name")),
            "effect": pair(w.get("effect"), old_e.get("effect")),
        }
        for k in ("on_hit", "on_attack", "on_crit"):
            text = _on_field(w.get(k))
            if text:
                entry[k] = pair(text, old_e.get(k))
        profiles = w.get("profiles")
        if profiles:
            old_profiles = old_e.get("profiles", {})
            pentry = {}
            for p in profiles:
                key = p["name"]
                old_p = old_profiles.get(key, {})
                pp = {"name": pair(p.get("name"), old_p.get("name"))}
                if p.get("effect"):
                    pp["effect"] = pair(p.get("effect"), old_p.get("effect"))
                for k in ("on_hit", "on_attack", "on_crit"):
                    text = _on_field(p.get(k))
                    if text:
                        pp[k] = pair(text, old_p.get(k))
                # Actions nested in a profile (e.g. a stance's reaction). The
                # sheet view renders these, so they need translating too;
                # keyed by the English action name like every other sublist.
                acts = build_named_actions(p.get("actions"), old_p.get("actions"))
                if acts:
                    pp["actions"] = acts
                pentry[key] = pp
            entry["profiles"] = pentry
        # Weapon-level actions/deployables are not rendered yet (normalize_pack
        # folds their text into effect), but they are translated: keep them so
        # the work is not lost when the sheet starts showing them.
        for k in ("actions", "deployables"):
            acts = build_named_actions(w.get(k), old_e.get(k))
            if acts:
                entry[k] = acts
        out[w["id"]] = entry
    return out


def build_systems(data, old):
    out = {}
    for s in data["systems"]:
        old_e = old.get(s["id"], {})
        out[s["id"]] = {
            "name": pair(s.get("name"), old_e.get("name")),
            "effect": pair(s.get("effect"), old_e.get("effect")),
            "description": pair(s.get("description"), old_e.get("description")),
        }
    return out


def build_talents(data, old):
    out = {}
    for t in data["talents"]:
        old_e = old.get(t["id"], {})
        entry = {
            "name": pair(t.get("name"), old_e.get("name")),
            "terse": pair(t.get("terse"), old_e.get("terse")),
            "description": pair(t.get("description"), old_e.get("description")),
        }
        ranks = {}
        old_ranks = old_e.get("ranks", {})
        for r in t.get("ranks", []):
            key = r["name"]
            old_r = old_ranks.get(key, {})
            ranks[key] = {
                "name": pair(r.get("name"), old_r.get("name")),
                "description": pair(r.get("description"), old_r.get("description")),
            }
        entry["ranks"] = ranks
        out[t["id"]] = entry
    return out


def build_skills(data, old):
    out = {}
    for s in data["skills"]:
        old_e = old.get(s["id"], {})
        out[s["id"]] = {
            "name": pair(s.get("name"), old_e.get("name")),
            "description": pair(s.get("description"), old_e.get("description")),
            "detail": pair(s.get("detail"), old_e.get("detail")),
        }
    return out


def build_core_bonuses(data, old):
    out = {}
    for c in data["core_bonuses"]:
        old_e = old.get(c["id"], {})
        out[c["id"]] = {
            "name": pair(c.get("name"), old_e.get("name")),
            "effect": pair(c.get("effect"), old_e.get("effect")),
            "mounted_effect": pair(c.get("mounted_effect"), old_e.get("mounted_effect")),
        }
    return out


def build_mods(data, old):
    """Weapon mods: same {en, ru} pairs as every other file. mods.json was
    hand-made with "ru" only, so a translator could not see the original."""
    out = {}
    for m in data.get("mods", []):
        old_e = old.get(m["id"], {})
        entry = {
            "name": pair(m.get("name"), old_e.get("name")),
            "effect": pair(m.get("effect"), old_e.get("effect")),
            "description": pair(m.get("description"), old_e.get("description")),
        }
        for k in ("on_hit", "on_attack", "on_crit"):
            text = _on_field(m.get(k))
            if text is not None:
                entry[k] = pair(text, old_e.get(k))
        out[m["id"]] = entry
    return out


def build_pilot_gear(data, old):
    out = {}
    for g in data["pilot_gear"]:
        old_e = old.get(g["id"], {})
        entry = {
            "name": pair(g.get("name"), old_e.get("name")),
            "description": pair(g.get("description"), old_e.get("description")),
        }
        if g.get("effect"):
            entry["effect"] = pair(g.get("effect"), old_e.get("effect"))
        out[g["id"]] = entry
    return out


def build_backgrounds(data, old):
    out = {}
    for b in data["backgrounds"]:
        old_e = old.get(b["id"], {})
        out[b["id"]] = {
            "name": pair(b.get("name"), old_e.get("name")),
            "description": pair(b.get("description"), old_e.get("description")),
        }
    return out


def build_manufacturers(data, old):
    out = {}
    for m in data.get("manufacturers", []):
        old_e = old.get(m["id"], {})
        out[m["id"]] = {
            "name": pair(m.get("name"), old_e.get("name")),
            "description": pair(m.get("description"), old_e.get("description")),
        }
    return out


def build_tags(data, old):
    out = {}
    for t in data.get("tags", []):
        old_e = old.get(t["id"], {})
        out[t["id"]] = {
            "name": pair(t.get("name"), old_e.get("name")),
            "description": pair(t.get("description"), old_e.get("description")),
        }
    return out


def build_glossary(data, old):
    out = {}
    for key, g in data.get("glossary", {}).items():
        old_e = old.get(key, {})
        out[key] = {
            "name": pair(g.get("name"), old_e.get("name")),
            "description": pair(g.get("description"), old_e.get("description")),
        }
    return out


def build_stat_labels(data, old):
    """stat_labels.json is a flat {key: "TEXT"} map (not {name, description}
    like most categories) — used for the full-length stat names shown in
    the ВЫБРАННОЕ ШАССИ row layout."""
    out = {}
    for key, text in data.get("stat_labels", {}).items():
        out[key] = pair(text, old.get(key))
    return out


BUILDERS = {
    "frames.json": build_frames,
    "weapons.json": build_weapons,
    "systems.json": build_systems,
    "talents.json": build_talents,
    "skills.json": build_skills,
    "core_bonuses.json": build_core_bonuses,
    "pilot_gear.json": build_pilot_gear,
    "backgrounds.json": build_backgrounds,
    "manufacturers.json": build_manufacturers,
    "tags.json": build_tags,
    "glossary.json": build_glossary,
    "stat_labels.json": build_stat_labels,
    "mods.json": build_mods,
}


UI_FILE = ROOT / "data" / "ui.json"


def build_ui(old):
    """Interface strings: data/ui.json (canonical English) -> {key: {en, ru}}.

    A plural entry is an object of forms; its Russian side is
    {one, few, many}. When the English text of a key changed since the
    translation was made, the old Russian is kept (better slightly dated
    Russian than English in the middle of a Russian screen) and marked
    "stale": true for the translator. t() ignores the marker."""
    en_all = json.loads(UI_FILE.read_text(encoding="utf-8"))
    out = {}
    for key, en in en_all.items():
        prev = old.get(key) if isinstance(old.get(key), dict) else {}
        if isinstance(en, dict):
            empty = {"one": "", "few": "", "many": ""}
            ru = prev.get("ru") if isinstance(prev.get("ru"), dict) else empty
            ru = {f: ru.get(f, "") for f in ("one", "few", "many")}
            filled = any(ru.values())
        else:
            ru = prev.get("ru", "") if isinstance(prev.get("ru"), str) else ""
            filled = bool(ru)
        entry = {"en": en, "ru": ru}
        if filled and "en" in prev and prev["en"] != en:
            entry["stale"] = True
        elif filled and prev.get("stale"):
            entry["stale"] = True
        out[key] = entry
    return out


def load_combined_data(quiet=False):
    """Core data + every normalized pack in data/packs/, merged into one
    lookup so pack items get template entries alongside core-book items."""
    data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    tags_file = ROOT / "data" / "tags.json"
    if tags_file.exists():
        data["tags"] = json.loads(tags_file.read_text(encoding="utf-8"))
    glossary_file = ROOT / "data" / "glossary.json"
    if glossary_file.exists():
        data["glossary"] = json.loads(glossary_file.read_text(encoding="utf-8"))
    stat_labels_file = ROOT / "data" / "stat_labels.json"
    if stat_labels_file.exists():
        data["stat_labels"] = json.loads(stat_labels_file.read_text(encoding="utf-8"))
    if PACKS_DIR.exists():
        for pack_file in sorted(PACKS_DIR.glob("*.json")):
            pack = json.loads(pack_file.read_text(encoding="utf-8"))
            for cat, items in pack.items():
                if cat in data and items:
                    data[cat] = data[cat] + items
            if not quiet:
                print(f"  + merged {pack_file.name}")
    return data


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", default="ru")
    # The data locales have drifted from what the builders generate (hand
    # edits, see PLAN.md stage 5), so a full run rewrites thousands of lines.
    # --only ui.json (comma list of file names) regenerates just those.
    ap.add_argument("--only", default="",
                    help="comma list of locale files to regenerate, e.g. ui.json")
    args = ap.parse_args()

    data = load_combined_data()
    out_dir = ROOT / "locales" / args.lang
    out_dir.mkdir(parents=True, exist_ok=True)

    only = {s.strip() for s in args.only.split(",") if s.strip()}
    for filename, builder in BUILDERS.items():
        if only and filename not in only:
            continue
        path = out_dir / filename
        old = {}
        if path.exists():
            old = json.loads(path.read_text(encoding="utf-8"))
        result = builder(data, old)
        path.write_text(
            json.dumps(result, ensure_ascii=False, indent=1) + "\n",
            encoding="utf-8"
        )
        n_total = len(result)
        n_done = sum(
            1 for v in result.values()
            if isinstance(v, dict) and v.get("name", {}).get("ru")
        )
        print(f"{filename:20s} {n_done:4d} / {n_total:4d} names translated")

    # Interface strings have their own source (data/ui.json), not the game data.
    if UI_FILE.exists() and (not only or "ui.json" in only):
        path = out_dir / "ui.json"
        old = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
        result = build_ui(old)
        path.write_text(json.dumps(result, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        missing = sum(1 for v in result.values()
                      if not (v["ru"] if isinstance(v["ru"], str) else all(v["ru"].values())))
        stale = sum(1 for v in result.values() if v.get("stale"))
        print(f"{'ui.json':20s} {len(result) - missing:4d} / {len(result):4d} strings translated"
              + (f", {stale} stale (search \"stale\")" if stale else ""))


if __name__ == "__main__":
    main()
