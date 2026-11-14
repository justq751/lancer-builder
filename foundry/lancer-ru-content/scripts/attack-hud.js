import LABELS from "../generated/ui-labels.js";

function translate(text) {
  return text.replace(/^(\s*)(.*?)(\s*)$/s, (original, before, label, after) => {
    const value = LABELS.attackHud[label.replace(/\s+/g, " ")];
    return typeof value === "string" ? before + value + after : original;
  });
}

export function translateAttackHud(root) {
  const walker = root.ownerDocument.createTreeWalker(root, 4 /* SHOW_TEXT */);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement.closest("input, textarea, [contenteditable], script, style, .lancer-header, .target-name")) continue;
    const value = translate(node.nodeValue);
    if (value !== node.nodeValue) node.nodeValue = value;
  }
  for (const element of root.querySelectorAll("[title], [aria-label], [data-tooltip]")) {
    if (element.closest(".lancer-header, .target-name")) continue;
    for (const attr of ["title", "aria-label", "data-tooltip"]) {
      const original = element.getAttribute(attr);
      if (original === null) continue;
      const value = translate(original);
      if (value !== original) element.setAttribute(attr, value);
    }
  }
}

export function observeAttackHud(doc) {
  let zone;
  // The Svelte HUD mounts outside Foundry Application hooks and updates in place.
  const refresh = () => {
    const root = doc.getElementById("hudzone");
    if (!root) return;
    if (root !== zone) {
      observer.disconnect();
      zone = root;
      observer.observe(zone, { childList: true, subtree: true, characterData: true,
        attributes: true, attributeFilter: ["title", "aria-label", "data-tooltip"] });
    }
    for (const hud of zone.querySelectorAll("form.accdiff")) translateAttackHud(hud);
  };
  const observer = new doc.defaultView.MutationObserver(refresh);
  observer.observe(doc.body, { childList: true });
  refresh();
  return observer;
}
