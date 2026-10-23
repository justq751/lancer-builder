// Drives the UI the way a player does, by clicking — catches broken wiring
// (onclick handlers, data-* selectors) that state-level tests cannot see.
import { test, expect } from "@playwright/test";
import { FULL_BUILD } from "./fixtures/builds.mjs";
import { openApp, getState, openTab, modal, setLanguage } from "./helpers.mjs";

const TABS = ["pilot", "skills", "talents", "hase", "licenses", "frame", "loadout", "core", "summary"];

test("build a mech from scratch by clicking", async ({ page }) => {
  const errors = await openApp(page);

  // Pilot
  await page.locator("#f-name").fill("Кейт Аояма");
  await page.locator("#f-call").fill("RONIN");
  await page.locator("#f-bg").selectOption("pbg_colonist");
  await page.locator("#f-ll").fill("2");
  await expect(page.locator("#hud .pid")).toContainText("RONIN");
  await expect(page.locator("#hud .ll .big")).toHaveText("LL2");

  // Skills
  await openTab(page, "skills");
  await page.locator('.stepbtn[data-sk="sk_assault"][data-d="1"]').click();
  expect((await getState(page)).skills).toEqual({ sk_assault: 2 });

  // Licenses
  await openTab(page, "licenses");
  // Blackbeard shares its license track with a pack variant, so its + appears
  // twice — click the one on Blackbeard's own card.
  await page.locator('[data-openlic="mf_blackbeard"] .stepbtn[data-d="1"]').click();
  expect((await getState(page)).licenses).toEqual({ Blackbeard: 1 });

  // Frame
  await openTab(page, "frame");
  await page.locator('[data-pickframe="mf_blackbeard"]').click();
  expect((await getState(page)).mech.frameId).toBe("mf_blackbeard");
  await expect(page.locator("#hud .statgrid")).toBeVisible();

  // Weapon into the first mount (Blackbeard: Flex, Main, Heavy)
  await openTab(page, "loadout");
  await page.locator('#mounts [data-addw="0"]').click();
  await expect(modal(page)).toBeVisible();
  await page.locator('#wp-list .listrow[data-w="mw_assault_rifle"]').click();
  await page.locator("#wp-install-inline").click();
  await expect(modal(page)).toBeHidden();
  expect((await getState(page)).mech.mounts[0].items).toEqual([{ id: "mw_assault_rifle", mod: null }]);

  // System
  await page.locator("#add-system").click();
  await page.locator('#sy-list .listrow[data-s="ms_custom_paint_job"]').click();
  await page.locator("#sy-install-inline").click();
  expect((await getState(page)).mech.systems).toEqual(["ms_custom_paint_job"]);
  // Unlike the weapon picker, the system picker stays open for the next pick;
  // the installed system just drops out of the list.
  await expect(modal(page)).toBeVisible();
  await expect(page.locator('#sy-list .listrow[data-s="ms_custom_paint_job"]')).toHaveCount(0);
  await modal(page).locator(".mclose").click();
  await expect(modal(page)).toBeHidden();

  const sp = await page.evaluate(() => derived().sp);
  expect(sp.used).toBe(1); // Custom Paint Job 1 SP, Assault Rifle 0 SP
  await expect(page.locator("#hud")).toContainText(`${sp.used} / ${sp.cap}`);

  expect(errors).toEqual([]);
});

test("every tab and the sheet view render a full build without errors", async ({ page }) => {
  const errors = await openApp(page, { build: FULL_BUILD });
  for (const id of TABS) {
    await openTab(page, id);
    await expect(page.locator("#tab"), `tab ${id}`).not.toBeEmpty();
  }

  await page.locator("#t-sheet").click();
  await expect(page.locator("#sheet")).toBeVisible();
  await expect(page.locator("#sheet")).toContainText("ГОЛЕМ");
  await page.locator("#t-sheet").click();
  await expect(page.locator("#sheet")).toBeHidden();

  expect(errors).toEqual([]);
});

test("every tab renders an empty build without errors, in both languages", async ({ page }) => {
  const errors = await openApp(page);
  for (const lang of ["ru", "en"]) {
    if (lang === "en") {
      await setLanguage(page, { data: "en" });
    }
    for (const id of TABS) {
      await openTab(page, id);
      await expect(page.locator("#tab"), `${lang}/${id}`).not.toBeEmpty();
    }
  }
  expect(errors).toEqual([]);
});

test("tab bar is keyboard navigable", async ({ page }) => {
  await openApp(page);
  await page.locator("#tab-btn-pilot").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#tab-btn-skills")).toBeFocused();
  await expect(page.locator("#tab-btn-skills")).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("End");
  await expect(page.locator("#tab-btn-summary")).toBeFocused();
  await page.keyboard.press("Home");
  await expect(page.locator("#tab-btn-pilot")).toBeFocused();
});

