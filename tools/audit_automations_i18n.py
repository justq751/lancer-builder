#!/usr/bin/env python3
"""Sync the Russian sources for lancer-automations with an installed copy of the module.

    py tools/audit_automations_i18n.py <path to lancer-automations>

Updates foundry/upstream/lancer-automations/ (VERSION, literals.json) and
foundry/locales/ru/automations-lang.json (new keys get an empty "ru", changed
English is marked "stale", vanished keys are dropped), then prints coverage.
The module itself is never modified. Always exits 0.
"""
import html
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / "foundry" / "upstream" / "lancer-automations"
SOURCES = ROOT / "foundry" / "locales" / "ru"
LANG_FILE = SOURCES / "automations-lang.json"
TEXT_FILE = SOURCES / "automations-text.json"
FORMAT_FILE = SOURCES / "automations-format.json"
CODE_DIRS = ["scripts", "startups"]
NAME_FILES = ["frames", "weapons", "systems", "mods", "talents", "core_bonuses", "pilot_gear", "skills"]


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def flatten(node, prefix=""):
    for key, value in node.items():
        path = f"{prefix}.{key}" if prefix else key
        if isinstance(value, dict):
            yield from flatten(value, path)
        else:
            yield path, value


def merge_lang(english, current):
    """Keep translations by key; mark changed English stale; drop vanished keys."""
    out = {}
    for key, en in english.items():
        old = current.get(key)
        entry = {"en": en, "ru": old["ru"] if old else ""}
        if old and old["ru"] and (old.get("stale") or old["en"] != en):
            entry["stale"] = True
        out[key] = entry
    return out


# --- terms shared with the site ------------------------------------------------

def terms():
    """English term -> Russian, from the site's locales; ambiguous terms are left out."""
    seen = {}

    def add(en, ru):
        if isinstance(en, str) and isinstance(ru, str) and en.strip() and ru.strip():
            seen.setdefault(en, set()).add(ru)

    loc = lambda name: read(ROOT / "locales" / "ru" / f"{name}.json")
    for entry in loc("actions").values():
        add(entry["name"]["en"], entry["name"]["ru"])
    for entry in loc("statuses").values():
        add(entry["name"]["en"], entry["name"]["ru"])
    for section, entries in loc("enums").items():
        if isinstance(entries, dict):
            for pair in entries.values():
                if isinstance(pair, dict):
                    add(pair.get("en"), pair.get("ru"))
    for pair in loc("stat_labels").values():
        add(pair["en"], pair["ru"])
    for entry in loc("glossary").values():
        add(entry["name"]["en"], entry["name"]["ru"])
    for name in NAME_FILES:
        for entry in loc(name).values():
            if isinstance(entry, dict) and isinstance(entry.get("name"), dict):
                add(entry["name"]["en"], entry["name"]["ru"])
    return {en: next(iter(ru)) for en, ru in seen.items() if len(ru) == 1}


def term_for(en, table):
    """Exact term, or an UPPERCASE / Title Case spelling of one."""
    if en in table:
        return table[en]
    folded = {key.casefold(): value for key, value in table.items()}
    ru = folded.get(en.casefold())
    if ru is None:
        return None
    if en.isupper():
        return ru.upper()
    if en.islower():
        return ru.lower()
    return ru[0].upper() + ru[1:] if en[:1].isupper() else ru


# --- string literals in code -----------------------------------------------------

TOKEN = re.compile(r"""
    //[^\n]*                                   # line comment
  | /\*.*?\*/                                  # block comment
  | '(?:\\.|[^'\\\n])*'                        # single-quoted
  | "(?:\\.|[^"\\\n])*"                        # double-quoted
  | `(?:\\.|\$\{(?:[^{}]|\{[^{}]*\})*\}|[^`\\])*`  # template (one level of nested braces)
""", re.S | re.X)
HTML_TEXT = re.compile(r">([^<>]+)<")
HTML_ATTR = re.compile(r"""\b(?:title|placeholder|aria-label|data-tooltip)=(["'])(.*?)\1""")
SKIP_LINE = re.compile(r"\bconsole\.\w+\(|\bthrow new\b|\bimport\b|\brequire\(")


def candidate(text):
    """Is this literal plausibly English shown to a player?"""
    text = text.strip()
    if len(text) < 2 or not re.search(r"[A-Za-z]{2}", text):
        return False
    if re.match(r"^(LA|lancer|TYPES)\.[\w.-]+$", text) or text.startswith(("fa-", "fas ", "far ", "mdi ", "http", "modules/", "systems/", "icons/", "#", ".", "[", "@")):
        return False
    if re.search(r"\.(js|png|svg|webp|webm|jpg|json|css|hbs|html|ogg|mp3)\b", text):
        return False
    if re.fullmatch(r"[a-z0-9_$.:/-]+|[a-z]+[A-Z]\w*|[A-Z_0-9]+_[A-Z_0-9]+|[\w-]+\s*[:=]\s*[\w#.%-]+;?", text):
        return False  # ids, camelCase keys, CONSTANTS, css declarations
    if re.search(r"[{};>]\s*$|=>|\(\)|\b(var|const|let|function|return)\b|^//|^:|\w=[\"']|\{…\}/", text):
        return False
    if re.fullmatch(r"\w+(\.\w+)+|[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]*)+", text):
        return False  # dotted paths, PascalCase identifiers
    if re.fullmatch(r"(?=.*-)[a-z0-9_ -]+", text):
        return False  # CSS class lists
    return True


