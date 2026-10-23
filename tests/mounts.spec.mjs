// Mount rules a player meets by clicking: a superheavy weapon's second mount,
// and CORE bonuses that add or change mounts.
import { test, expect } from "@playwright/test";
import { FULL_BUILD } from "./fixtures/builds.mjs";
import { openApp, getState, openTab, modal } from "./helpers.mjs";

const mounts = async page => (await getState(page)).mech.mounts;

test("a superheavy weapon asks for its second mount and takes it up", async ({ page }) => {
  const build = structuredClone(FULL_BUILD);
  build.mech.mounts[2].items = []; // free the Heavy mount
  const errors = await openApp(page, { build });
  await openTab(page, "loadout");
  await page.locator('#mounts [data-addw="2"]').click();
  await page.locator("#wp-search").fill(await page.evaluate(() => M.weapon.mw_siege_cannon.name));
  await page.locator('#wp-list .listrow[data-w="mw_siege_cannon"]').click();
  await page.locator("#wp-install-inline").click();

  // Flex and Main both hold a weapon — each choice says what comes off.
  await expect(page.locator("[data-mchoice]")).toHaveCount(2);
  await expect(page.locator('[data-mchoice="1"] .mc-lost')).toBeVisible();
  await page.locator('[data-mchoice="1"]').click();
  await expect(modal(page)).toBeHidden();
  const m = await mounts(page);
  expect(m[2].items).toEqual([{ id: "mw_siege_cannon", mod: null, extra: 1 }]);
  expect(m[1].items).toEqual([]);
  // The taken mount offers nothing to install.
  await expect(page.locator('#mounts [data-addw="1"]')).toHaveCount(0);

  // Removing the weapon frees the mount again.
  await page.locator('#mounts [data-rmw="2:0"]').click();
  await expect(page.locator('#mounts [data-addw="1"]')).toBeVisible();
  expect(errors).toEqual([]);
});

test("Improved Armament adds a Flex mount; removing it names the weapon that comes off", async ({ page }) => {
  const build = structuredClone(FULL_BUILD);
  build.cores = [];
  build.mech = { frameId: "mf_tortuga", systems: [], mounts: [{ type: "Main", items: [] }, { type: "Heavy", items: [] }] };
  const errors = await openApp(page, { build });
  await openTab(page, "core");
  await page.locator('[data-pickcore="cb_improved_armament"]').click();
  expect((await mounts(page)).at(-1)).toEqual({ type: "Flex", items: [], cb: "cb_improved_armament" });

  await page.evaluate(() => { state.mech.mounts[2].items.push({ id: "mw_assault_rifle", mod: null }); render(); });
  await page.locator('#core-selected [data-rmcore="0"]').click();
  await expect(modal(page)).toContainText(await page.evaluate(() => M.weapon.mw_assault_rifle.name));
  await page.locator('#modal [data-act="0"]').click();
  expect(await mounts(page)).toEqual([{ type: "Main", items: [] }, { type: "Heavy", items: [] }]);
  expect((await getState(page)).cores).toEqual([]);
  expect(errors).toEqual([]);
});

test("Mount Retrofitting asks for a mount right away and turns it into Main/Aux", async ({ page }) => {
  const build = structuredClone(FULL_BUILD);
  build.cores = [];
  const errors = await openApp(page, { build });
  await openTab(page, "core");
  await page.locator('[data-pickcore="cb_mount_retrofitting"]').click();
  await expect(page.locator("[data-mchoice]")).toHaveCount(3);
  await page.locator('[data-mchoice="1"]').click(); // Main: its rifle fits Main/Aux and stays
  const m = await mounts(page);
  expect(m[1]).toEqual({ type: "Main/Aux", items: [{ id: "mw_assault_rifle", mod: null }], retro: "Main" });

  // Removing the bonus gives the mount its own type back.
  await page.locator('#core-selected [data-rmcore="0"]').click();
  expect((await mounts(page))[1]).toEqual({ type: "Main", items: [{ id: "mw_assault_rifle", mod: null }] });
  expect(errors).toEqual([]);
});
