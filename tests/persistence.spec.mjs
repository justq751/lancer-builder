// Everything that carries a build across page loads: autosave, migrations of
// old saves, file export/import, share links, language switch. Breaking any
// of these silently loses a player's work.
import { test, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { FULL_BUILD, LEGACY_BUILD, UNKNOWN_IDS_BUILD } from "./fixtures/builds.mjs";
import { openApp, getState, getSaved, modal, waitForBoot } from "./helpers.mjs";

test("restores the autosaved build on load", async ({ page }) => {
  const errors = await openApp(page, { build: FULL_BUILD });
  expect(await getState(page)).toEqual(FULL_BUILD);
  await expect(page.locator("#hud .pid")).toContainText("ГОЛЕМ");
  await expect(page.locator("#hud .ll .big")).toHaveText("LL3");
  await expect(modal(page)).toBeHidden(); // nothing was dropped → no report
  expect(errors).toEqual([]);
});

test("autosaves edits and survives a reload", async ({ page }) => {
  const errors = await openApp(page);
  expect(await getSaved(page)).toBeNull(); // untouched first visit writes nothing

  await page.locator("#f-call").fill("ВОРОН");
  await page.locator("#f-ll").fill("4"); // range input: fill sets value + fires input/change
  await expect.poll(async () => (await getSaved(page))?.state?.pilot)
    .toMatchObject({ callsign: "ВОРОН", ll: 4 });
  const saved = await getSaved(page);
  expect(saved).toMatchObject({ _app: "lancer-registry", v: 1 });
  await expect(page.locator("#savestate")).toContainText("СОХРАНЕНО");

  await page.reload();
  await waitForBoot(page);
  expect((await getState(page)).pilot).toMatchObject({ callsign: "ВОРОН", ll: 4 });
  expect(errors).toEqual([]);
});

test("migrates a legacy save (string weapon slots, variant license key)", async ({ page }) => {
  const errors = await openApp(page, { build: LEGACY_BUILD });
  const s = await getState(page);
  expect(s.mech.mounts.map(m => m.items)).toEqual([
    [{ id: "mw_assault_rifle", mod: null }],
    [{ id: "mw_charged_blade", mod: null }],
    [{ id: "mw_howitzer", mod: null }],
  ]);
  // Störtebeker is a Raleigh variant → progress folds into the base track.
  expect(s.licenses).toEqual({ Raleigh: 2 });
  expect(errors).toEqual([]);
});

test("drops unknown content and names it instead of crashing", async ({ page }) => {
  const errors = await openApp(page, { build: UNKNOWN_IDS_BUILD });
  const s = await getState(page);
  expect(s.talents).toEqual({ t_ace: 1 });
  expect(s.mech.systems).toEqual(["ms_custom_paint_job"]);
  expect(s.mech.mounts.map(m => m.items)).toEqual([[], [{ id: "mw_assault_rifle", mod: null }], []]);

  const dlg = modal(page);
  await expect(dlg).toBeVisible();
  await expect(dlg.locator("h3")).toHaveText("Сборка восстановлена частично");
  for (const id of ["t_homebrew_does_not_exist", "mw_does_not_exist", "wm_does_not_exist", "ms_does_not_exist"]) {
    await expect(dlg).toContainText(id);
  }
  expect(errors).toEqual([]);
});

test("a corrupted autosave is ignored, the app still starts", async ({ page }) => {
  const errors = await openApp(page, { build: "{not json" });
  expect((await getState(page)).pilot.callsign).toBe("");
  await expect(page.locator("#tab")).not.toBeEmpty();
  expect(errors).toEqual([]);
});

test("export → reset → import round-trips the build", async ({ page }, testInfo) => {
  const errors = await openApp(page, { build: FULL_BUILD });

  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#t-export").click()]);
  expect(download.suggestedFilename()).toBe("ГОЛЕМ_lancer.json");
  const file = testInfo.outputPath("export.json");
  await download.saveAs(file);

  await page.locator("#t-reset").click();
  await modal(page).getByRole("button", { name: "⟲ Сбросить всё" }).click();
  expect((await getState(page)).mech.frameId).toBeNull();

  await page.locator("#import-file").setInputFiles(file);
  await expect.poll(() => getState(page)).toEqual(FULL_BUILD);
  expect(errors).toEqual([]);
});

test("importing over a non-empty build asks first", async ({ page }, testInfo) => {
  const errors = await openApp(page, { build: LEGACY_BUILD });
  const file = testInfo.outputPath("full.json");
  writeFileSync(file, JSON.stringify({ _app: "lancer-registry", v: 1, state: FULL_BUILD }));

  await page.locator("#import-file").setInputFiles(file);
  await expect(modal(page).locator("h3")).toHaveText("Загрузка сборки");
  expect((await getState(page)).pilot.callsign).toBe("СТАРЫЙ"); // nothing replaced yet
  await modal(page).getByRole("button", { name: "⬆ Заменить сборку" }).click();
  await expect.poll(() => getState(page)).toEqual(FULL_BUILD);
  expect(errors).toEqual([]);
});

test("importing a file that is not a build explains why", async ({ page }, testInfo) => {
  const errors = await openApp(page);
  const file = testInfo.outputPath("junk.json");
  writeFileSync(file, JSON.stringify({ hello: "world" }));
  await page.locator("#import-file").setInputFiles(file);
  await expect(modal(page).locator("h3")).toHaveText("Файл не распознан");
  expect(errors).toEqual([]);
});

test("share link opens the build read-only and keeps the reader's own save", async ({ page, context }) => {
  const errors = await openApp(page, { build: FULL_BUILD });
  const payload = await page.evaluate(() => encodeShare());

  // A different reader, with their own build in storage.
  const reader = await context.newPage();
  const readerErrors = await openApp(reader, { build: LEGACY_BUILD, path: `/?s=${payload}` });
  expect(await getState(reader)).toEqual(FULL_BUILD);
  await expect(reader.locator("#sheet")).toBeVisible();
  expect(new URL(reader.url()).search).toBe(""); // ?s= consumed from the address bar

  // Wait past the 400 ms autosave debounce: the reader's save must be untouched.
  await reader.waitForTimeout(800);
  expect((await getSaved(reader)).state.pilot.callsign).toBe("СТАРЫЙ");

  // Leaving the shared sheet returns to the reader's own build.
  await reader.locator("#t-sheet").click();
  expect((await getState(reader)).pilot.callsign).toBe("СТАРЫЙ");

  expect(errors).toEqual([]);
  expect(readerErrors).toEqual([]);
});

test("a broken share link reports instead of crashing", async ({ page }) => {
  const errors = await openApp(page, { build: LEGACY_BUILD, path: "/?s=zNOT_A_REAL_PAYLOAD" });
  await expect(modal(page).locator("h3")).toHaveText("Ссылка не прочитана");
  // consumeShareLink() logs the decode failure on purpose.
  expect(errors.filter(e => !e.includes("ссылка не прочитана"))).toEqual([]);
});

test("a broken share link keeps the reader's own build", async ({ page }) => {
  // Regression (fixed 2026-10-14): a link that failed to decode used to leave
  // an empty build, which the first render() autosaved over the real one.
  await openApp(page, { build: LEGACY_BUILD, path: "/?s=zNOT_A_REAL_PAYLOAD" });
  await page.waitForTimeout(800); // past the autosave debounce
  expect((await getSaved(page)).state.pilot.callsign).toBe("СТАРЫЙ");
  expect((await getState(page)).pilot.callsign).toBe("СТАРЫЙ");
});

test("switching language keeps the build and the logic keys", async ({ page }) => {
  const errors = await openApp(page, { build: FULL_BUILD });
  const hp = await page.evaluate(() => derived().mech.hp);

  await page.locator("#t-lang").click();
  await expect.poll(() => page.evaluate(() => currentLang)).toBe("en");
  await expect(page.locator("#t-lang")).toBeEnabled();
  expect(await getState(page)).toEqual(FULL_BUILD);
  expect(await page.evaluate(() => derived().mech.hp)).toBe(hp);

  await page.reload();
  await waitForBoot(page);
  expect(await page.evaluate(() => currentLang)).toBe("en"); // choice persisted

  await page.locator("#t-lang").click();
  await expect.poll(() => page.evaluate(() => currentLang)).toBe("ru");
  expect(await getState(page)).toEqual(FULL_BUILD);
  expect(errors).toEqual([]);
});
