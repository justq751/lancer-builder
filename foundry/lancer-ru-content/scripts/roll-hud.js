import LABELS from "../generated/ui-labels.js";

function translate(text, labels) {
  return text.replace(/^(\s*)(.*?)(\s*)$/s, (original, before, label, after) => {
    const value = labels[label.replace(/\s+/g, " ")];
    return typeof value === "string" ? before + value + after : original;
  });
}

export function translateRollHud(root) {
  const damage = root.matches("form.damage-hud");
  const labels = damage ? LABELS.damageHud : LABELS.attackHud;
  const walker = root.ownerDocument.createTreeWalker(root, 4 /* SHOW_TEXT */);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement.closest("input, textarea, [contenteditable], script, style, .target-name")) continue;
    if (node.parentElement.closest(".lancer-header")) {
      // Only replace the system's damage suffix, preserving weapon and actor names.
      if (damage) {
        const [title, ...actor] = node.nodeValue.split(" -- ");
        const value = [title.replace(/ DAMAGE$/i, ` ${labels.DAMAGE}`), ...actor].join(" -- ");
        if (value !== node.nodeValue) node.nodeValue = value;
      }
      continue;
    }
    if (node.parentElement.matches("option") && !node.parentElement.hasAttribute("value")) continue;
    const value = translate(node.nodeValue, labels);
    if (value !== node.nodeValue) node.nodeValue = value;
  }
  for (const element of root.querySelectorAll("[title], [aria-label], [data-tooltip], [aria-lable]")) {
    if (element.closest(".lancer-header, .target-name")) continue;
    for (const attr of ["title", "aria-label", "data-tooltip", "aria-lable"]) {
      const original = element.getAttribute(attr);
      if (original === null) continue;
      const value = translate(original, labels);
      if (attr === "aria-lable") {
        element.setAttribute("aria-label", value);
        element.removeAttribute(attr);
      } else if (value !== original) element.setAttribute(attr, value);
    }
  }
}

export function observeRollHuds(doc) {
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
    for (const hud of zone.querySelectorAll("form.accdiff, form.damage-hud")) translateRollHud(hud);
  };
  const observer = new doc.defaultView.MutationObserver(refresh);
  observer.observe(doc.body, { childList: true });
  refresh();
  return observer;
}
