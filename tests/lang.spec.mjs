// Interface and data languages (spec: docs/superpowers/specs/2026-10-15-ui-
// localization-design.md). The test config runs in ru-RU, so openApp() gives a
// Russian interface unless a test asks otherwise.
import { test, expect } from "@playwright/test";
import { FULL_BUILD, UNKNOWN_IDS_BUILD } from "./fixtures/builds.mjs";
import { openApp, getState, setLanguage, waitForBoot, openTab } from "./helpers.mjs";

test("ui strings fall back to English when the Russian file is missing", async ({ page }) => {
  await page.route("**/locales/ru/ui.json", r => r.fulfill({ status: 404 }));
  const errors = await openApp(page, { build: FULL_BUILD });
  await expect(page.locator("#t-sheet")).toHaveText("▤ SHEET");
  expect((await getState(page)).pilot.callsign).toBe("ГОЛЕМ");
  // The 404 itself is logged by the browser; anything else would be a bug.
  expect(errors.filter(e => !/ui\.json|404/.test(e))).toEqual([]);
});

test("switching the interface language keeps the build", async ({ page }) => {
  const errors = await openApp(page, { build: FULL_BUILD });
  await setLanguage(page, { ui: "en" });
  await expect(page.locator("#t-sheet")).toHaveText("▤ SHEET");
  await expect(page.locator("#t-lang")).toHaveText("EN · RU");
  expect(await getState(page)).toEqual(FULL_BUILD);
  await page.reload();
  await waitForBoot(page);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("#t-sheet")).toHaveText("▤ SHEET");
  expect(errors).toEqual([]);
});

test("Russian interface over English data — checking against the original", async ({ page }) => {
  const errors = await openApp(page, { build: FULL_BUILD });
  await setLanguage(page, { data: "en" });
  await expect(page.locator("#t-sheet")).toHaveText("▤ ЛИСТ");
  await expect(page.locator("#t-lang")).toHaveText("RU · EN");
  await expect(page.locator("#t-lang")).toHaveAttribute("aria-label", /интерфейс русский, данные английские/);
  await openTab(page, "frame");
  await expect(page.locator("#tab")).toContainText("Blackbeard");
  expect(errors).toEqual([]);
});

test("switching the interface language with a dialog open closes the dialog", async ({ page }) => {
  const errors = await openApp(page, { build: FULL_BUILD });
  await page.evaluate(() => $("#t-reset").click());
  await expect(page.locator("#modal.show")).toBeVisible();
  await page.evaluate(() => setUiLanguage("en"));
  await expect(page.locator("#modal.show")).toBeHidden();
  expect(errors).toEqual([]);
});

test.describe("first visit in an English browser", () => {
  test.use({ locale: "en-US" });
  test("opens in English", async ({ page }) => {
    await page.goto("/");
    await waitForBoot(page);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("#t-lang")).toHaveText("EN");
    expect(await page.evaluate(() => currentLang)).toBe("en");
  });
});

test("a partly restored build is reported in the interface language", async ({ page }) => {
  // The "dropped" lines are worded in js/core/build.js — through tText().
  const errors = await openApp(page, { build: UNKNOWN_IDS_BUILD, storage: { lancer_ui_lang: "en" } });
  const dialog = page.locator("#modal.show");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("h3")).toHaveText("Build restored partly");
  expect(await dialog.innerText()).not.toMatch(/[А-Яа-яЁё]/);
  expect(errors).toEqual([]);
});

test("the data-load error screen explains itself even with no strings loaded", async ({ page }) => {
  // The file:// case: every JSON fails, data/ui.json included — t() has no
  // strings, and the screen must not show its own key.
  await page.route("**/*.json", r => r.abort());
  await page.goto("/");
  await expect(page.locator("body")).toContainText("data/lancer-data.json");
  await expect(page.locator("body")).not.toContainText("error.load.dev");
});

test("switching the data language from the keyboard keeps focus and shows progress", async ({ page }) => {
  const errors = await openApp(page, { build: FULL_BUILD });
  let release;
  const held = new Promise(r => { release = r; });
  await page.route("**/data/lancer-data.json", async r => { await held; r.continue(); });
  await page.locator("#t-lang").click();
  await page.locator('#lang-panel input[name="data-lang"][value="ru"]').focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#lang-data")).toHaveAttribute("aria-busy", "true");
  await expect(page.locator("#lang-data legend")).toContainText("…");
  release();
  await expect.poll(() => page.evaluate(() => currentLang)).toBe("en");
  await expect(page.locator("#lang-data")).not.toHaveAttribute("aria-busy", "true");
  expect(await page.evaluate(() => document.activeElement.matches('input[name="data-lang"][value="en"]'))).toBe(true);
  expect(errors).toEqual([]);
});

test("the last interface language chosen wins, even if an earlier one loads later", async ({ page }) => {
  await openApp(page, { build: FULL_BUILD });
  await page.route("**/locales/ru/ui.json", async r => { await new Promise(res => setTimeout(res, 600)); r.continue(); });
  await page.evaluate(async () => {
    const slow = setUiLanguage("ru");   // held 600 ms
    await setUiLanguage("en");          // the user's last choice
    await slow;
  });
  expect(await page.evaluate(() => [UI_LANG, document.documentElement.lang, localStorage.getItem("lancer_ui_lang")]))
    .toEqual(["en", "en", "en"]);
  await expect(page.locator("#t-sheet")).toHaveText("▤ SHEET");
});

test("a data language that fails to load says so and keeps the old one", async ({ page }) => {
  const errors = await openApp(page, { build: FULL_BUILD });
  await page.route("**/data/lancer-data.json", r => r.abort());
  await setLanguage(page, { data: "en" }).catch(() => {}); // the switch does not complete
  await expect(page.locator("#modal.show h3")).toHaveText("Данные игры не загрузились");
  expect(await page.evaluate(() => currentLang)).toBe("ru");
  await expect(page.locator('#lang-panel input[name="data-lang"][value="ru"]')).toBeChecked();
  expect(errors.filter(e => !/lancer-data\.json|Failed to fetch|ERR_FAILED/.test(e))).toEqual([]);
});
