#!/usr/bin/env python3
"""
merge_frames.py — takes the "frames" array out of a normalize_pack.py
output file and drops it into a target data file (a data/packs/*.json pack,
or lancer-data.json), leaving every other key in the target completely
untouched (weapons/systems/talents/etc. stay exactly as they were).

Usage:
    python merge_frames.py <normalized_file> <target_file>

Examples:
    python merge_frames.py output.json ../data/packs/long-rim-data.json
    python merge_frames.py lancer_frames.json ../lancer-data.json

A backup of the target file is written next to it as "<target>.bak" before
it's overwritten, so you can always undo by renaming the .bak back.
"""
import json
import sys
import pathlib
import shutil


def merge_frames(normalized_path, target_path):
    normalized_path = pathlib.Path(normalized_path)
    target_path = pathlib.Path(target_path)

    if not normalized_path.exists():
        print(f"ERROR: '{normalized_path}' not found.")
        sys.exit(1)
    if not target_path.exists():
        print(f"ERROR: '{target_path}' not found.")
        sys.exit(1)

    normalized = json.loads(normalized_path.read_text(encoding="utf-8"))
    if "frames" not in normalized:
        print(f"ERROR: '{normalized_path}' has no \"frames\" key — nothing to merge.")
        print(f"        (did you point this at the file normalize_pack.py wrote?)")
        sys.exit(1)
    new_frames = normalized["frames"]
    if not isinstance(new_frames, list):
        print(f"ERROR: \"frames\" in '{normalized_path}' isn't a list — refusing to merge.")
        sys.exit(1)

    target = json.loads(target_path.read_text(encoding="utf-8"))
    old_frames = target.get("frames", [])
    old_count = len(old_frames)

    # Quick sanity check: warn (but don't block) if this looks like it would
    # drop ids that were only present in the old file — usually a sign you
    # pointed this at the wrong pair of files.
    old_ids = {f.get("id") for f in old_frames if isinstance(f, dict)}
    new_ids = {f.get("id") for f in new_frames if isinstance(f, dict)}
    missing = old_ids - new_ids
    if missing:
        print(f"WARNING: {len(missing)} frame id(s) in the old \"{target_path.name}\" "
              f"don't appear in the new data and will be dropped:")
        for mid in sorted(missing):
            print(f"  - {mid}")
        answer = input("Continue anyway? [y/N] ").strip().lower()
        if answer != "y":
            print("Aborted — target file left unchanged.")
            sys.exit(1)

    backup_path = target_path.with_suffix(target_path.suffix + ".bak")
    shutil.copyfile(target_path, backup_path)

    target["frames"] = new_frames
    target_path.write_text(
        json.dumps(target, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )

    print(f"OK: {target_path.name} frames {old_count} -> {len(new_frames)}")
    print(f"    backup saved to {backup_path.name}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("usage: merge_frames.py <normalized_file> <target_file>")
        print()
        print("  <normalized_file>  the file normalize_pack.py wrote (any name you gave it)")
        print("  <target_file>      the project data file to update in place")
        print("                     (e.g. ../lancer-data.json or ../data/packs/ktb-data.json)")
        sys.exit(1)
    merge_frames(sys.argv[1], sys.argv[2])
