// Keyboard-only paths through the editor (AUDIT P1-2, P1-3, P3-4): every
// card that opens on click is a real button, focus survives the re-render
// that follows an action, form fields carry their labels.
import { test, expect } from "@playwright/test";
import { FULL_BUILD } from "./fixtures/builds.mjs";
import { openApp, openTab, modal, getState } from "./helpers.mjs";

const EVEREST = "mf_standard_pattern_i_everest";
const focused = page => page.evaluate(() => {
  const el = document.activeElement;
  return { tag: el.tagName, text: el.textContent.trim(), elId: el.id, ...el.dataset };
});

test("frame card: open details and pick the frame without a mouse", async ({ page }) => {
  const errors = await openApp(page, { build: { ...FULL_BUILD, mech: { frameId: null, mounts: [], systems: [] } } });
  await openTab(page, "frame");

  const card = page.locator(`#frame-list [data-open="frame"][data-id="${EVEREST}"]`);
  await expect(card).toHaveJSProperty("tagName", "BUTTON");
  await card.focus();
  await page.keyboard.press("Enter");
  await expect(modal(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(modal(page)).toBeHidden();
  expect(await focused(page)).toMatchObject({ open: "frame", id: EVEREST }); // back where it was

  await page.locator(`[data-pickframe="${EVEREST}"]`).focus();
  await page.keyboard.press("Enter");
  expect((await getState(page)).mech.frameId).toBe(EVEREST);
  // The button was replaced by render(); focus lands on its successor.
  expect(await focused(page)).toMatchObject({ pickframe: EVEREST, text: "✓ ВЫБРАНО" });
  expect(errors).toEqual([]);
});

test("license card opens with Enter; the rank stepper keeps focus", async ({ page }) => {
  const errors = await openApp(page, { build: FULL_BUILD });
  await openTab(page, "licenses");
  const card = page.locator('#tab [data-open="license"]').first();
  await card.focus();
  await page.keyboard.press("Enter");
  await expect(modal(page)).toBeVisible();
  await page.keyboard.press("Escape");

  const plus = page.locator('#tab .stepbtn[data-lic="Nelson"][data-d="1"]');
  await expect(plus).toHaveAttribute("aria-label", /Nelson/);
  const minus = page.locator('#tab .stepbtn[data-lic="Nelson"][data-d="-1"]');
  await minus.focus();
  await page.keyboard.press("Enter");
  expect((await getState(page)).licenses.Nelson).toBe(1);
  expect(await focused(page)).toMatchObject({ lic: "Nelson", d: "-1" });
  expect(errors).toEqual([]);
});

test("equipped weapon, system and core open from the keyboard", async ({ page }) => {
  const errors = await openApp(page, { build: FULL_BUILD });
  await openTab(page, "loadout");
  for (const sel of ['[data-open="weapon"]', '[data-open="system"]', '[data-open="mod"]']) {
    const el = page.locator(`#tab ${sel}`).first();
    await expect(el, sel).toHaveJSProperty("tagName", "BUTTON");
    await el.focus();
    await page.keyboard.press("Enter");
    await expect(modal(page), sel).toBeVisible();
    await page.keyboard.press("Escape");
  }
  await openTab(page, "core");
  for (const sel of ['[data-open="core-selected"]', '[data-open="core"]']) {
    await page.locator(`#tab ${sel}`).first().focus();
    await page.keyboard.press("Enter");
    await expect(modal(page), sel).toBeVisible();
    await page.keyboard.press("Escape");
  }
  await openTab(page, "pilot");
  await page.locator('#tab [data-open="gear"]').first().focus();
  await page.keyboard.press("Enter");
  await expect(modal(page)).toBeVisible();
  expect(errors).toEqual([]);
});

test("glossary tags in a detail view are buttons", async ({ page }) => {
  await openApp(page, { build: FULL_BUILD });
  await openTab(page, "loadout");
  await page.locator('#tab [data-open="weapon"]').first().click();
  const tag = page.locator("#modal .tag.glossary").first();
  await expect(tag).toHaveJSProperty("tagName", "BUTTON");
  await expect(tag).toHaveAttribute("aria-expanded", "false");
  await tag.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#modal .tag.glossary").first()).toHaveAttribute("aria-expanded", "true");
});

test("pilot fields are labelled", async ({ page }) => {
  const errors = await openApp(page);
  await page.getByLabel("Позывной").fill("ВОРОН");
  await page.getByLabel("Имя пилота").fill("Кира");
  await expect(page.getByLabel("Происхождение")).toBeVisible();
  const ll = page.getByLabel("Лицензионный уровень");
  await expect(ll).toHaveAttribute("aria-valuetext", /LL\s?0/);
  expect((await getState(page)).pilot).toMatchObject({ callsign: "ВОРОН", name: "Кира" });
  expect(errors).toEqual([]);
});

test("a skill stepper keeps focus across its own re-render", async ({ page }) => {
  await openApp(page);
  await openTab(page, "skills");
  const plus = page.locator('#skill-list .stepbtn[data-d="1"]').first();
  const sk = await plus.getAttribute("data-sk");
  await expect(plus).toHaveAttribute("aria-label", /.+/);
  await plus.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  expect((await getState(page)).skills[sk]).toBe(4); // triggers go +2 per step
  expect(await focused(page)).toMatchObject({ sk, d: "1" });
});

test("skip link jumps past the header; the editor has an h1", async ({ page }) => {
  await openApp(page);
  await expect(page.locator(".shell h1")).toHaveCount(1);
  await page.keyboard.press("Tab");
  const skip = page.locator("a.skip");
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => document.activeElement.id)).toBe("tab");
  expect(new URL(page.url()).hash).toBe("");
});

test("a filter chip that redraws only its tab keeps focus too", async ({ page }) => {
  await openApp(page);
  await openTab(page, "frame");
  await page.locator('#frame-filters .chip[data-ff="GMS"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('#frame-filters .chip[data-ff="GMS"]')).toHaveClass(/on/);
  // renderFrame(), not render(): the document-level focus net brings it back.
  await expect.poll(() => focused(page)).toMatchObject({ ff: "GMS" });
});
