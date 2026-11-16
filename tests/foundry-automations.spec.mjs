import { test, expect } from "@playwright/test";

// Fake Foundry: only the parts main.js touches, with lancer-automations switched on or off.
async function boot(page, { lang = "ru", automations = true } = {}) {
  await page.goto("/foundry/lancer-ru-content/module.json");
  await page.setContent(`
    <div id="outside" title="Boost">Boost</div>
    <section class="lancer actor"><span class="effect-name">Invisible</span></section>
    <section class="la-hud-panel">
      <div class="la-hud-row" data-la-key="Boost" title="Boost"><span>  Boost </span></div>
      <input id="name" value="Boost"><select><option id="labelled" value="Boost">Boost</option><option id="bare">Hide</option></select>
      <span class="la-unknown">Something homebrew</span>
    </section>
    <div class="la-downtime"><select id="activity"><option id="activity-bare">Get Focused</option></select></div>`);
  await page.evaluate(async ({ lang, automations }) => {
    const hooks = {};
    window.Hooks = { on() {}, once: (name, handler) => { (hooks[name] ??= []).push(handler); } };
    window.game = { system: { id: "lancer" }, i18n: { lang, translations: { lancer: { statusIconsNames: {} } },
      format: (key, data) => `${data.type} Mount` },
      modules: new Map([["lancer-automations", { active: automations }]]) };
    window.CONFIG = { statusEffects: [] };
    window.libWrapper = { register: (_id, target, fn) => {
      if (target !== "game.i18n.format") throw new Error(target);
      const original = game.i18n.format;
      game.i18n.format = (...args) => fn(original, ...args);
    } };
    await import("/foundry/lancer-ru-content/scripts/main.js");
    for (const name of ["i18nInit", "ready"]) (hooks[name] ?? []).forEach(handler => handler());
  }, { lang, automations });
}

test("automations display text is translated in scope; logic attributes and inputs stay English", async ({ page }) => {
  await boot(page);
  const row = page.locator(".la-hud-row");
  await expect(row).toHaveText("  Рывок ");
  await expect(row).toHaveAttribute("title", "Рывок");
  await expect(row).toHaveAttribute("data-la-key", "Boost");
  await expect(page.locator("#name")).toHaveValue("Boost");
  await expect(page.locator("#labelled")).toHaveText("Рывок");
  await expect(page.locator("#labelled")).toHaveAttribute("value", "Boost");
  await expect(page.locator("#bare")).toHaveText("Hide");
  // The downtime dialog submits .value, so its bare options keep English there and show Russian.
  await expect(page.locator("#activity-bare")).toHaveText("Сосредоточиться");
  expect(await page.locator("#activity").evaluate(select => select.value)).toBe("Get Focused");
  await expect(page.locator(".la-unknown")).toHaveText("Something homebrew");
  await expect(page.locator("#outside")).toHaveText("Boost");
  await expect(page.locator("#outside")).toHaveAttribute("title", "Boost");
  await expect(page.locator(".effect-name")).toHaveText("Невидим");
});

test("text added or changed after load is translated too", async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const panel = document.querySelector(".la-hud-panel");
    panel.insertAdjacentHTML("beforeend", '<button class="later" data-tooltip="Hide">Hide</button>');
    document.body.insertAdjacentHTML("beforeend", '<div class="lancer-dialog-base"><h4>Boost</h4></div>');
    panel.querySelector("span").textContent = "Search";
    document.querySelector(".la-hud-row").setAttribute("title", "Search");
  });
  await expect(page.locator(".later")).toHaveText("Скрыться");
  await expect(page.locator(".later")).toHaveAttribute("data-tooltip", "Скрыться");
  await expect(page.locator(".lancer-dialog-base h4")).toHaveText("Рывок");
  await expect(page.locator(".la-hud-row span")).toHaveText("Поиск");
  await expect(page.locator(".la-hud-row")).toHaveAttribute("title", "Поиск");
});

test("mount label gets the translated mount type", async ({ page }) => {
  await boot(page);
  expect(await page.evaluate(() => game.i18n.format("LA.tokenHud.label.mount", { type: "Heavy" }))).toBe("Тяжёлое Mount");
});

for (const options of [{ lang: "en" }, { automations: false }]) {
  test(`nothing changes without ${options.lang ? "Russian" : "lancer-automations"}`, async ({ page }) => {
    await boot(page, options);
    await expect(page.locator(".la-hud-row")).toHaveText("  Boost ");
    expect(await page.evaluate(() => game.i18n.format("LA.tokenHud.label.mount", { type: "Heavy" }))).toBe("Heavy Mount");
  });
}
