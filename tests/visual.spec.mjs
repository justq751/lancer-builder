// Screenshot regression for the key screens at phone / tablet / desktop
// widths. Baselines are per-platform (tests/__screenshots__/<platform>/);
// after an intended visual change run `npm run test:update` and review the
// new PNGs before committing them.
import { test, expect } from "@playwright/test";
import { FULL_BUILD } from "./fixtures/builds.mjs";
import { openApp, openTab, modal } from "./helpers.mjs";

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

// "СОХРАНЕНО hh:mm" depends on the clock.
const shot = (page, name) =>
  expect(page).toHaveScreenshot(`${name}.png`, { mask: [page.locator("#savestate")] });

for (const vp of VIEWPORTS) {
  test.describe(vp.name, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("empty pilot tab", async ({ page }) => {
      await openApp(page);
      await shot(page, `${vp.name}-pilot-empty`);
    });

    for (const tab of ["pilot", "frame", "loadout", "summary"]) {
      test(`full build: ${tab}`, async ({ page }) => {
        await openApp(page, { build: FULL_BUILD });
        await openTab(page, tab);
        await page.evaluate(() => window.scrollTo(0, 0));
        await shot(page, `${vp.name}-${tab}`);
      });
    }

    test("full build: weapon picker", async ({ page }) => {
      // Every mount of FULL_BUILD is full — free the Heavy one to get a "+".
      const build = structuredClone(FULL_BUILD);
      build.mech.mounts[2].items = [];
      await openApp(page, { build });
      await openTab(page, "loadout");
      await page.locator('#mounts [data-addw="2"]').click();
      await expect(modal(page)).toBeVisible();
      await shot(page, `${vp.name}-weapon-picker`);
    });

    test("full build: sheet view", async ({ page }) => {
      await openApp(page, { build: FULL_BUILD, storage: { view_mode: "sheet" } });
      await expect(page.locator("#sheet")).toBeVisible();
      await shot(page, `${vp.name}-sheet`);
    });
  });
}
