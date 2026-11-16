import TEXT from "../generated/automations-text.js";
import FORMAT from "../generated/automations-format.js";

// lancer-automations keeps English in code for logic (effect names, action names, data-la-key);
// only what is already on screen is replaced, and only on an exact match with its English source.
const SCOPE = '.lancer-dialog-base, .lancer-automations-dialog, [class*="la-"], [class*="battelog"], .chat-message, #tooltip, .locked-tooltip, #token-hud';
const SKIP = "input, textarea, select, [contenteditable], script, style, code, pre, .CodeMirror, .cm-editor";
const ATTRS = ["title", "data-tooltip", "aria-label", "placeholder"];
const PATTERNS = TEXT.patterns.map(([source, ru]) => [new RegExp(`^(?:${source})$`), ru]);

export function translateString(value, text = TEXT, patterns = PATTERNS) {
  const [, before, core, after] = /^(\s*)(.*?)(\s*)$/s.exec(value);
  if (!core) return value;
  const key = core.replace(/\s+/g, " ");
  if (Object.hasOwn(text.exact, key)) return before + text.exact[key] + after;
  for (const [pattern, ru] of patterns) {
    if (pattern.test(key)) return before + key.replace(pattern, ru) + after;
  }
  return value;
}

function translateAttributes(element) {
  for (const attr of ATTRS) {
    const original = element.getAttribute(attr);
    if (original === null) continue;
    const value = translateString(original);
    if (value !== original) element.setAttribute(attr, value);
  }
}

function translateTextNode(node) {
  if (node.parentElement?.closest(SKIP)) return;
  const value = translateString(node.nodeValue);
  if (value !== node.nodeValue) node.nodeValue = value;
}

export function translateTree(root) {
  const walker = root.ownerDocument.createTreeWalker(root, 4 /* SHOW_TEXT */);
  while (walker.nextNode()) translateTextNode(walker.currentNode);
  if (root.matches(`[${ATTRS.join("], [")}]`)) translateAttributes(root);
  for (const element of root.querySelectorAll(`[${ATTRS.join("], [")}]`)) translateAttributes(element);
}

function visit(node) {
  if (node.nodeType === 3) {
    if (node.parentElement?.closest(SCOPE)) translateTextNode(node);
  } else if (node.nodeType === 1) {
    if (node.closest(SCOPE)) translateTree(node);
    else for (const inner of node.querySelectorAll(SCOPE)) translateTree(inner);
  }
}

export function observeAutomations(doc) {
  // Our own writes cause characterData/attribute records whose values no longer match: no loop.
  new MutationObserver(records => {
    for (const record of records) {
      if (record.type === "attributes") {
        if (record.target.closest(SCOPE)) translateAttributes(record.target);
      } else {
        record.addedNodes.forEach(visit);
      }
    }
  }).observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ATTRS });
  visit(doc.body);
}

/** Translate data values that lancer-automations substitutes into its LA.* strings. */
export function translateFormatData(key, data, formats = FORMAT) {
  const params = formats[key];
  if (!params || !data) return data;
  const out = { ...data };
  for (const [param, words] of Object.entries(params)) {
    if (typeof out[param] === "string" && Object.hasOwn(words, out[param])) out[param] = words[out[param]];
  }
  return out;
}
