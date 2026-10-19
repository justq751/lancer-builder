#!/usr/bin/env python3
"""
normalize_pack.py
------------------
Converts one massif-press data repo (lib/*.json — normally its snapshot in
upstream/<repo>/, see upstream/README.md) into the site's data file:
data/lancer-data.json for lancer-data itself, data/packs/<repo>.json for the
rest. The upstream schema differs from what the renderer reads:
  - tags are objects {"id": "tg_reliable", "val": 2} instead of plain
    strings like "Reliable 2"
  - extra ability text can live in "actions" / "deployables" arrays
    instead of directly in "effect" / "core_system.*_effect"

This script flattens it so the renderer needs no changes:
  - tag objects -> the display strings of data/tags.json ("Reliable 2",
    "Heat 2 (Self)", "1/Round")
  - actions/deployables -> folded into "effect" / rank "description" as extra
    <br><b>Name</b> — detail lines, unless the prose already says the same
    (already_described()); frame core systems keep structured actions
  - engine-hook fields the app never reads (synergies, active_effects,
    counters, talent_* …, see HOOKS) are dropped
Unsupported categories (reserves, environments — the app has no UI/tab
for these at all) are intentionally left out; see README.
"""
import difflib
import hashlib
import json
import re
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


# The site's own tag dictionary: {"id": "tg_heat_self", "name": "Heat {VAL} (Self)"}.
# Its names are the strings the app compares and trTag() translates, so it
# wins over TAG_WORDS (kept for the few ids tags.json lacks).
TAG_NAMES = {t["id"]: t["name"] for t in json.loads(
    (pathlib.Path(__file__).resolve().parent.parent / "data" / "tags.json").read_text(encoding="utf-8"))}


def tag_to_string(tag):
    if isinstance(tag, str):
        return tag
    tid = tag.get("id", "")
    val = tag.get("val")
    has_val = val not in (None, "")
    tpl = TAG_NAMES.get(tid)
    if tpl and "{VAL}" in tpl:
        return tpl.replace("{VAL}", str(val)) if has_val else tpl.replace(" {VAL}", "").replace("{VAL}", "")
    base = tpl or TAG_WORDS.get(tid, tid.replace("tg_", "").replace("_", " ").title())
    return f"{base} {val}" if has_val else base


def fold_actions(base_text, actions, with_meta=False):
    """Append action name/detail pairs as extra <br><b>…</b> lines. A
    reaction's trigger is kept ("<i>Trigger:</i> …"), it is often nowhere
    else; with_meta also adds "(Reaction, 1/scene)" after the name. Actions
    the text already_described() are skipped."""
    actions = [a for a in actions or [] if not already_described(a.get("detail"), base_text)]
    if not actions:
        return base_text
    parts = [base_text] if base_text else []
    for a in actions:
        label = a.get("name") or a.get("activation") or ""
        detail = a.get("detail", "")
        meta = [m for m in (a.get("activation"), a.get("frequency")) if m] if with_meta else []
        if meta:
            label = f"{label} ({', '.join(meta)})"
        if a.get("trigger"):
            detail = f"<i>Trigger:</i> {a['trigger']}<br>{detail}"
        if label:
            parts.append(f"<br><b>{label}</b> — {detail}")
        else:
            parts.append(f"<br>{detail}")
    return "".join(parts)


def _plain(text):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", text or "")).strip().lower()


def already_described(detail, description):
    """True when description already spells out the action's detail (most
    talents repeat it in prose): >= 80% of the detail's characters fall in
    runs of 12+ characters that also occur in the description."""
    a, b = _plain(detail), _plain(description)
    if not a:
        return True
    m = difflib.SequenceMatcher(None, a, b, autojunk=False)
    return sum(x.size for x in m.get_matching_blocks() if x.size >= 12) / len(a) >= 0.8


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


# Engine hooks for tools that automate play (COMP/CON); the app reads none of
# them, and data/lancer-data.json never had them.
HOOKS = ("license_id", "data_type", "bonuses", "synergies", "active_effects", "counters",
         "add_resist", "ammo", "talent_id", "talent_item", "talent_rank", "no_attack",
         "no_mods", "no_core_bonus", "no_synergies", "no_bonuses", "barrage", "skirmish",
         "aptitude", "icon_url", "image_url", "integrated", "special_equipment")


def drop(item, keys=HOOKS):
    for k in keys:
        item.pop(k, None)


def fold_into(item, field, with_meta=False):
    """Fold item's actions and deployables into item[field] and drop them."""
    text = fold_actions(item.get(field) or "", item.get("actions"), with_meta)
    text = fold_deployables(text, item.get("deployables"))
    if text or field in item:
        item[field] = text
    item.pop("actions", None)
    item.pop("deployables", None)


def norm_tags(item):
    if "tags" in item and item["tags"]:
        item["tags"] = [tag_to_string(t) for t in item["tags"]]


def _strip_duplicated_action_tail(effect_text, actions):
    """Some upstream frame data already bakes a '<br><b>ActionName</b> —
    detail' tail onto the end of passive_effect/active_effect, duplicating
    what's also present as a structured entry in passive_actions/
    active_actions. Since the renderer shows the structured action as its
    own stat-block right below this text, keeping the baked-in tail would
    show the same detail twice. Trim the text at the first such tail that
    matches one of this ability's own actions by name."""
    if not effect_text or not actions:
        return effect_text
    for act in actions:
        name = act.get("name")
        if not name:
            continue
        marker = f"<br><b>{name}</b>"
        idx = effect_text.find(marker)
        if idx != -1:
            return effect_text[:idx]
    return effect_text


