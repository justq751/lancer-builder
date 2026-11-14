import { test, expect } from "@playwright/test";

const mounts = ["Main/Aux", "Flex", "Main", "Heavy", "Aux/Aux", "Aux", "Integrated", "Superheavy", "Custom"];
const sizes = ["Main", "Auxiliary", "Main || Auxiliary", "Heavy", "Superheavy", "Integrated", "any"];
const sheet = `<div class="loadout-category"><i></i><span>MOUNTED WEAPONS</span><a data-action="append">+</a></div>
  ${mounts.map((name, i) => `<div class="mount card">
    <div class="mount-type-ctx-root" data-path="system.loadout.weapon_mounts.${i}"><span>${name} Weapon Mount</span>
      <a class="gen-control" data-action="splice" data-path="system.loadout.weapon_mounts.${i}">−</a></div>
    ${i === 0 ? sizes.map(size => `<div class="mech_weapon ref slot drop-settable" data-path="system.loadout.weapon_mounts.0.slots.0.weapon.value" data-accept-types="mech_weapon"><img><span class="major">Insert ${size} weapon</span></div>`).join("") : ""}
    <div class="mech_weapon ref set"><div class="lancer-header"><span class="minor">Insert Main weapon</span></div></div>
    <input value="Main"><div class="effect-text">Main Weapon Mount</div>
  </div>`).join("")}
  <div class="loadout-category"><i></i><span>MOUNTED SYSTEMS</span><span>2 / 7 SP USED</span></div>`;

for (const [lang, system, type, translated] of [
  ["ru", "lancer", "mech", true], ["en", "lancer", "mech", false],
  ["ru", "other", "mech", false], ["ru", "lancer", "pilot", false],
]) {
  test(`mount labels for ${lang}/${system}/${type}`, async ({ page }) => {
    await page.goto("/foundry/lancer-ru-content/module.json");
    await page.setContent(sheet);
    await page.evaluate(async ({ lang, system, type }) => {
      const hooks = new Map();
      window.Hooks = { once() {}, on: (name, handler) => hooks.set(name, handler) };
      window.game = { system: { id: system }, i18n: { lang } };
      window.originalSlot = document.querySelector(".slot");
      document.querySelector("a[data-action=splice]").addEventListener("click", event => {
        window.clickedPath = event.currentTarget.dataset.path;
      });
      await import("/foundry/lancer-ru-content/scripts/main.js");
      window.renderSheet = () => hooks.get("renderActorSheet")({ actor: { type } }, [document.body]);
      renderSheet();
    }, { lang, system, type });
    if (translated) {
      await expect(page.locator(".mount-type-ctx-root > span")).toHaveText([
        "ОСНОВНОЕ/ВСПОМ. ОРУЖЕЙНОЕ КРЕПЛЕНИЕ", "ГИБКОЕ ОРУЖЕЙНОЕ КРЕПЛЕНИЕ",
        "ОСНОВНОЕ ОРУЖЕЙНОЕ КРЕПЛЕНИЕ", "ТЯЖЁЛОЕ ОРУЖЕЙНОЕ КРЕПЛЕНИЕ",
        "ВСПОМ./ВСПОМ. ОРУЖЕЙНОЕ КРЕПЛЕНИЕ", "ВСПОМОГАТЕЛЬНОЕ ОРУЖЕЙНОЕ КРЕПЛЕНИЕ",
        "ИНТЕГРИРОВАННОЕ ОРУЖЕЙНОЕ КРЕПЛЕНИЕ", "СВЕРХТЯЖЁЛОЕ ОРУЖЕЙНОЕ КРЕПЛЕНИЕ", "Custom Weapon Mount",
      ]);
      await expect(page.locator(".slot > span")).toHaveText([
        "Установить основное оружие", "Установить вспомогательное оружие",
        "Установить основное или вспомогательное оружие", "Установить тяжёлое оружие",
        "Установить сверхтяжёлое оружие", "Установить интегрированное оружие", "Установить любое оружие",
      ]);
      await expect(page.locator(".loadout-category > span:first-of-type")).toHaveText(["УСТАНОВЛЕННОЕ ОРУЖИЕ", "УСТАНОВЛЕННЫЕ СИСТЕМЫ"]);
      await page.locator(".mount-type-ctx-root > span").first().evaluate(element => { element.textContent = "Heavy Weapon Mount"; });
      await page.evaluate(() => renderSheet());
      await expect(page.locator(".mount-type-ctx-root > span").first()).toHaveText("ТЯЖЁЛОЕ ОРУЖЕЙНОЕ КРЕПЛЕНИЕ");
    } else {
      await expect(page.locator(".mount-type-ctx-root > span")).toHaveText(mounts.map(name => `${name} Weapon Mount`));
      await expect(page.locator(".slot > span")).toHaveText(sizes.map(size => `Insert ${size} weapon`));
    }
    await expect(page.locator(".minor").first()).toHaveText("Insert Main weapon");
    await expect(page.locator(".effect-text").first()).toHaveText("Main Weapon Mount");
    await expect(page.locator("input").first()).toHaveValue("Main");
    await expect(page.locator(".loadout-category > span").last()).toHaveText("2 / 7 SP USED");
    expect(await page.evaluate(() => originalSlot === document.querySelector(".slot"))).toBe(true);
    await expect(page.locator(".slot").first()).toHaveAttribute("data-accept-types", "mech_weapon");
    await page.locator("a[data-action=splice]").first().click();
    expect(await page.evaluate(() => clickedPath)).toBe("system.loadout.weapon_mounts.0");
  });
}
