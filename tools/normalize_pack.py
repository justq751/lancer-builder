#!/usr/bin/env python3
"""
normalize_pack.py
------------------
massif-press/osr-data and massif-press/wallflower-data use a newer
lancer-data schema than the one baked into this site originally:
  - tags are objects {"id": "tg_reliable", "val": 2} instead of plain
    strings like "Reliable 2"
  - extra ability text can live in "actions" / "deployables" arrays
    instead of directly in "effect" / "core_system.*_effect"

This script converts items from that newer schema into the flatter
shape data/lancer-data.json already uses, so the existing renderer
(index.html) can display them with zero changes:
  - tag objects -> plain display strings ("Reliable 2", "Armor-Piercing (AP)")
  - actions/deployables -> folded into "effect" / "*_effect" as extra
    <br><b>Name</b> — detail lines, so nothing from the source pack is lost
Unsupported categories (reserves, environments — the app has no UI/tab
for these at all) are intentionally left out; see README.
"""
import json
import sys
import pathlib

TAG_WORDS = {
    "tg_accurate": "Accurate",
    "tg_ai": "AI",
    "tg_ap": "Armor-Piercing (AP)",
    "tg_danger_zone": "Danger Zone",
    "tg_exotic": "Exotic Gear",
    "tg_gear": "Gear",
    "tg_limited": "Limited",
    "tg_loading": "Loading",
    "tg_no_cascade": "Prevent Cascade",
    "tg_ordnance": "Ordnance",
    "tg_overkill": "Overkill",
    "tg_personal_armor": "Personal Armor",
    "tg_pilot_weapon": "Pilot Weapon",
    "tg_quick_action": "Quick Action",
    "tg_reliable": "Reliable",
    "tg_smart": "Smart",
    "tg_unique": "Unique",
    "tg_set_damage_type": "Set Damage Type",
    "tg_thrown": "Thrown",
    "tg_knockback": "Knockback",
    "tg_heat": "Heat",
    "tg_arcing": "Arcing",
    "tg_seeking": "Seeking",
    "tg_indestructible": "Indestructible",
    "tg_invisible": "Invisible",
    "tg_shield": "Shield",
    "tg_archaic": "Archaic",
    "tg_sidearm": "Sidearm",
    "tg_grenade": "Grenade",
    "tg_resistance_all": "Resistance (All)",
}


def tag_to_string(tag):
    if isinstance(tag, str):
        return tag
    tid = tag.get("id", "")
    base = TAG_WORDS.get(tid, tid.replace("tg_", "").replace("_", " ").title())
    val = tag.get("val")
    return f"{base} {val}" if val not in (None, "") else base


def fold_actions(base_text, actions):
    """Append action name/detail pairs as extra <br><b>…</b> lines."""
    if not actions:
        return base_text
    parts = [base_text] if base_text else []
    for a in actions:
        label = a.get("name") or a.get("activation") or ""
        detail = a.get("detail", "")
        if label:
            parts.append(f"<br><b>{label}</b> — {detail}")
        else:
            parts.append(f"<br>{detail}")
    return "".join(parts)


def fold_deployables(base_text, deployables):
    if not deployables:
        return base_text
    parts = [base_text] if base_text else []
    for dep in deployables:
        name = dep.get("name", "Deployable")
        detail = dep.get("detail", "")
        parts.append(f"<br><b>Deployable — {name}:</b> {detail}")
        for a in dep.get("actions", []) or []:
            label = a.get("name") or a.get("activation") or ""
            adetail = a.get("detail", "")
            parts.append(f"<br><b>{label}</b> — {adetail}")
    return "".join(parts)


def norm_tags(item):
    if "tags" in item and item["tags"]:
        item["tags"] = [tag_to_string(t) for t in item["tags"]]


def norm_frame(f):
    norm_tags(f)
    cs = f.get("core_system")
    if cs and cs.get("passive_actions"):
        cs["passive_effect"] = fold_actions(cs.get("passive_effect", ""), cs["passive_actions"])
        del cs["passive_actions"]
    for tr in f.get("traits", []) or []:
        tr.pop("bonuses", None)
        tr.pop("synergies", None)
    f.pop("image_url", None)
    f.pop("y_pos", None)
    return f


def norm_weapon(w):
    norm_tags(w)
    for p in w.get("profiles", []) or []:
        norm_tags(p)
    w.pop("license_id", None)
    w.pop("data_type", None)
    return w


def norm_system(s):
    norm_tags(s)
    s["effect"] = fold_actions(s.get("effect", ""), s.get("actions"))
    s["effect"] = fold_deployables(s["effect"], s.get("deployables"))
    for k in ("actions", "deployables", "license_id", "data_type", "aptitude", "bonuses", "synergies"):
        s.pop(k, None)
    return s


def norm_talent(t):
    for r in t.get("ranks", []) or []:
        r.pop("synergies", None)
        r.pop("bonuses", None)
    return t


def norm_pilot_gear(g):
    norm_tags(g)
    g["effect"] = fold_actions(g.get("effect", ""), g.get("actions"))
    g.pop("actions", None)
    g.pop("data_type", None)
    return g


NORMALIZERS = {
    "frames": norm_frame,
    "weapons": norm_weapon,
    "systems": norm_system,
    "talents": norm_talent,
    "pilot_gear": norm_pilot_gear,
}


def build_pack(lib_dir, out_path, item_prefix):
    lib_dir = pathlib.Path(lib_dir)
    out = {}
    for cat, fn in NORMALIZERS.items():
        src = lib_dir / f"{cat}.json"
        if not src.exists():
            out[cat] = []
            continue
        items = json.loads(src.read_text(encoding="utf-8"))
        out[cat] = [fn(it) for it in items]
    pathlib.Path(out_path).write_text(
        json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )
    counts = {k: len(v) for k, v in out.items()}
    print(f"{item_prefix}: {counts}")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("usage: normalize_pack.py <lib_dir> <out_path> <label>")
        sys.exit(1)
    build_pack(sys.argv[1], sys.argv[2], sys.argv[3])
