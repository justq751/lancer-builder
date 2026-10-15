// With the interface AND the data in English there is no Cyrillic on screen —
// stage 4's definition of done (PLAN.md, ADR 0005). Walks every tab, picker,
// detail view and dialog, the sheet and the print sheet; checks visible text
// and the attributes a screen reader or a hover shows. Elements marked
// lang="ru" (the language panel's own-language "Русский") are exempt.
import { test, expect } from "@playwright/test";
import { FULL_BUILD } from "./fixtures/builds.mjs";
import { openApp, openTab, modal } from "./helpers.mjs";

const EN = { lang: "en", storage: { lancer_ui_lang: "en" } };
// What the player typed is theirs, not interface text: the fixture's Russian
// callsign and custom skill are swapped for Latin ones here.
const EN_BUILD = {
  ...structuredClone(FULL_BUILD),
  pilot: { ...FULL_BUILD.pilot, name: "Test Pilot", callsign: "GOLEM" },
  customSkills: [{ id: "cs_kick_doors", name: "Kick doors", description: "A trigger of the pilot's own." }],
};
const TABS = ["pilot", "skills", "talents", "hase", "licenses", "frame", "loadout", "core", "summary"];

async function cyrillic(page) {
  return page.evaluate(() => {
    const CYR = /[А-Яа-яЁё]/;
    const exempt = el => !!el.closest('[lang="ru"]');
    const found = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || exempt(el) || !CYR.test(n.textContent)) continue;
      if (!el.checkVisibility() && !el.closest("#print-sheet")) continue; // hidden markup is checked by the unit guard
      found.push(`text in <${el.tagName.toLowerCase()} ${el.id ? "#" + el.id : el.className}>: ${n.textContent.trim().slice(0, 60)}`);
    }
    for (const el of document.querySelectorAll("[title],[aria-label],[placeholder],[alt]")) {
      if (exempt(el)) continue;
      for (const a of ["title", "aria-label", "placeholder", "alt"]) {
        const v = el.getAttribute(a);
        if (v && CYR.test(v)) found.push(`${a} on <${el.tagName.toLowerCase()} ${el.id ? "#" + el.id : el.className}>: ${v.slice(0, 60)}`);
      }
    }
    if (CYR.test(document.title)) found.push(`document.title: ${document.title}`);
    return found.slice(0, 5);
  });
}
async function noCyrillic(page, where) {
  expect(await cyrillic(page), where).toEqual([]);
}
const open = async (page, fn, arg) => {
  await page.evaluate(([src, a]) => { closeModal(); (0, eval)("(" + src + ")")(a); }, [fn.toString(), arg]);
  await expect(modal(page)).toBeVisible();
};

test("no Cyrillic anywhere with English interface and data — full build", async ({ page }) => {
  const errors = await openApp(page, { build: EN_BUILD, ...EN });
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  for (const id of TABS) {
    await openTab(page, id);
    await noCyrillic(page, `tab ${id}`);
  }
  const dialogs = {
    "weapon picker": () => { state.mech.mounts[2].items = []; openWeaponPicker(2); },
    "system picker": () => openSystemPicker(),
    "mod picker": () => openModPicker(1, 0),
    "pilot gear picker": () => openPilotGearPicker("Armor", () => {}),
    "weapon detail": () => viewEquippedWeapon(0, 0),
    "mod detail": () => viewEquippedMod(0, 0),
    "system detail": () => viewEquippedSystem(0),
    "frame detail": () => openFrame("mf_standard_pattern_i_everest"),
    "license detail": () => openLicenseDetail("mf_blackbeard"),
    "core detail": () => openCoreDetail("cb_neurolink_targeting"),
    "reset dialog": () => $("#t-reset").click(),
    "frame swap dialog": () => pickFrame("mf_standard_pattern_i_everest"),
  };
  for (const [where, fn] of Object.entries(dialogs)) {
    await open(page, fn);
    await noCyrillic(page, where);
  }
  await page.evaluate(() => closeModal());

  await page.locator("#t-lang").click();
  await expect(page.locator("#lang-panel")).toBeVisible();
  await noCyrillic(page, "language panel");
  await page.keyboard.press("Escape");

  await page.locator("#t-sheet").click();
  await noCyrillic(page, "sheet");
  await page.evaluate(() => buildPrintSheet(derived()));
  await noCyrillic(page, "print sheet");
  expect(errors).toEqual([]);
});

test("no Cyrillic with an empty build", async ({ page }) => {
  const errors = await openApp(page, EN);
  for (const id of TABS) {
    await openTab(page, id);
    await noCyrillic(page, `empty: tab ${id}`);
  }
  await page.locator("#t-sheet").click();
  await noCyrillic(page, "empty: sheet");
  expect(errors).toEqual([]);
});