test("weapons and systems can be installed with the keyboard alone", async ({ page }) => {
  // Regression (AUDIT P0-2, 2026-10-14): picker rows were mouse-only <div>s —
  // Tab cycled filters/search/close and never reached the list.
  const build = structuredClone(FULL_BUILD);
  build.mech.mounts[2].items = []; // free the Heavy mount
  build.mech.systems = []; // room in the SP budget — going over asks first (tested below)
  const errors = await openApp(page, { build });
  await openTab(page, "loadout");
  const names = await page.evaluate(() => ({ w: M.weapon.mw_howitzer.name, s: M.system.ms_manipulators.name }));
  const active = () => page.evaluate(() => {
    const a = document.activeElement;
    return { tag: a.tagName, id: a.id, w: a.dataset.w, s: a.dataset.s, inModal: !!a.closest("#modal") };
  });
  // The expanded row's tags are buttons too (glossary), so the install button
  // is a few Tabs away rather than exactly one.
  const tabTo = async id => {
    for (let i = 0; i < 12 && (await active()).id !== id; i++) await page.keyboard.press("Tab");
    expect(await active()).toMatchObject({ id });
  };

  // Weapon: open → search → Tab into the list → Enter expands → Tab… → Enter installs
  await page.locator('#mounts [data-addw="2"]').focus();
  await page.keyboard.press("Enter");
  await expect(modal(page)).toBeVisible();
  await page.locator("#wp-search").focus();
  await page.keyboard.type(names.w);
  await page.keyboard.press("Tab");
  expect(await active()).toMatchObject({ w: "mw_howitzer" });
  await page.keyboard.press("Enter");
  expect(await active()).toMatchObject({ w: "mw_howitzer" }); // focus survives the redraw
  await expect(page.locator('#wp-list .listrow[data-w="mw_howitzer"]')).toHaveAttribute("aria-expanded", "true");
  await tabTo("wp-install-inline");
  await page.keyboard.press("Enter");
  await expect(modal(page)).toBeHidden();
  expect((await getState(page)).mech.mounts[2].items).toEqual([{ id: "mw_howitzer", mod: null }]);
  expect((await active()).tag).not.toBe("BODY"); // focus lands somewhere, not lost

  // System: the picker stays open after installing — focus must stay inside it
  await page.locator("#add-system").focus();
  await page.keyboard.press("Enter");
  await page.locator("#sy-search").focus();
  await page.keyboard.type(names.s);
  await page.keyboard.press("Tab");
  expect(await active()).toMatchObject({ s: "ms_manipulators" });
  await page.keyboard.press(" ");
  await tabTo("sy-install-inline");
  await page.keyboard.press("Enter");
  expect((await getState(page)).mech.systems).toContain("ms_manipulators");
  expect(await active()).toMatchObject({ inModal: true });
  await page.keyboard.press("Escape");
  await expect(page.locator("#add-system")).toBeFocused();
  expect(errors).toEqual([]);
});

test("installing over the SP cap asks first; Back returns to the list where it was", async ({ page }) => {
  const errors = await openApp(page, { build: FULL_BUILD }); // SP 6 of 6
  await openTab(page, "loadout");
  await page.locator("#add-system").click();
  await page.locator("#sy-search").fill(await page.evaluate(() => M.system.ms_manipulators.name));
  await page.locator('#sy-list .listrow[data-s="ms_manipulators"]').click();
  await page.locator("#sy-install-inline").click();

  // Not installed yet: the picker shows the confirmation instead.
  await expect(page.locator("#sp-over-yes")).toBeFocused();
  expect((await getState(page)).mech.systems).not.toContain("ms_manipulators");
  await page.locator("#sp-over-back").click();
  await expect(page.locator("#sy-install-inline")).toBeFocused();
  await expect(page.locator("#sy-search")).toHaveValue(/.+/);

  await page.locator("#sy-install-inline").click();
  await page.locator("#sp-over-yes").click();
  expect((await getState(page)).mech.systems).toContain("ms_manipulators");
  await expect(modal(page)).toBeVisible(); // the system picker stays open, as without the check
  const d = await page.evaluate(() => derived().sp);
  expect(d.used).toBeGreaterThan(d.cap);
  expect(errors).toEqual([]);
});

test("modal closes with Escape and returns focus", async ({ page }) => {
  await openApp(page, { build: FULL_BUILD });
  await openTab(page, "loadout");
  const trigger = page.locator("#add-system");
  await trigger.click();
  await expect(modal(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(modal(page)).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("over-budget tabs are flagged", async ({ page }) => {
  // The LL3 build at LL0: talents (rank 2 needs LL1), HASE (5/2) and
  // licenses (3/0) are over. Skills sit exactly at 4/4 — not flagged. CORE
  // is never flagged at LL0 (cap 0), see tabWarn().
  await openApp(page, { build: { ...FULL_BUILD, pilot: { ...FULL_BUILD.pilot, ll: 0 } } });
  for (const id of ["skills", "core"]) {
    await expect(page.locator(`#tab-btn-${id} .dot.warn`), id).toHaveCount(0);
  }
  for (const id of ["talents", "hase", "licenses"]) {
    await expect(page.locator(`#tab-btn-${id} .dot.warn`), id).toBeVisible();
  }
});
