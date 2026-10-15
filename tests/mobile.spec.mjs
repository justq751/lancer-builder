// Phone layout (≤1020px): the dock (budget ledger + tabs) is fixed to the
// bottom, the HUD and the ⋯ menu are bottom-sheet popovers, and the sheet
// view has a sticky bar with jump links. Desktop behaviour is covered by the
// other specs at 1440px — the same controls, laid out in place.
import { test, expect } from "@playwright/test";
import { FULL_BUILD } from "./fixtures/builds.mjs";
import { openApp, openTab, modal, getState } from "./helpers.mjs";

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

const TABS = ["pilot", "skills", "talents", "hase", "licenses", "frame", "loadout", "core", "summary"];
const isOpen = (page, sel) => page.locator(sel).evaluate(el => el.matches(":popover-open"));

test("tab content starts right under the header, the dock holds tabs and budget", async ({ page }) => {
  const errors = await openApp(page, { build: FULL_BUILD });
  const tabTop = await page.locator("#tab").evaluate(el => el.getBoundingClientRect().top);
  expect(tabTop).toBeLessThan(120); // was 1348px: the whole HUD stood above it

  const dock = await page.locator("#dock").boundingBox();
  expect(dock.y + dock.height).toBeCloseTo(844, 0); // pinned to the bottom edge
  await expect(page.locator("#ledger")).toContainText("6/6"); // SP in the ledger
  await expect(page.locator("#hud")).toBeHidden();
  expect(errors).toEqual([]);
});

// Both interface languages: English labels are not the Russian ones' length.
for (const [lang, opts] of [["ru", {}], ["en", { lang: "en", storage: { lancer_ui_lang: "en" } }]])
test(`every tab fits the phone width — nothing scrolls sideways (${lang})`, async ({ page }) => {
  const errors = await openApp(page, { build: FULL_BUILD, ...opts });
  for (const id of TABS) {
    await openTab(page, id);
    // The active tab is scrolled into the dock's row, never left off-screen.
    const tab = await page.locator(`#tab-btn-${id}`).boundingBox();
    expect(tab.x, `${id} tab visible`).toBeGreaterThanOrEqual(0);
    expect(tab.x + tab.width, `${id} tab visible`).toBeLessThanOrEqual(390);
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width, `${id}: page width`).toBeLessThanOrEqual(390);
  }
  expect(errors).toEqual([]);
});

test("the ledger opens the full HUD as a sheet; Escape closes it", async ({ page }) => {
  const errors = await openApp(page, { build: FULL_BUILD });
  await page.locator("#ledger").click();
  await expect(page.locator("#hud")).toBeVisible();
  await expect(page.locator("#ledger")).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#hud .pid")).toContainText("ГОЛЕМ");
  await expect(page.locator("#hud .statgrid")).toBeVisible();

  // A stat glossary tip opened inside the sheet must show above it.
  await page.locator("#hud .stattip").first().click();
  await expect(page.locator("#global-stattip")).toBeVisible();

  await page.keyboard.press("Escape"); // tip
  await page.keyboard.press("Escape"); // sheet
  await expect(page.locator("#hud")).toBeHidden();
  expect(await isOpen(page, "#hud")).toBe(false);
  expect(errors).toEqual([]);
});

test("rare actions live in the ⋯ menu, which closes before its dialog opens", async ({ page }) => {
  const errors = await openApp(page, { build: FULL_BUILD });
  await expect(page.locator("#t-reset")).toBeHidden();
  await page.locator("#t-more").click();
  await expect(page.locator("#t-reset")).toBeVisible();
  await page.locator("#t-reset").click();
  expect(await isOpen(page, "#more-menu")).toBe(false); // or the dialog would sit under it
  await expect(modal(page)).toBeVisible();
  await page.locator("#modal .mclose").click();
  expect((await getState(page)).pilot.callsign).toBe("ГОЛЕМ");
  expect(errors).toEqual([]);
});

test("the dock steps aside while typing", async ({ page }) => {
  await openApp(page, { build: FULL_BUILD });
  await page.locator("#tab input").first().focus();
  await expect(page.locator("#dock")).toBeHidden();
  await page.locator("#tab input").first().blur();
  await expect(page.locator("#dock")).toBeVisible();
});

test("sheet: the bar's links jump to a section without touching the URL", async ({ page }) => {
  const errors = await openApp(page, { build: FULL_BUILD, storage: { view_mode: "sheet" } });
  await page.locator('.sheetbar a[href="#sh-talents"]').click();
  await expect.poll(() => page.locator("#sh-talents").evaluate(el => Math.round(el.getBoundingClientRect().top)))
    .toBeLessThan(200);
  await expect(page.locator(".sheetbar")).toHaveClass(/stuck/); // dossier scrolled away → stats shown
  expect(new URL(page.url()).hash).toBe("");
  expect(errors).toEqual([]);
});
