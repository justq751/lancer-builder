import { expect } from "@playwright/test";
import { savedEnvelope } from "./fixtures/builds.mjs";

/** Console noise that is not a bug in the app. */
const IGNORED_ERRORS = [
  /favicon\.ico/, // no favicon yet — tracked in PLAN.md, stage 6
];

/**
 * Opens the app with a clean slate and waits until the boot overlay is gone.
 *
 * - `build`: a state object to pre-seed as the autosave (or a raw string,
 *   to simulate a corrupted save).
 * - `storage`: extra localStorage keys (e.g. { view_mode: "sheet" }).
 * - `lang`: "ru" (default) or "en".
 * - `path`: URL path/query to open, e.g. "?s=…" for a share link.
 *
 * localStorage is seeded once per page (guarded by a sessionStorage flag), so
 * `page.reload()` keeps whatever the app itself saved — that is what the
 * persistence tests need to observe.
 *
 * Returns `errors`: console errors + uncaught exceptions collected so far and
 * from now on; finish a test with `expect(errors).toEqual([])`.
 */
export async function openApp(page, { build, storage = {}, lang = "ru", path = "" } = {}) {
  const errors = [];
  page.on("console", msg => {
    if (msg.type() !== "error") return;
    const text = `${msg.text()} @ ${msg.location().url || ""}`;
    if (!IGNORED_ERRORS.some(re => re.test(text))) errors.push(text);
  });
  page.on("pageerror", err => errors.push(`pageerror: ${err.message}`));

  const seed = { lancer_lang: lang, ...storage };
  if (build !== undefined) {
    seed.lancer_build = typeof build === "string" ? build : JSON.stringify(savedEnvelope(build));
  }
  await page.addInitScript(seed => {
    if (sessionStorage.getItem("__seeded")) return;
    localStorage.clear();
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
    sessionStorage.setItem("__seeded", "1");
  }, seed);

  await page.goto(path || "/");
  await waitForBoot(page);
  return errors;
}

export async function waitForBoot(page) {
  await expect(page.locator("#boot")).toHaveClass(/done/, { timeout: 15_000 });
}

/** The live build, as the app holds it. */
export const getState = page => page.evaluate(() => JSON.parse(JSON.stringify(state)));

/** The autosave as currently written to localStorage (null if none). */
export const getSaved = page =>
  page.evaluate(() => JSON.parse(localStorage.getItem("lancer_build") || "null"));

export async function openTab(page, id) {
  await page.locator(`#tab-btn-${id}`).click();
  await expect(page.locator(`#tab-btn-${id}`)).toHaveAttribute("aria-selected", "true");
}

export const modal = page => page.locator("#modal.show");

/**
 * Sets the interface and/or data language through the language panel, the
 * way a person would: ⋯ first on a narrow screen, then the language button,
 * then the radio. Waits until the switch (which may refetch data) is done.
 */
export async function setLanguage(page, { ui, data } = {}) {
  const more = page.locator("#t-more");
  if (await more.isVisible()) await more.click();
  await page.locator("#t-lang").click();
  const panel = page.locator("#lang-panel");
  await expect(panel).toBeVisible();
  for (const [name, value] of [["ui-lang", ui], ["data-lang", data]]) {
    if (!value) continue;
    await panel.locator(`label:has(input[name="${name}"][value="${value}"])`).click();
    await expect(panel.locator(`input[name="${name}"][value="${value}"]`)).toBeChecked();
  }
  await expect(panel.locator('fieldset[aria-busy="true"]')).toHaveCount(0);
  if (ui) await expect(page.locator("html")).toHaveAttribute("lang", ui);
  if (data) await expect.poll(() => page.evaluate(() => currentLang)).toBe(data);
  await page.keyboard.press("Escape");
}
