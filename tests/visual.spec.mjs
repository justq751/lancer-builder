// Screenshot regression for the key screens at phone / tablet / desktop
// widths. Baselines are per-platform (tests/__screenshots__/<platform>/);
// after an intended visual change run `npm run test:update` and review the
// new PNGs before committing them.
import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { FULL_BUILD } from "./fixtures/builds.mjs";
import { openApp, openTab, modal } from "./helpers.mjs";

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

// "СОХРАНЕНО hh:mm" depends on the clock. Hidden (tests/screenshot.css) rather
// than masked: a mask paints over whatever covers the element too — on a
// phone that was the full-screen picker's title. toHaveScreenshot takes a
// stylePath; a `style` option is silently ignored.
const SHOT_CSS = fileURLToPath(new URL("./screenshot.css", import.meta.url));
// Under a full parallel run the frame portrait sometimes was not decoded yet.
// Only on-screen images: the off-screen loading="lazy" thumbnails never load.
const shot = async (page, name) => {
  await page.waitForFunction(() => [...document.images].every(img => {
    const r = img.getBoundingClientRect();
    return img.complete || r.bottom < 0 || r.top > innerHeight || !r.width;
  }));
  await expect(page).toHaveScreenshot(`${name}.png`, { stylePath: SHOT_CSS });
};

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

// English interface + data (ADR 0005): English strings are longer or shorter
// than the Russian ones the layout grew up with.
test.describe("english", () => {
  const EN = { lang: "en", storage: { lancer_ui_lang: "en" } };
  test.describe("desktop", () => {
    test.use({ viewport: { width: 1440, height: 900 } });
    test("full build: pilot", async ({ page }) => {
      await openApp(page, { build: FULL_BUILD, ...EN });
      await shot(page, "desktop-pilot-en");
    });
  });
  test.describe("mobile", () => {
    test.use({ viewport: { width: 390, height: 844 } });
    test("full build: loadout", async ({ page }) => {
      await openApp(page, { build: FULL_BUILD, ...EN });
      await openTab(page, "loadout");
      await page.evaluate(() => window.scrollTo(0, 0));
      await shot(page, "mobile-loadout-en");
    });
  });
});