def norm_frame(f):
    norm_tags(f)
    cs = f.get("core_system")
    if cs:
        # Do NOT fold passive_actions/active_actions into the prose fields —
        # the app's renderer (frameTraitsCoreHTML/actionBlockHTML) shows the
        # effect text AND a structured stat-block for each action side by
        # side, so folding (or leaving an already-folded tail baked in by
        # the source) would duplicate the action's own detail text a second
        # time. Strip any such tail and leave the rest of the prose as-is.
        for eff, acts in (("passive_effect", "passive_actions"), ("active_effect", "active_actions")):
            if eff in cs:
                cs[eff] = _strip_duplicated_action_tail(cs[eff], cs.get(acts))
    for tr in f.get("traits", []) or []:
        tr.pop("bonuses", None)
        tr.pop("synergies", None)
    f.pop("image_url", None)
    f.pop("y_pos", None)
    return f


def norm_weapon(w):
    norm_tags(w)
    fold_into(w, "effect")
    for p in w.get("profiles", []) or []:
        norm_tags(p)
        fold_into(p, "effect")
        drop(p)
    drop(w)
    return w


def norm_system(s):
    norm_tags(s)
    fold_into(s, "effect")
    s.setdefault("type", "System")  # upstream omits the default type
    drop(s)
    return s


def norm_talent(t):
    # rank-level active_effects/counters/special_equipment/integrated are
    # structured "engine hook" metadata for tools that auto-trigger abilities
    # and are dropped. Rank "actions" usually repeat the description's prose,
    # but some packs keep the mechanic only there (Empath, Prospector,
    # Orator): those not already_described() are folded into the description.
    drop(t, HOOKS + ("icon",))
    for r in t.get("ranks", []) or []:
        fold_into(r, "description", with_meta=True)
        drop(r, HOOKS + ("exclusive",))
    return t


def norm_pilot_gear(g):
    norm_tags(g)
    fold_into(g, "effect")
    drop(g, tuple(k for k in HOOKS if k != "bonuses"))
    # NOTE: do NOT strip "bonuses" here — unlike the unused "bonuses"/
    # "synergies" fields on frame traits/systems/etc., pilot_gear.bonuses is
    # the actual mechanical data for Armor-type gear (pilot_hp, pilot_armor,
    # pilot_evasion, pilot_edef, pilot_speed) and is read by the renderer.
    return g


def norm_core_bonus(c):
    fold_into(c, "effect")
    drop(c)
    return c


def norm_mod(m):
    norm_tags(m)
    if "added_tags" in m and m["added_tags"]:
        m["added_tags"] = [tag_to_string(t) for t in m["added_tags"]]
    # wm_shock_wreath (lancer-data core mods) has "actions" as a bare object
    # instead of a list like every other mod — normalize the shape so
    # whatever eventually consumes this category can assume list-or-absent.
    if isinstance(m.get("actions"), dict):
        m["actions"] = [m["actions"]]
    drop(m, ("license_id", "data_type"))
    return m


def norm_background(b):
    # Already flat (id/name/description); "skills" — suggested skill ids —
    # is kept, the app just doesn't show it.
    return b


def norm_skill(s):
    s.pop("family", None)
    return s


def norm_manufacturer(m):
    drop(m, ("logo", "logo_url", "light", "dark", "quote"))  # the app styles manufacturers itself
    return m


NORMALIZERS = {
    "frames": norm_frame,
    "weapons": norm_weapon,
    "systems": norm_system,
    "talents": norm_talent,
    "skills": norm_skill,
    "core_bonuses": norm_core_bonus,
    "pilot_gear": norm_pilot_gear,
    "backgrounds": norm_background,
    "manufacturers": norm_manufacturer,
    "mods": norm_mod,
}
# Only lancer-data has these; packs don't get empty arrays for them.
CORE_ONLY = {"skills", "manufacturers"}


def fingerprint(item):
    return hashlib.sha1(json.dumps(item, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()[:12]


def load_overrides(lib_dir):
    """Hand-written fixes for data upstream gets wrong or lacks, kept beside
    the snapshots: upstream/overrides/<repo>.json =
    {category: {id: {"_reason": "...", "_upstream": "<fingerprint>", field: value}}}.
    Fields replace the upstream ones (null removes one) before normalization,
    so values use the raw upstream schema."""
    path = lib_dir.parent / "overrides" / f"{lib_dir.name}.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def apply_override(item, patch, where):
    """_upstream is the fingerprint of the upstream item the patch was written
    against; when upstream changes that item, the patch needs a recheck."""
    seen = fingerprint(item)
    if patch.get("_upstream") != seen:
        print(f"  ! override {where}: upstream item changed (fingerprint {seen}, "
              f"override written for {patch.get('_upstream')}) — recheck it, then update _upstream")
    for k, v in patch.items():
        if k.startswith("_"):
            continue
        if v is None:
            item.pop(k, None)
        else:
            item[k] = v
    return item


def build_pack(lib_dir, out_path, item_prefix):
    lib_dir = pathlib.Path(lib_dir)
    overrides = load_overrides(lib_dir)
    out = {}
    for cat, fn in NORMALIZERS.items():
        src = lib_dir / f"{cat}.json"
        if not src.exists():
            if cat not in CORE_ONLY:
                out[cat] = []
            continue
        items = json.loads(src.read_text(encoding="utf-8"))
        patches = dict(overrides.get(cat, {}))
        for it in items:
            if it.get("id") in patches:
                apply_override(it, patches.pop(it["id"]), f"{cat}/{it['id']}")
        for missing in patches:
            print(f"  ! override {cat}/{missing}: no such item upstream")
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
