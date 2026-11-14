import { test, expect } from "@playwright/test";

// Relevant LANCER 3.1.3 rules and the stats tab structure, without running Foundry.
const systemStyles = `
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, sans-serif; }
  .card { display: flex; flex-direction: column; margin: 3px 10px; padding-bottom: 1px; text-align: center; }
  .wraprow { display: flex; flex-wrap: wrap; }
  .wraprow.double > * { flex: 1 0 calc(50% - 6px); margin: 3px; }
  .lancer-header { display: flex; flex: 0 0 2em; justify-content: space-around; align-items: center; }
  .lancer-header span { margin: 0 4px; }
  .clipped > .lancer-header { padding-left: 10px; padding-right: 10px; }
  .stat-flow-container { display: grid; grid-template-columns: 1fr 1fr 1fr; align-items: center; }
  .lancer.actor.mech.sheet .stat-grid { display: grid; grid-template: repeat(5,5em)/repeat(5,1fr); }
  .lancer.actor.mech.sheet .stat-grid .pilot-summary { grid-row: 1/3; grid-column-start: 5; }
  .lancer.actor.mech.sheet .stat-grid .size-card { grid-row: 3/5; grid-column-start: 5; margin: auto; }
  .lancer.actor.mech.sheet .stat-grid .inventory { grid-row: 5/6; grid-column-start: 5; margin: auto; }
  .lancer.actor.mech.sheet .stat-grid .hase { grid-area: -4/4/-2/5; margin: 0 7px; }
  .lancer.actor.mech.sheet .stat-grid .hase .stat-flow-container { grid-template: auto/fit-content(75%) auto; }
`;
const card = name => `<div class="card clipped"><div class="lancer-header"><span>${name}</span></div>
  <div class="stat-flow-container"><button>⚙</button><b>0</b></div></div>`;
const sheet = `<main class="lancer actor mech sheet"><form><section class="sheet-body"><div class="tab stats">
  <div class="stat-grid">${Array.from({ length: 17 }, () => card("ОЗ")).join("")}
    <div class="pilot-summary">ПИЛОТ</div><div class="size-card">РАЗМЕР</div>
    <div class="wraprow double hase">${["КОРПУС", "ЛОВКОСТЬ", "СИСТЕМЫ", "ИНЖЕНЕРИЯ"].map(card).join("")}</div>
    <div class="inventory"><button>View Inventory</button></div>
  </div><div class="pilot-frame-wrapper"><div class="card"><span class="lancer-header">МАКРОСЫ</span><button>Структура</button></div></div>
</div></section></form></main>`;

for (const width of [900, 1100]) {
  test(`mech HASE cards fit above macros at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/foundry/lancer-ru-content/module.json");
    const manifest = await page.evaluate(() => JSON.parse(document.body.textContent));
    await page.setContent(sheet);
    await page.addStyleTag({ content: systemStyles });
    for (const style of manifest.styles ?? []) {
      await page.addStyleTag({ url: `/foundry/lancer-ru-content/${style}` });
    }
    for (const fontSize of [14, 18]) {
      await page.locator("main").evaluate((element, size) => { element.style.fontSize = `${size}px`; }, fontSize);
      const geometry = await page.evaluate(() => {
        const grid = document.querySelector(".stat-grid").getBoundingClientRect();
        const macros = document.querySelector(".pilot-frame-wrapper").getBoundingClientRect();
        return [...document.querySelectorAll(".hase > .card")].map(element => ({
          name: element.textContent.trim(), bottom: element.getBoundingClientRect().bottom,
          gridBottom: grid.bottom, macrosTop: macros.top,
        }));
      });
      for (const item of geometry) {
        expect(item.bottom, `${item.name} overflows stats at ${fontSize}px`).toBeLessThanOrEqual(item.gridBottom + 1);
        expect(item.bottom, `${item.name} overlaps macros at ${fontSize}px`).toBeLessThanOrEqual(item.macrosTop + 1);
      }
    }
  });
}
