// Quick reference (js/ui/reference.js): the ? button in the header opens the
// basic actions and the statuses/conditions.
import { test, expect } from "@playwright/test";
import { openApp, modal } from "./helpers.mjs";

const ref = (page, id) => page.locator(`#modal .ref-it[data-ref="${id}"]`);

test("the reference lists every action and status, nested where chosen inside another", async ({ page }) => {
  const errors = await openApp(page);
  await page.locator("#t-ref").click();
  await expect(modal(page)).toBeVisible();

  // Every action and status is placed somewhere — a new activation upstream
  // would otherwise vanish silently. KTB is on by default: Intangible counts.
  const total = await page.evaluate(() => L.actions.length + L.statuses.length);
  await expect(page.locator("#modal .ref-it")).toHaveCount(total);
  expect(await page.evaluate(() => L.actions.some(a => a.id.endsWith("_npc")))).toBe(false);
  await expect(page.locator("#modal .ref-grp h4")).toHaveText(
    ["Перемещение", "Быстрые действия", "Полные действия", "Реакции", "Свободные действия", "Статусы", "Состояния"]);

  await expect(ref(page, "act_quick_tech").locator(":scope > .ref-body > .ref-kids > .ref-it")).toHaveCount(4);
  await expect(ref(page, "act_invade").locator('.ref-it[data-ref="act_inv_fragment_signal"]')).toHaveCount(1);
  await expect(ref(page, "act_jockey").locator(":scope > .ref-body > .ref-kids > .ref-it")).toHaveCount(3);

  // Pilot-usable actions carry the badge; both Searches are listed.
  const onFoot = await page.evaluate(() => L.actions.filter(a => a.pilot).length);
  await expect(page.locator("#modal .ref-foot")).toHaveCount(onFoot);
  await expect(ref(page, "act_search_pilot").locator(".ref-foot")).toHaveCount(1);
  await expect(ref(page, "act_search").locator(".ref-foot")).toHaveCount(0);

  // The short line shows; the full rule opens on click.
  const skirmish = ref(page, "act_skirmish");
  await expect(skirmish.locator(".ref-nm")).toHaveText("Стычка");
  await expect(skirmish.locator(".ref-body")).toBeHidden();
  await skirmish.locator("summary").click();
  await expect(skirmish.locator(".ref-body")).toContainText("Сверхтяжёлое");
  expect(errors).toEqual([]);
});

test("a supplement's status shows only while the supplement is on", async ({ page }) => {
  const errors = await openApp(page, { storage: { lancer_content: JSON.stringify({ ktb: [] }) } });
  await page.locator("#t-ref").click();
  await expect(ref(page, "intangible")).toHaveCount(0);
  await expect(ref(page, "prone")).toHaveCount(1);
  expect(errors).toEqual([]);
});
