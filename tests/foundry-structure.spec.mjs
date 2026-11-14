import { test, expect } from "@playwright/test";

const markup = `<div id="hudzone"><form class="structstress" id="structstress">
  <div class="lancer-header"><i class="cci cci-structure"></i><span>Structure Damage -- Structure Damage</span></div>
  <div class="lancer-hud-body"><h4>Structure Damage has taken structure damage!</h4>
    <div class="damage-preview"><i></i><i></i><i></i><i class="damaged"></i></div>
    <p class="message">Roll 1d6 to determine what happens.</p></div>
  <button data-button="submit" type="submit">Roll</button><button data-button="cancel" type="button">Cancel</button>
</form></div>
<article id="primary"><div class="struct-stress"><i class="cci cci-structure"></i></div>
  <div class="dice-formula">2d6kl1 <span>1</span></div>
  <a class="flow-button" data-flow-type="check" data-check-type="hull" data-actor-id="Actor.test"><i></i> HULL</a>
  <a class="flow-button" data-flow-type="secondaryStructure" data-actor-id="Actor.test"><i></i> TEAR OFF</a>
  <a class="flow-button" data-flow-type="cascade"><span>CASCADE CHECK</span></a></article>
<article id="secondary"><div class="struct-stress">// Weapon Destruction //</div>
  <div class="dice-formula">1d6 <span>3</span></div>
  <div class="effect-text">On a 1–3, all weapons on one mount of your choice are destroyed</div></article>
<article id="unrelated"><a class="flow-button" data-flow-type="check" data-check-type="hull">HULL</a><span>Direct Hit</span></article>`;

for (const [lang, system, translated] of [["ru", "lancer", true], ["en", "lancer", false], ["ru", "other", false]]) {
  test(`structure prompt and result buttons for ${lang}/${system} retain roll controls`, async ({ page }) => {
    await page.goto("/foundry/lancer-ru-content/module.json");
    await page.setContent(markup);
    await page.evaluate(async ({ lang, system }) => {
      const hooks = new Map();
      window.Hooks = { on: (name, handler) => hooks.set(name, handler), once: (name, handler) => hooks.set(name, handler) };
      window.game = { system: { id: system }, i18n: { lang } };
      window.originalForm = document.querySelector("form");
      originalForm.addEventListener("submit", event => { event.preventDefault(); window.submitted = true; });
      document.querySelector('[data-button="cancel"]').addEventListener("click", () => { window.cancelled = true; });
      document.querySelector('a[data-check-type="hull"]').addEventListener("click", event => { window.checkType = event.currentTarget.dataset.checkType; });
      await import("/foundry/lancer-ru-content/scripts/main.js");
      hooks.get("ready")();
      window.renderResult = id => hooks.get("renderChatMessageHTML")({}, document.querySelector(id));
      ["#primary", "#secondary", "#unrelated"].forEach(renderResult);
    }, { lang, system });
    await expect(page.locator("form .lancer-header")).toHaveText(translated ? "СТРУКТУРНЫЙ УРОН -- Structure Damage" : "Structure Damage -- Structure Damage");
    await expect(page.locator("form h4")).toHaveText(translated ? "Structure Damage получает структурный урон!" : "Structure Damage has taken structure damage!");
    await expect(page.locator(".message")).toHaveText(translated ? "Бросьте 1d6, чтобы определить последствия." : "Roll 1d6 to determine what happens.");
    await expect(page.locator("form button")).toHaveText(translated ? ["Бросок", "Отмена"] : ["Roll", "Cancel"]);
    await expect(page.locator("#primary a")).toHaveText(translated ? ["КОРПУС", "ОПРЕДЕЛИТЬ ПОВРЕЖДЕНИЕ", "ПРОВЕРКА КАСКАДА"] : ["HULL", "TEAR OFF", "CASCADE CHECK"]);
    await expect(page.locator("#secondary .struct-stress")).toHaveText(translated ? "// УНИЧТОЖЕНИЕ ОРУЖИЯ //" : "// Weapon Destruction //");
    await expect(page.locator("#secondary .effect-text")).toHaveText(translated ? "При результате 1–3 уничтожается всё оружие на одном креплении по вашему выбору." : "On a 1–3, all weapons on one mount of your choice are destroyed");
    await expect(page.locator("#primary .dice-formula")).toHaveText("2d6kl1 1");
    await expect(page.locator(".damage-preview i")).toHaveCount(4);
    await expect(page.locator("#unrelated a")).toHaveText("HULL");
    await expect(page.locator("#primary a[data-check-type=hull]")).toHaveAttribute("data-actor-id", "Actor.test");
    await page.evaluate(() => { document.querySelector(".message").firstChild.data = "Roll 3d6 to determine what happens."; });
    await expect(page.locator(".message")).toHaveText(translated ? "Бросьте 3d6, чтобы определить последствия." : "Roll 3d6 to determine what happens.");
    expect(await page.evaluate(() => originalForm === document.querySelector("form"))).toBe(true);
    await page.locator('button[data-button="submit"]').click();
    expect(await page.evaluate(() => submitted)).toBe(true);
    await page.locator('button[data-button="cancel"]').click();
    expect(await page.evaluate(() => cancelled)).toBe(true);
    await page.locator('#primary a[data-check-type="hull"]').click();
    expect(await page.evaluate(() => checkType)).toBe("hull");
  });
}
