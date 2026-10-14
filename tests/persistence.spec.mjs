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

test("typing a name alone is autosaved", async ({ page }) => {
  // Regression (2026-10-14): name/callsign/background edits only re-rendered
  // the HUD and never scheduled a save — close the tab and they were gone.
  await openApp(page);
  await page.locator("#f-name").fill("Кейт Аояма");
  await page.locator("#f-bg").selectOption("pbg_colonist");
  await expect.poll(async () => (await getSaved(page))?.state?.pilot)
    .toMatchObject({ name: "Кейт Аояма", background: "pbg_colonist" });
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

// A build on Störtebeker (Dustgrave pack) — used to simulate a pack that fails
// to load (flaky mobile network, CDN hiccup) while the build depends on it.
const PACK_BUILD = {
  ...structuredClone(FULL_BUILD),
  licenses: { Raleigh: 2, Nelson: 1 },
  mech: {
    frameId: "mf_störtebeker",
    mounts: [{ type: "Main", items: [{ id: "mw_assault_rifle", mod: null }] }],
    systems: ["ms_custom_paint_job"],
  },
};
const DUSTGRAVE = "**/data/packs/dustgrave-data.json";

test("a pack that fails to load never overwrites the saved build", async ({ page }) => {
  // Regression (AUDIT P0-1, 2026-10-14): the missing pack's frame was dropped,
  // its weapons cascaded out with it, and autosave wrote that over the real build.
  await page.route(DUSTGRAVE, route => route.fulfill({ status: 503, body: "" }));
  const errors = await openApp(page, { build: PACK_BUILD });

  const dlg = modal(page);
  await expect(dlg.locator("h3")).toHaveText("Часть данных не загрузилась");
  await expect(dlg).toContainText("DUSTGRAVE");
  await expect(page.locator("#savestate")).toContainText("НЕ СОХРАНЯЕТСЯ");

  // Editing in the degraded session must not reach storage either.
  await dlg.getByRole("button", { name: "Продолжить без них" }).click();
  await page.locator("#f-call").fill("ДРУГОЙ");
  await page.waitForTimeout(800); // past the autosave debounce
  const saved = (await getSaved(page)).state;
  expect(saved.mech).toEqual(PACK_BUILD.mech);
  expect(saved.pilot.callsign).toBe(PACK_BUILD.pilot.callsign);

  // Once the pack loads again, the build is all there.
  await page.unroute(DUSTGRAVE);
  await page.reload();
  await waitForBoot(page);
  expect(await getState(page)).toEqual(PACK_BUILD);
  await expect(modal(page)).toBeHidden();
  expect(errors.filter(e => !/dustgrave/.test(e))).toEqual([]);
});

test("a failed pack the build does not use leaves autosave on", async ({ page }) => {
  await page.route(DUSTGRAVE, route => route.fulfill({ status: 503, body: "" }));
  await openApp(page, { build: FULL_BUILD });
  await expect(modal(page)).toBeHidden(); // nothing of the build was lost
  await page.locator("#f-call").fill("ВОРОН");
  await expect.poll(async () => (await getSaved(page)).state.pilot.callsign).toBe("ВОРОН");
});

test("importing a build lifts the save hold", async ({ page }, testInfo) => {
  await page.route(DUSTGRAVE, route => route.fulfill({ status: 503, body: "" }));
  await openApp(page, { build: PACK_BUILD });
  await modal(page).getByRole("button", { name: "Продолжить без них" }).click();

  const file = testInfo.outputPath("full.json");
  writeFileSync(file, JSON.stringify({ _app: "lancer-registry", v: 1, state: FULL_BUILD }));
  await page.locator("#import-file").setInputFiles(file);
  await modal(page).getByRole("button", { name: "⬆ Заменить сборку" }).click();
  // An explicit replace is the user's decision — it saves normally again.
  await expect.poll(async () => (await getSaved(page)).state).toEqual(FULL_BUILD);
  await expect(page.locator("#savestate")).toContainText("СОХРАНЕНО");
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
