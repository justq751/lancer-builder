import { test, expect } from "@playwright/test";

for (const [lang, system, translated] of [["ru", "lancer", true], ["en", "lancer", false], ["ru", "other", false]]) {
  test(`overheat engineering button for ${lang}/${system} keeps its action`, async ({ page }) => {
    await page.goto("/foundry/lancer-ru-content/module.json");
    await page.setContent(`<article id="overheat"><div class="struct-stress"><i class="cci cci-reactor"></i></div>
      <div class="dice-formula">2d6kl1 <span>1</span></div>
      <a class="flow-button" data-flow-type="check" data-check-type="eng" data-actor-id="Actor.test"><i class="fas fa-dice-d20"></i> ENGINEERING</a></article>
      <article id="other"><a class="flow-button" data-flow-type="check" data-check-type="eng">ENGINEERING</a></article>`);
    await page.evaluate(async ({ lang, system }) => {
      const hooks = new Map();
      window.Hooks = { once() {}, on: (name, handler) => hooks.set(name, handler) };
      window.game = { system: { id: system }, i18n: { lang } };
      window.originalButton = document.querySelector("#overheat a");
      originalButton.addEventListener("click", event => { window.checkType = event.currentTarget.dataset.checkType; });
      await import("/foundry/lancer-ru-content/scripts/main.js");
      hooks.get("renderChatMessageHTML")({}, document.querySelector("#overheat"));
      hooks.get("renderChatMessageHTML")({}, document.querySelector("#other"));
    }, { lang, system });
    await expect(page.locator("#overheat a")).toHaveText(translated ? "ИНЖЕНЕРИЯ" : "ENGINEERING");
    await expect(page.locator("#other a")).toHaveText("ENGINEERING");
    await expect(page.locator(".dice-formula")).toHaveText("2d6kl1 1");
    await expect(page.locator("#overheat a i")).toHaveCount(1);
    await expect(page.locator("#overheat a")).toHaveAttribute("data-actor-id", "Actor.test");
    expect(await page.evaluate(() => originalButton === document.querySelector("#overheat a"))).toBe(true);
    await page.locator("#overheat a").click();
    expect(await page.evaluate(() => checkType)).toBe("eng");
  });
}
