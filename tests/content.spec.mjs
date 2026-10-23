// Content selection (js/app/content.js): which parts of each supplement are
// offered for picking. Switched-off content only leaves the lists.
import { test, expect } from "@playwright/test";
import { FULL_BUILD } from "./fixtures/builds.mjs";
import { openApp, getState, openTab, modal } from "./helpers.mjs";

const toggle = (page, pack, cat) =>
  page.locator(cat ? `#modal input[data-cpack="${pack}"][data-ccat="${cat}"]` : `#modal input[data-cpack="${pack}"]:not([data-ccat])`);

test("by default No Room for a Wallflower offers only its frames", async ({ page }) => {
  const errors = await openApp(page, { build: FULL_BUILD });
  await openTab(page, "frame");
  await expect(page.locator('[data-pickframe="mf_kidd"]')).toHaveCount(1);
  await openTab(page, "loadout");
  await page.locator("#add-system").click();
  await expect(page.locator('#sy-list .listrow[data-s="ms_pebcac"]')).toHaveCount(0);
  await page.evaluate(() => closeModal());

  // Switch its systems on: they are offered, and the choice is remembered.
  await page.locator("#t-content").click();
  await expect(toggle(page, "wallflower", "systems")).not.toBeChecked();
  await toggle(page, "wallflower", "systems").check();
  await expect(toggle(page, "wallflower", "systems")).toBeFocused();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("lancer_content")))).toEqual({ wallflower: ["frames", "systems"] });
  await page.evaluate(() => closeModal());
  await page.locator("#add-system").click();
  await expect(page.locator('#sy-list .listrow[data-s="ms_pebcac"]')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("switched-off content stays in the build and is named in the settings", async ({ page }) => {
  const build = structuredClone(FULL_BUILD);
  build.mech.systems.push("ms_pebcac"); // Wallflower system: off by default
  const errors = await openApp(page, { build });
  await openTab(page, "loadout");
  await expect(page.locator("#syslist")).toContainText(await page.evaluate(() => M.system.ms_pebcac.name));
  expect((await getState(page)).mech.systems).toContain("ms_pebcac");
  await page.locator("#t-content").click();
  await expect(modal(page).locator(".warnbox")).toContainText(await page.evaluate(() => M.system.ms_pebcac.name));
  expect(errors).toEqual([]);
});

test("a license stays on the Licenses tab while its weapons are offered", async ({ page }) => {
  const errors = await openApp(page, { build: FULL_BUILD, storage: {
    lancer_content: JSON.stringify({ "long-rim": ["weapons"] }),
  } });
  await openTab(page, "frame");
  await expect(page.locator('[data-pickframe="mf_atlas"]')).toHaveCount(0);
  await openTab(page, "licenses");
  await expect(page.locator('[data-openlic="mf_atlas"]')).toHaveCount(1);

  // Nothing from Long Rim at all: the license goes too.
  await page.locator("#t-content").click();
  // Mixed, so the first click switches the whole pack on, the second off.
  await toggle(page, "long-rim").click();
  await expect(toggle(page, "long-rim", "frames")).toBeChecked();
  await toggle(page, "long-rim").uncheck();
  await page.evaluate(() => closeModal());
  await expect(page.locator('[data-openlic="mf_atlas"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});
