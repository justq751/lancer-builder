#!/usr/bin/env python3
"""Export guarded text overlays for LANCER 3.1.3; never export game mechanics."""
import argparse
import copy
import json
import pathlib
import re
import sys
import zipfile

from extract_locale_template import ROOT, BUILDERS, load_combined_data
import normalize_pack as normalizer

MODULE = ROOT / "foundry" / "lancer-ru-content"
TYPES = {
    "frames": "frame", "weapons": "mech_weapon", "systems": "mech_system",
    "mods": "weapon_mod", "talents": "talent", "skills": "skill",
    "core_bonuses": "core_bonus", "statuses": "status",
}
FIELDS = {
    "frames": ["description"], "weapons": [],
    "systems": ["effect", "description"], "mods": ["effect", "description"],
    "talents": ["description", "terse"], "skills": ["description", "detail"],
    "core_bonuses": ["effect", "mounted_effect"],
    "statuses": ["effects", "terse"], "pilot_gear": ["description", "effect"],
}
ACTION_FIELDS = ["name", "trigger", "detail"]
PROFILE_FIELDS = ["name", "effect", "on_hit", "on_attack", "on_crit"]
CORE_FIELDS = ["name", "description", "passive_name", "passive_effect", "active_name", "active_effect"]


def read_json(path):
    def unique(pairs):
        out = {}
        for key, value in pairs:
            if key in out:
                raise ValueError(f"{path}: duplicate key {key}")
            out[key] = value
        return out
    return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=unique)


def text(value):
    if isinstance(value, dict):
        return value.get("detail", "")
    if isinstance(value, list):
        return "<br>".join(value)
    return value if isinstance(value, str) else ""


def pair(locale, raw, path, report):
    report.setdefault("used", set()).add(path)
    if not locale or not locale.get("ru", "").strip():
        return None
    if locale.get("stale"):
        report["skipped"].append(f"{path}: stale")
        return None
    en, ru = locale["en"], locale["ru"]
    if not isinstance(en, str) or not isinstance(ru, str):
        raise ValueError(f"{path}: expected string pair")
    # UUIDs and named substitutions must survive translation verbatim.
    tokens = lambda s: sorted(re.findall(r"@UUID\[[^\]]+\]|\{[A-Za-z_]\w*\}", s))
    if tokens(en) != tokens(ru):
        raise ValueError(f"{path}: changed UUID or placeholder")
    expected = [en]
    raw = text(raw)
    if raw != en:
        expected.append(raw)
        report["adapted"].append(path)
    return {"en": expected, "ru": ru}


def fields(locale, raw, allowed, path, report):
    out = {}
    for field in allowed:
        value = pair(locale.get(field), raw.get(field), f"{path}/{field}", report)
        if value:
            out[field] = value
    return out


def named(locale, raw, allowed, path, report):
    by_name = {}
    for item in raw or []:
        if item["name"] in by_name:
            raise ValueError(f"{path}: ambiguous nested name {item['name']}")
        by_name[item["name"]] = item
    out = {}
    for name, entry in (locale or {}).items():
        if name not in by_name:
            report["skipped"].append(f"{path}/{name}: no raw nested entry")
            continue
        out[name] = fields(entry, by_name[name], allowed, f"{path}/{name}", report)
    return {"$items": out}


def raw_data(base):
    result = {}
    for directory in sorted((ROOT / "upstream").glob("*-data")):
        overrides = normalizer.load_overrides(directory)
        for category in [*FIELDS, "tags"]:
            file = directory / f"{category}.json"
            if not file.exists():
                continue
            for item in read_json(file):
                lid = item.get("id")
                if category == "statuses":
                    lid = lid or item["icon"].replace("-", "", 1)
                if not lid:
                    raise ValueError(f"{file}: missing id")
                key = (category, lid)
                expected = next((entry for entry in base[category] if entry["id"] == lid), None)
                if category in normalizer.NORMALIZERS and expected:
                    normalized = copy.deepcopy(item)
                    patch = overrides.get(category, {}).get(lid)
                    if patch:
                        normalizer.apply_override(normalized, patch, f"{category}/{lid}")
                    if normalizer.NORMALIZERS[category](normalized) != expected:
                        raise ValueError(f"{file}/{lid}: normalized data is out of sync with upstream")
                if key in result and result[key] != item:
                    raise ValueError(f"{file}: conflicting id {lid}")
                result[key] = item
    return result


