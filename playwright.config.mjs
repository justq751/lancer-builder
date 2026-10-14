// Characterization tests for the no-build static app. See tests/README.md.
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT || 4173);

export default defineConfig({
  testDir: "tests",
  testMatch: "**/*.spec.mjs",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",

  // Text/JSON goldens are platform-independent; screenshots are not (font
  // rasterisation differs between Windows and Linux), so only they carry
  // the {platform} suffix.
  snapshotPathTemplate: "{testDir}/__snapshots__/{testFileName}/{arg}{ext}",
  expect: {
    toHaveScreenshot: {
      pathTemplate: "{testDir}/__screenshots__/{platform}/{testFileName}/{arg}{ext}",
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.002,
    },
  },

  use: {
    baseURL: `http://localhost:${PORT}/`,
    locale: "ru-RU",
    timezoneId: "UTC",
    acceptDownloads: true,
    trace: "retain-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],

  webServer: {
    command: `node tests/serve.mjs ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
  },
});