def literals_in(source):
    for match in TOKEN.finditer(source):
        raw = match.group(0)
        if raw.startswith("/"):
            continue
        line = source.count("\n", 0, match.start()) + 1
        line_text = source[source.rfind("\n", 0, match.start()) + 1:source.find("\n", match.start())]
        if SKIP_LINE.search(line_text):
            continue
        body = raw[1:-1]
        if raw[0] == "`":
            # Strings inside ${…} (option labels, nested templates) are literals of their own.
            for inner in re.finditer(r"\$\{((?:[^{}]|\{[^{}]*\})*)\}", raw):
                offset = line - 1 + raw.count("\n", 0, inner.start())
                for inner_line, part in literals_in(inner.group(1)):
                    yield offset + inner_line, part
            body = re.sub(r"\$\{(?:[^{}]|\{[^{}]*\})*\}", "{…}", body)
        body = re.sub(r"\\[nrt]", " ", body.replace("\\'", "'").replace('\\"', '"'))
        body = re.sub(r"\\u([0-9a-fA-F]{4})", lambda m: chr(int(m.group(1), 16)), body)
        if "<" in body and re.search(r"<\w", body):
            # Each piece between tags becomes its own DOM text node (laFormatDetailHtml splits on <br>).
            parts = re.split(r"<[^>]*>", body) + [value for _, value in HTML_ATTR.findall(body)]
        else:
            parts = [body]
        for part in parts:
            part = re.sub(r"\s+", " ", html.unescape(part)).strip()
            if candidate(part) and part != "{…}":
                yield line, part


def literals_in_template(source):
    for pattern in (HTML_TEXT, HTML_ATTR):
        for match in pattern.finditer(source):
            text = match.group(match.lastindex)
            text = re.sub(r"\{\{[^}]*\}\}", "{…}", text)
            text = re.sub(r"\s+", " ", text).strip()
            if candidate(text) and re.sub(r"\{…\}", "", text).strip(" :/-()") and re.search(r"[A-Za-z]{2}", re.sub(r"\{…\}", "", text)):
                yield source.count("\n", 0, match.start()) + 1, text


def extract_literals(module):
    found = {}
    files = [(p, literals_in) for d in CODE_DIRS for p in sorted((module / d).rglob("*.js"))]
    files += [(p, literals_in_template) for p in sorted((module / "templates").rglob("*.hbs"))]
    for path, extract in files:
        rel = path.relative_to(module).as_posix()
        for line, text in extract(path.read_text(encoding="utf-8", errors="replace")):
            found.setdefault(text, []).append(f"{rel}:{line}")
    return dict(sorted(found.items()))


def text_patterns(text_dict):
    """Regex keys of automations-text.json, compiled."""
    return [(re.compile(key[1:-1]), key) for key in text_dict if key.startswith("/") and key.endswith("/")]


def coverage(lang, text_dict, literals, table):
    keys = len(lang)
    manual = sum(1 for e in lang.values() if e["ru"].strip() and not e.get("stale"))
    auto = sum(1 for e in lang.values() if not e["ru"].strip() and term_for(e["en"], table))
    stale = [k for k, e in lang.items() if e.get("stale")]
    by_space = {}
    for key, entry in lang.items():
        space = key.split(".")[1] if key.startswith("LA.") else key.split(".")[0]
        done = bool(entry["ru"].strip()) or bool(term_for(entry["en"], table))
        total, ok = by_space.get(space, (0, 0))
        by_space[space] = (total + 1, ok + done)
    patterns = text_patterns(text_dict)
    # A literal with {…} counts as covered when a pattern matches it with sample values filled in.
    samples = lambda text: {text, text.replace("{…}", "1"), text.replace("{…}", "Kai")}
    covered = lambda text: text in text_dict or term_for(text, table) or any(
        p.fullmatch(sample) for p, _ in patterns for sample in samples(text))
    open_literals = [text for text in literals if not covered(text)]
    vanished = [key for key in text_dict if not key.startswith("/") and key not in literals]
    return {"keys": keys, "manual": manual, "auto": auto, "stale": stale, "by_space": by_space,
            "literals": len(literals), "open_literals": open_literals, "vanished": vanished}


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) != 2:
        print(__doc__)
        return
    module = pathlib.Path(sys.argv[1])
    manifest = read(module / "module.json")
    english = dict(flatten(read(module / "lang" / "en.json")))
    lang = merge_lang(english, read(LANG_FILE) if LANG_FILE.exists() else {})
    write(LANG_FILE, lang)
    literals = extract_literals(module)
    SNAPSHOT.mkdir(parents=True, exist_ok=True)
    (SNAPSHOT / "VERSION").write_text(manifest["version"] + "\n", encoding="utf-8", newline="\n")
    write(SNAPSHOT / "literals.json", literals)
    text_dict = read(TEXT_FILE) if TEXT_FILE.exists() else {}
    report = coverage(lang, text_dict, literals, terms())
    print(f"lancer-automations {manifest['version']}")
    print(f"LA keys: {report['keys']}, translated {report['manual']}, from site terms {report['auto']}, stale {len(report['stale'])}")
    for space, (total, ok) in sorted(report["by_space"].items(), key=lambda item: -item[1][0]):
        print(f"  {space:<20} {ok:>4}/{total:<4}")
    print(f"Code literals: {report['literals']}, without translation {len(report['open_literals'])}")
    for key in report["stale"]:
        print(f"  stale: {key}")
    for key in report["vanished"]:
        print(f"  no longer in code: {key}")


if __name__ == "__main__":
    main()
