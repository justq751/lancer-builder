import LABELS from "../generated/ui-labels.js";

export function translateLabel(text, labels = LABELS) {
  return text.replace(/^(\s*(?:\/\/\s*)?)(.*?)(\s*)$/, (original, before, label, after) =>
    typeof labels[label] === "string" ? before + labels[label] + after : original);
}

export function translateSheetLabels(root, labels = LABELS) {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement.closest("input, textarea, [contenteditable], script, style")) continue;
    node.textContent = translateLabel(node.textContent, labels);
  }
}

export function translateMechPreview(root) {
  for (const label of root.querySelectorAll(".mech-preview-stat-wrapper > span:first-of-type")) {
    label.textContent = LABELS.mechPreviewStats[label.textContent] ?? label.textContent;
  }
}

export function translateMechLoadout(root) {
  for (const label of root.querySelectorAll(".loadout-category > span:first-of-type, .mount-type-ctx-root > span, .mount .mech_weapon.slot.drop-settable > span.major")) {
    label.textContent = translateLabel(label.textContent, LABELS.mechLoadout);
  }
}

export function translateStabilizeDialog(root) {
  if (!root.querySelector(".stabilize-wrapper")) return false;
  translateSheetLabels(root, LABELS.stabilizeDialog);
  const title = root.querySelector(".window-title");
  if (title) title.textContent = title.textContent.replace(/^STABILIZE - /, `${LABELS.stabilizeDialog.STABILIZE} - `);
  return true;
}

export function translateOverheatChat(root) {
  if (!root.querySelector(".struct-stress .cci-reactor")) return;
  for (const button of root.querySelectorAll('a.flow-button[data-flow-type="check"][data-check-type="eng"]')) {
    translateSheetLabels(button, LABELS.overheatChat);
  }
}

export function translateStructureChat(root) {
  if (root.querySelector(".struct-stress .cci-structure")) {
    for (const button of root.querySelectorAll('a.flow-button[data-flow-type="check"][data-check-type="hull"], a.flow-button[data-flow-type="secondaryStructure"], a.flow-button[data-flow-type="cascade"], a.flow-button[data-flow-type="dismembermentDamage"]')) {
      translateSheetLabels(button, LABELS.structureChat);
    }
  } else {
    const header = root.querySelector(".struct-stress");
    if (!header || !Object.hasOwn(LABELS.structureSecondaryChat, header.textContent.trim())) return;
    header.textContent = LABELS.structureSecondaryChat[header.textContent.trim()];
    for (const text of root.querySelectorAll(".effect-text")) {
      translateSheetLabels(text, LABELS.structureSecondaryChat);
    }
  }
}
