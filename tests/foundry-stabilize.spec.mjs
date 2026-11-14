import { test, expect } from "@playwright/test";

const choices = [
  ["cool", 1, "Cool", "Cool Mech"], ["restore", 1, "Repair", "Restore HP"],
  ["reload", 2, "Reload", "Reload"], ["burn", 2, "ClearBurn", "Clear Burn"],
  ["clearown", 2, "ClearOwnCond", "Clear Own Condition"], ["clearother", 2, "ClearOtherCond", "Clear Ally Condition"],
];
const markup = `<div id="prompt" class="dialog"><h4 class="window-title">STABILIZE - Cool Mech</h4>
  <div class="dialog-content"><form><h2>Please select your two Stabilize actions</h2><div class="stabilize-wrapper">
  ${[1, 2].map(group => `<span>OPTION ${group}</span><div class="flexrow">${choices.filter(c => c[1] === group).map(([id, , value, label], i) => `
    <input class="stabilize-options-${group}" id="stab-option-${id}" name="stabilize-options-${group}" type="radio" value="${value}" ${i === 0 ? "checked" : ""}>
    <label for="stab-option-${id}"><i class="checked-icon"></i><span class="center-text">${label}</span></label>`).join("")}</div>`).join("")}
  </div></form></div><div class="dialog-buttons"><button data-button="submit"><i></i>Submit</button><button data-button="cancel"><i></i>Cancel</button></div></div>
  <div id="unrelated" class="dialog"><h4 class="window-title">STABILIZE - Another</h4><h2>Please select your two Stabilize actions</h2><button>Cancel</button></div>`;

for (const [lang, system, translated] of [["ru", "lancer", true], ["en", "lancer", false], ["ru", "other", false]]) {
  test(`stabilize dialog for ${lang}/${system} preserves action choices and buttons`, async ({ page }) => {
    await page.goto("/foundry/lancer-ru-content/module.json");
    await page.setContent(markup);
    await page.evaluate(async ({ lang, system }) => {
      const hooks = new Map();
      window.Hooks = { once() {}, on: (name, handler) => hooks.set(name, handler) };
      window.game = { system: { id: system }, i18n: { lang } };
      window.originalRadio = document.querySelector("#stab-option-cool");
      document.querySelector('[data-button="submit"]').addEventListener("click", () => {
        window.selected = [1, 2].map(group => document.querySelector(`.stabilize-options-${group}:checked`).value);
      });
      document.querySelector('[data-button="cancel"]').addEventListener("click", () => { window.cancelled = true; });
      await import("/foundry/lancer-ru-content/scripts/main.js");
      window.renderPrompt = () => hooks.get("renderDialog")(
        { element: [document.querySelector("#prompt")] }, [document.querySelector(".dialog-content")]);
      renderPrompt();
      hooks.get("renderDialog")({}, [document.querySelector("#unrelated")]);
    }, { lang, system });
    await expect(page.locator("#prompt h2")).toHaveText(translated ? "Выберите два действия стабилизации" : "Please select your two Stabilize actions");
    await expect(page.locator("#prompt .window-title")).toHaveText(translated ? "СТАБИЛИЗАЦИЯ - Cool Mech" : "STABILIZE - Cool Mech");
    await expect(page.locator(".center-text")).toHaveText(translated ? [
      "Остудить меха", "Восстановить ОЗ", "Перезарядка", "Снять огонь", "Снять своё состояние", "Снять состояние союзника",
    ] : choices.map(c => c[3]));
    await expect(page.locator(".stabilize-wrapper > span")).toHaveText(translated ? ["ДЕЙСТВИЕ 1", "ДЕЙСТВИЕ 2"] : ["OPTION 1", "OPTION 2"]);
    await expect(page.locator(".dialog-buttons button")).toHaveText(translated ? ["Применить", "Отмена"] : ["Submit", "Cancel"]);
    await expect(page.locator("#unrelated .window-title")).toHaveText("STABILIZE - Another");
    await expect(page.locator("#unrelated button")).toHaveText("Cancel");
    await expect(page.locator("#stab-option-cool")).toBeChecked();
    await expect(page.locator("#stab-option-reload")).toBeChecked();
    expect(await page.locator("input").evaluateAll(inputs => inputs.map(input => input.value))).toEqual(choices.map(c => c[2]));
    await page.locator("#stab-option-restore").check();
    await page.locator("#stab-option-burn").check();
    await page.evaluate(() => renderPrompt());
    expect(await page.evaluate(() => originalRadio === document.querySelector("#stab-option-cool"))).toBe(true);
    await page.locator('[data-button="submit"]').click();
    expect(await page.evaluate(() => selected)).toEqual(["Repair", "ClearBurn"]);
    await page.locator('[data-button="cancel"]').click();
    expect(await page.evaluate(() => cancelled)).toBe(true);
  });
}
