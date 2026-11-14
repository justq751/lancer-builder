import LABELS from "../generated/ui-labels.js";

export function translateLabel(text) {
  return text.replace(/^(\s*(?:\/\/\s*)?)(.*?)(\s*)$/, (original, before, label, after) =>
    typeof LABELS[label] === "string" ? before + LABELS[label] + after : original);
}

export function translateSheetLabels(root) {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement.closest("input, textarea, [contenteditable], script, style")) continue;
    node.textContent = translateLabel(node.textContent);
  }
}

export function translateMechPreview(root) {
  for (const label of root.querySelectorAll(".mech-preview-stat-wrapper > span:first-of-type")) {
    label.textContent = LABELS.mechPreviewStats[label.textContent] ?? label.textContent;
  }
}
