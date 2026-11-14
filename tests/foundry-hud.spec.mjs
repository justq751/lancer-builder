import { test, expect } from "@playwright/test";

async function boot(page, lang = "ru", system = "lancer") {
  await page.goto("/foundry/lancer-ru-content/module.json");
  await page.setContent('<div id="outside">Accuracy</div>');
  await page.evaluate(async ({ lang, system }) => {
    const ready = [];
    window.Hooks = { on() {}, once: (name, handler) => { if (name === "ready") ready.push(handler); } };
    window.game = { system: { id: system }, i18n: { lang } };
    await import("/foundry/lancer-ru-content/scripts/main.js");
    ready.forEach(handler => handler());
  }, { lang, system });
}

const hud = `<form id="accdiff-hud" class="accdiff">
  <div class="lancer-header" title="Accuracy">Accuracy</div><div class="target-name" title="Roll">Roll</div>
  <label for="bonus">Flat Modifier</label><b>Grit:</b> <span>0</span>
  <input id="bonus" type="number" value="3" aria-label="Increase flat bonus">
  <h4>Accuracy</h4><h4>Difficulty</h4>
  <label><input id="accurate" type="checkbox">Accurate (+1)</label>
  <label>Smart (*)</label><label>Seeking (*)</label><label>Inaccurate (-1)</label>
  <label>Impaired (-1)</label><label>Engaged (-1)</label>
  <strong data-tooltip="Global Accuracy/Difficulty Adjustment">Manual Adjust</strong>
  <b id="total">Total:</b><span id="result">4</span>
  <button type="button" data-tooltip="Add global accuracy" aria-label="Increase accuracy"><i></i>Roll</button>
  <button type="button">Cancel</button>
</form>`;

test("attack HUD translates after mounting and reactive updates without changing controls", async ({ page }) => {
  await boot(page);
  await page.evaluate(html => {
    const zone = document.createElement("div");
    zone.id = "hudzone";
    zone.innerHTML = html;
    document.body.append(zone);
    window.originalCheckbox = document.querySelector("#accurate");
    originalCheckbox.addEventListener("change", () => {
      document.querySelector("#total").firstChild.data = "Total:";
      document.querySelector("#result").textContent = "5";
      const label = document.createElement("label");
      label.id = "cover";
      label.textContent = "Soft Cover (-1)";
      document.querySelector("form").append(label);
    });
  }, hud);
  await expect(page.locator("h4")).toHaveText(["Точность", "Сложность"]);
  await expect(page.locator("label")).toHaveText(["Модификатор", "Точное (+1)", "Умное (*)",
    "Самонаводящееся (*)", "Неточное (-1)", "Ослаблен (-1)", "Связан боем (-1)"]);
  await expect(page.locator("button")).toHaveText(["Бросок", "Отмена"]);
  await expect(page.locator("strong")).toHaveAttribute("data-tooltip", "Общая поправка точности и сложности");
  await expect(page.locator("button").first()).toHaveAttribute("aria-label", "Увеличить точность");
  await expect(page.locator("#bonus")).toHaveValue("3");
  await expect(page.locator("#bonus")).toHaveAttribute("aria-label", "Увеличить модификатор");
  await expect(page.locator(".lancer-header")).toHaveText("Accuracy");
  await expect(page.locator(".target-name")).toHaveText("Roll");
  await expect(page.locator(".target-name")).toHaveAttribute("title", "Roll");
  await expect(page.locator(".lancer-header")).toHaveAttribute("title", "Accuracy");
  await expect(page.locator("#outside")).toHaveText("Accuracy");
  await page.locator("#accurate").check();
  await expect(page.locator("#accurate")).toBeChecked();
  expect(await page.evaluate(() => originalCheckbox === document.querySelector("#accurate"))).toBe(true);
  await expect(page.locator("#cover")).toHaveText("Мягкое укрытие (-1)");
  await expect(page.locator("#total")).toHaveText("Итого:");
  await expect(page.locator("#result")).toHaveText("5");
  expect(await page.evaluate(async () => {
    let mutations = 0;
    const observer = new MutationObserver(() => mutations++);
    observer.observe(document.querySelector("#hudzone"), { subtree: true, childList: true, characterData: true, attributes: true });
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    observer.disconnect();
    return mutations;
  })).toBe(0);
  await page.evaluate(html => { document.querySelector("#hudzone").innerHTML = html; }, hud);
  await expect(page.locator("h4")).toHaveText(["Точность", "Сложность"]);
});

for (const [lang, system] of [["en", "lancer"], ["ru", "other"]]) {
  test(`HUD remains unchanged for ${lang}/${system}`, async ({ page }) => {
    await boot(page, lang, system);
    await page.evaluate(html => {
      document.body.insertAdjacentHTML("beforeend", `<div id="hudzone">${html}</div>`);
    }, hud);
    await expect(page.locator("h4")).toHaveText(["Accuracy", "Difficulty"]);
    await expect(page.locator("#bonus")).toHaveValue("3");
  });
}
