// Only text leaves in the generated allowlist can be changed.
export function translateText(value, pair) {
  if (!pair || pair.stale || typeof value !== "string" || typeof pair.ru !== "string" || !pair.ru.trim()) return value;
  const expected = Array.isArray(pair.en) ? pair.en : [pair.en];
  // Foundry serializes <br> as <br/>; its 3.1.3 data also capitalizes REPAIRS.
  const canonical = text => text.replace(/<br\s*\/?>/gi, "<br>").replace(/\brepairs\b/gi, "repairs");
  return expected.some(text => canonical(text) === canonical(value)) ? pair.ru : value;
}

export function overlay(value, tree) {
  if (!tree || value == null) return value;
  if (Object.hasOwn(tree, "ru")) return translateText(value, tree);
  if (Array.isArray(value)) {
    if (!tree.$items) return value;
    return value.map(item => {
      const entries = Object.entries(tree.$items).filter(([name, entry]) =>
        item.name === name || item.name === entry.name?.ru);
      if (entries.length !== 1) return item;
      // Repeated names in a source array cannot identify a stable element.
      if (value.filter(other => other.name === item.name).length !== 1) return item;
      return overlay(item, entries[0][1]);
    });
  }
  if (typeof value !== "object") return value;
  const out = { ...value };
  for (const [key, subtree] of Object.entries(tree)) {
    if (Object.hasOwn(value, key)) out[key] = overlay(value[key], subtree);
  }
  return out;
}

export function registerBabele(babele) {
  babele.registerIdentityExtractor("lancerRuLid", doc =>
    doc?.type && doc.system?.lid ? `${doc.type}:${doc.system.lid}` : null);
  babele.registerConverters({ lancerRuText: translateText, lancerRuContent: overlay });
  babele.registerMapping({ Item: {
    _identity: { export: ["lancerRuLid"], match: ["lancerRuLid"] },
    name: { path: "name", converter: "lancerRuText" },
    content: { path: "system", converter: "lancerRuContent" },
    statusEffects: { path: "effects", converter: "lancerRuContent" },
  } });
  babele.register({ module: "lancer-ru-content", lang: "ru", dir: "compendium" });
}

export async function refreshIndexes(packs, babele) {
  babele.invalidateCaches();
  for (const id of ["world.mech-items", "world.pilot-items", "world.status-items"]) {
    const pack = packs.get(id);
    if (!pack) continue;
    // Initial server indexes do not include LIDs, even after CONFIG is updated.
    await pack.getIndex({ fields: ["type", "system.lid"] });
    babele.translatedCompendiumFor(id)?.translateIndex(pack.index);
    pack.initializeTree();
    for (const app of Object.values(pack.apps)) app.render(false);
  }
}
