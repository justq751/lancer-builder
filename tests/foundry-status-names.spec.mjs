import { test, expect } from "@playwright/test";

for (const [lang, system] of [["ru", "lancer"], ["en", "lancer"], ["ru", "other"]]) {
  test(`Exposed follows builder terminology for ${lang}/${system}`, async ({ page }) => {
    await page.goto("/foundry/lancer-ru-content/module.json");
    const names = await page.evaluate(async ({ lang, system }) => {
      const hooks = new Map();
      window.Hooks = { on() {}, once: (name, handler) => hooks.set(name, handler) };
      window.game = { system: { id: system }, i18n: { lang,
        translations: { lancer: { statusIconsNames: { exposed: "Уязвимость", impaired: "Ослаблен" } } },
      } };
      await import("/foundry/lancer-ru-content/scripts/main.js");
      hooks.get("i18nInit")();
      return game.i18n.translations.lancer.statusIconsNames;
    }, { lang, system });
    expect(names.exposed).toBe(lang === "ru" && system === "lancer" ? "Открыт" : "Уязвимость");
    expect(names.impaired).toBe("Ослаблен");
  });
}