def build():
    base = load_combined_data(quiet=True)
    raw = raw_data(base)
    report = {"target": "Foundry 13 / LANCER 3.1.3 / Babele 2.9.1", "entries": {},
              "adapted": [], "skipped": [],
              "limits": ["NPC, bonds, reserves, journals and arbitrary pilot backgrounds have no source translation.",
                         "Folded prose is retained in the parent description; separate action/deployable text may remain English.",
                         "Existing world and embedded Items are not migrated."]}
    aliases = read_json(MODULE / "aliases.json")
    packs = {name: {"entries": {}} for name in ["world.mech-items", "world.pilot-items", "world.status-items"]}
    runtime = {"tags": {}}
    unused = []

    def translated_paths(node, path):
        if not isinstance(node, dict):
            return
        if "en" in node and "ru" in node:
            if isinstance(node["ru"], str) and node["ru"].strip():
                unused.append(path)
            return
        for key, value in node.items():
            translated_paths(value, f"{path}/{key}")

    for category in [*FIELDS, "tags"]:
        locale = read_json(ROOT / "locales" / "ru" / f"{category}.json")
        if BUILDERS[f"{category}.json"](base, locale) != locale:
            raise ValueError(f"{category}: refresh locale templates and review stale translations before exporting")
        translated_paths(locale, category)
        indexed = {}
        for item in base[category]:
            if item["id"] in indexed:
                raise ValueError(f"{category}: duplicate normalized id {item['id']}")
            indexed[item["id"]] = item
        report["entries"][category] = 0
        for lid, entry in locale.items():
            if lid not in indexed:
                raise ValueError(f"{category}/{lid}: no normalized entry")
            target_lid = aliases.get(category, {}).get(lid, lid)
            source = raw.get((category, target_lid)) or raw.get((category, lid))
            if not source:
                report["skipped"].append(f"{category}/{lid}: no raw entry")
                continue
            path = f"{category}/{lid}"
            name = pair(entry.get("name"), source.get("name"), f"{path}/name", report)
            if category == "tags":
                runtime["tags"][target_lid] = fields(entry, source, ["name", "description"], path, report)
                report["entries"][category] += 1
                continue
            content = fields(entry, source, FIELDS[category], path, report)
            if category == "frames":
                content["traits"] = named(entry.get("traits"), source.get("traits"), ["name", "description"], path + "/traits", report)
                cs = source.get("core_system", {})
                content["core_system"] = fields(entry.get("core_system", {}), cs, CORE_FIELDS, path + "/core_system", report)
                for mode in ["active_actions", "passive_actions"]:
                    content["core_system"][mode] = named(entry.get("core_system", {}).get(mode), cs.get(mode), ACTION_FIELDS, path + "/core_system/" + mode, report)
            elif category == "talents":
                content["ranks"] = named(entry.get("ranks"), source.get("ranks"), ["name", "description"], path + "/ranks", report)
            elif category == "weapons":
                if source.get("profiles"):
                    profiles = named(entry.get("profiles"), source["profiles"], PROFILE_FIELDS, path + "/profiles", report)
                    for prof in source["profiles"]:
                        translated = profiles["$items"].get(prof["name"])
                        if translated is not None:
                            translated["actions"] = named(entry.get("profiles", {}).get(prof["name"], {}).get("actions"), prof.get("actions"), ACTION_FIELDS, path + "/profiles/" + prof["name"] + "/actions", report)
                else:
                    profiles = {"$items": {source["name"]: fields(entry, source, PROFILE_FIELDS, path, report)}}
                content["profiles"] = profiles
            item_type = TYPES.get(category)
            if category == "pilot_gear":
                item_type = {"Armor": "pilot_armor", "Weapon": "pilot_weapon", "Gear": "pilot_gear"}[source["type"]]
            pack = "world.mech-items" if category in ["frames", "weapons", "systems", "mods"] else "world.status-items" if category == "statuses" else "world.pilot-items"
            key = f"{item_type}:{target_lid}"
            payload = {"name": name, "content": content}
            if category == "statuses":
                payload["statusEffects"] = {"$items": {source["name"]: {"name": name, "description": content.get("effects")}}}
            if key in packs[pack]["entries"]:
                raise ValueError(f"{pack}: duplicate entry {key}")
            packs[pack]["entries"][key] = payload
            if target_lid != lid:
                # External V2 LCPs can keep the original, explicit status ID.
                packs[pack]["entries"][f"{item_type}:{lid}"] = payload
            report["entries"][category] += 1
            if category == "mods":
                for field in ["on_hit", "on_attack", "on_crit"]:
                    if entry.get(field, {}).get("ru"):
                        report["skipped"].append(f"{path}/{field}: no target field in unpackWeaponMod")
    used = report.pop("used", set())
    already_reported = {line.split(": ", 1)[0] for line in report["skipped"]}
    report["skipped"].extend(f"{path}: no supported target field" for path in unused if path not in used and path not in already_reported)
    for key in ["adapted", "skipped"]:
        report[key] = sorted(set(report[key]))
    files = {f"compendium/{name}.json": json.dumps(payload, ensure_ascii=False, indent=2) + "\n" for name, payload in packs.items()}
    files["generated/runtime-data.js"] = "// Generated by tools/export_foundry_locale.py; do not edit.\nexport default " + json.dumps(runtime, ensure_ascii=False, indent=2) + ";\n"
    files["coverage.json"] = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    return files, report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail if committed generated files differ")
    parser.add_argument("--zip", action="store_true", help="also create foundry/releases/lancer-ru-content.zip")
    args = parser.parse_args()
    files, report = build()
    for name, content in files.items():
        path = MODULE / name
        if args.check:
            if not path.exists() or path.read_text(encoding="utf-8") != content:
                raise ValueError(f"Outdated export: {path.relative_to(ROOT)}")
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8", newline="\n")
    if args.zip:
        output = ROOT / "foundry" / "releases" / "lancer-ru-content.zip"
        output.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
            for path in sorted(MODULE.rglob("*")):
                if path.is_file():
                    archive.write(path, "lancer-ru-content/" + path.relative_to(MODULE).as_posix())
        print(f"ZIP: {output.relative_to(ROOT)}")
    print(f"Foundry locale: {sum(report['entries'].values())} entries, {len(report['adapted'])} adapted fields, {len(report['skipped'])} reported gaps")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    try:
        main()
    except (ValueError, KeyError) as error:
        sys.exit(str(error))
