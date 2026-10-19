#!/usr/bin/env python3
"""
locale_coverage.py
------------------
Translation coverage of /locales/<lang>/*.json: per file, how many
{"en", "ru"} pairs with non-empty English have a non-empty translation,
and which ones are still empty. Informational only — always exits 0, so
CI can print it without failing (a partial translation is a working site).

Usage:
    python3 tools/locale_coverage.py [--lang ru] [--list] [--markdown]

    --list      also print every untranslated and stale path (file: id/field/...)
    --markdown  GitHub-flavoured table, for $GITHUB_STEP_SUMMARY

Also reports "generator drift": files that extract_locale_template.py would
rewrite (new entries, refreshed English, dropped fields) — a sign the
template should be regenerated before translating.
"""
import argparse
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import extract_locale_template as gen  # noqa: E402

ROOT = gen.ROOT


def filled(ru, en):
    """A plural entry (ui.json) counts only when every Russian form is set."""
    if isinstance(en, dict):
        return isinstance(ru, dict) and bool(ru) and all(str(v).strip() for v in ru.values())
    return isinstance(ru, str) and bool(ru.strip())


def walk(node, path, out, stale):
    """Collect (path, translated?) for every pair whose English is non-empty,
    and the paths of pairs marked "stale" (English changed since translation)."""
    if not isinstance(node, dict):
        return
    if "en" in node and "ru" in node:
        en = node["en"]
        if (isinstance(en, str) and en.strip()) or (isinstance(en, dict) and en):
            out.append(("/".join(path), filled(node["ru"], en)))
        if node.get("stale"):
            stale.append("/".join(path))
        return
    for key, value in node.items():
        if key.startswith("_"):  # "_comment" and friends
            continue
        walk(value, path + [key], out, stale)


def drifted_files(lang):
    """Locale files whose content differs from what the generator would write."""
    data = gen.load_combined_data(quiet=True)
    out_dir = ROOT / "locales" / lang
    result = []
    for filename, builder in gen.BUILDERS.items():
        path = out_dir / filename
        old = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
        if builder(data, old) != old:
            result.append(filename)
    ui_path = out_dir / "ui.json"
    if gen.UI_FILE.exists():
        old = json.loads(ui_path.read_text(encoding="utf-8")) if ui_path.exists() else {}
        if gen.build_ui(old) != old:
            result.append("ui.json")
    return result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", default="ru")
    ap.add_argument("--list", action="store_true", help="print every untranslated path")
    ap.add_argument("--markdown", action="store_true", help="markdown table output")
    args = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")  # ids like ms_jäger_kunst_ii on a cp1251 console

    rows, missing, stale = [], {}, {}
    for path in sorted((ROOT / "locales" / args.lang).glob("*.json")):
        pairs, stale_paths = [], []
        doc = json.loads(path.read_text(encoding="utf-8"))
        walk(doc, [], pairs, stale_paths)
        if stale_paths:
            stale[path.name] = stale_paths
        todo = [p for p, ok in pairs if not ok]
        rows.append((path.name, len(pairs) - len(todo), len(pairs)))
        if todo:
            missing[path.name] = todo

    done = sum(r[1] for r in rows)
    total = sum(r[2] for r in rows)
    drift = drifted_files(args.lang)

    if args.markdown:
        print(f"### Locale coverage ({args.lang}): {done}/{total} ({100 * done / max(total, 1):.1f}%)\n")
        print("| File | Translated | Total | Missing |\n|---|---:|---:|---:|")
        for name, d, n in rows:
            print(f"| `{name}` | {d} | {n} | {n - d or ''} |")
    else:
        for name, d, n in rows:
            print(f"{name:20s} {d:5d} / {n:5d}" + (f"   missing {n - d}" if n - d else ""))
        print(f"{'total':20s} {done:5d} / {total:5d}  ({100 * done / max(total, 1):.1f}%)")

    notes = []
    for name, paths in stale.items():
        notes.append(f'{name}: {len(paths)} translation(s) marked "stale" (English changed since)')
    if drift:
        notes.append("generator drift — extract_locale_template.py would rewrite: " + ", ".join(drift))
    for note in notes:
        print(("\n- " if args.markdown else "\n") + note)

    if args.list and (missing or stale):
        print("\n```" if args.markdown else "")
        for name, todo in missing.items():
            for p in todo:
                print(f"{name}: {p}")
        for name, paths in stale.items():
            for p in paths:
                print(f"{name}: {p}  [stale]")
        if args.markdown:
            print("```")


if __name__ == "__main__":
    main()
