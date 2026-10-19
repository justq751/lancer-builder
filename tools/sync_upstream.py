#!/usr/bin/env python3
"""
sync_upstream.py
----------------
Keeps raw snapshots of the official Massif Press data repositories in
upstream/<name>/ (their lib/*.json, byte-for-byte) and pins each one to a
commit in upstream/upstream.lock.json. The snapshots are the source of truth
for "what did Massif change": after a pull, `git diff upstream/` shows it.

The site never reads upstream/ — data/lancer-data.json and data/packs/*.json
are still produced from it by tools/normalize_pack.py (see upstream/README.md).

  py tools/sync_upstream.py status            # locked commit vs remote HEAD, no download
  py tools/sync_upstream.py pull              # refresh every repo to its remote HEAD
  py tools/sync_upstream.py pull ktb-data     # only the named repos
  py tools/sync_upstream.py pull ktb-data --ref 2.0.2   # a tag/branch/commit instead of HEAD

Needs git on PATH. Exits 1 from `status` when something is behind (handy in CI).
"""
import argparse
import json
import pathlib
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
UP = ROOT / "upstream"
LOCK = UP / "upstream.lock.json"

# name -> site file it feeds (the core book is data/lancer-data.json, packs are data/packs/<name>.json)
REPOS = [
    "lancer-data",
    "ktb-data",
    "dustgrave-data",
    "long-rim-data",
    "osr-data",
    "ssmr-data",
    "sotw-data",
    "wallflower-data",
    "ows-data",
]


def url(name):
    return f"https://github.com/massif-press/{name}"


def git(*args, cwd=None):
    return subprocess.run(["git", *args], cwd=cwd, check=True,
                          capture_output=True, text=True).stdout.strip()


def load_lock():
    if LOCK.exists():
        return json.loads(LOCK.read_text(encoding="utf-8"))
    return {}


def save_lock(lock):
    ordered = {n: lock[n] for n in REPOS if n in lock}
    LOCK.write_text(json.dumps(ordered, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def remote_head(name):
    return git("ls-remote", url(name), "HEAD").split()[0]


def read_version(repo_dir):
    for f in (repo_dir / "lib" / "lcp_manifest.json", repo_dir / "package.json"):
        if f.exists():
            v = json.loads(f.read_text(encoding="utf-8")).get("version")
            if v:
                return v
    return None


def pull(name, ref, lock):
    with tempfile.TemporaryDirectory() as tmp:
        repo = pathlib.Path(tmp) / name
        git("clone", "--quiet", "--filter=blob:none", "--no-checkout", url(name), str(repo))
        git("checkout", "--quiet", ref or "HEAD", cwd=repo)
        commit = git("rev-parse", "HEAD", cwd=repo)
        date = git("log", "-1", "--format=%cs", cwd=repo)
        lib = repo / "lib"
        if not lib.is_dir():
            sys.exit(f"{name}: no lib/ at {commit[:7]}")
        dest = UP / name
        if dest.exists():
            shutil.rmtree(dest)
        dest.mkdir(parents=True)
        for f in sorted(lib.glob("*.json")):
            shutil.copy2(f, dest / f.name)
        old = lock.get(name, {}).get("commit")
        lock[name] = {
            "repo": url(name),
            "commit": commit,
            "date": date,
            "version": read_version(repo),
        }
    mark = "unchanged" if old == commit else f"{(old or 'none')[:7]} -> {commit[:7]}"
    print(f"{name:16} {lock[name]['version'] or '?':8} {date}  {mark}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("status")
    p = sub.add_parser("pull")
    p.add_argument("names", nargs="*", metavar="name")
    p.add_argument("--ref", help="tag/branch/commit to pin instead of remote HEAD (one repo only)")
    args = ap.parse_args()

    lock = load_lock()
    if args.cmd == "status":
        behind = 0
        for n in REPOS:
            mine = lock.get(n, {}).get("commit")
            head = remote_head(n)
            state = "up to date" if mine == head else f"BEHIND {(mine or 'none')[:7]} -> {head[:7]}"
            behind += mine != head
            print(f"{n:16} {state}")
        sys.exit(1 if behind else 0)

    names = args.names or REPOS
    unknown = set(names) - set(REPOS)
    if unknown:
        sys.exit(f"unknown repo(s): {', '.join(sorted(unknown))}; known: {', '.join(REPOS)}")
    if args.ref and len(names) != 1:
        sys.exit("--ref needs exactly one repo name")
    UP.mkdir(exist_ok=True)
    for n in names:
        pull(n, args.ref, lock)
    save_lock(lock)
    print("\nReview: git diff --stat upstream/  then follow upstream/README.md")


if __name__ == "__main__":
    main()
