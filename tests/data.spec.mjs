// The localized dataset `L` — what loadBaseData() + localizeData() produce.
// This is the safety net for refactoring the i18n loader: the golden files
// pin the exact output for both languages.
import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";
import { expectGolden } from "./golden.mjs";

const getL = page => page.evaluate(() => JSON.parse(JSON.stringify(L)));

for (const lang of ["ru", "en"]) {
  test(`localized dataset matches golden (${lang})`, async ({ page }, testInfo) => {
    const errors = await openApp(page, { lang });
    expect(await page.evaluate(() => currentLang)).toBe(lang);
    expectGolden(testInfo, `L.${lang}.json`, await getL(page));
    expect(errors).toEqual([]);
  });
}

// Fields that are logic keys: compared literally by the app (license
// unlocking, mount matching, filters, source colours) and therefore must be
// identical in every language — translation happens only at render time via
// tr()/trTag(). See CLAUDE.md, "Critical constraint".
const LOGIC_FIELDS = {
  frames: ["name", "variant", "source", "mechtype", "mounts", "stats", "license", "license_level"],
  weapons: ["source", "license", "license_level", "mount", "type", "tags", "sp", "damage", "range"],
  systems: ["source", "license", "license_level", "type", "tags", "sp"],
  mods: ["source", "license", "license_level", "tags", "sp", "allowed_types", "allowed_sizes"],
  core_bonuses: ["source"],
  pilot_gear: ["type", "tags"],
};

test("translation never touches logic keys", async ({ page }) => {
  await openApp(page, { lang: "en" });
  const en = await getL(page);
  await page.evaluate(async () => { L = await fetchAndLocalize("ru"); });
  const ru = await getL(page);

  const problems = [];
  for (const [cat, fields] of Object.entries(LOGIC_FIELDS)) {
    const ruById = new Map((ru[cat] || []).map(x => [x.id, x]));
    expect(ruById.size, `${cat}: same item count`).toBe((en[cat] || []).length);
    for (const item of en[cat] || []) {
      const other = ruById.get(item.id);
      if (!other) { problems.push(`${cat}/${item.id}: missing in ru`); continue; }
      for (const f of fields) {
        if (JSON.stringify(item[f]) !== JSON.stringify(other[f])) {
          problems.push(`${cat}/${item.id}.${f}: ${JSON.stringify(item[f])} → ${JSON.stringify(other[f])}`);
        }
      }
    }
  }
  expect(problems.slice(0, 40), `${problems.length} logic key(s) changed by localization`).toEqual([]);
});

test("a translated field shows the translation, an empty one falls back to English", async ({ page }) => {
  await openApp(page, { lang: "ru" });
  const sample = await page.evaluate(async () => {
    const loc = await (await fetch("locales/ru/skills.json")).json();
    const [id, entry] = Object.entries(loc).find(([, v]) => v?.name?.ru);
    return { id, ru: entry.name.ru, live: L.skills.find(s => s.id === id).name };
  });
  expect(sample.live).toBe(sample.ru);

  // Blank out one translation on the wire: the English original must show.
  const en = await page.evaluate(async id => {
    const base = await (await fetch("data/lancer-data.json")).json();
    return base.skills.find(s => s.id === id).name;
  }, sample.id);
  await page.route("**/locales/ru/skills.json", async route => {
    const json = await (await route.fetch()).json();
    json[sample.id].name.ru = "";
    await route.fulfill({ json });
  });
  const fallback = await page.evaluate(async id => {
    const l = await fetchAndLocalize("ru");
    return l.skills.find(s => s.id === id).name;
  }, sample.id);
  expect(fallback).toBe(en);
});
