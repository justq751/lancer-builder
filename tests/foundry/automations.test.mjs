import assert from "node:assert/strict";
import { test } from "node:test";
import { translateString, translateFormatData } from "../../foundry/lancer-ru-content/scripts/automations.js";
import FORMAT from "../../foundry/lancer-ru-content/generated/automations-format.js";

const text = { exact: { Boost: "Рывок", "End of Turn": "Конец хода" }, patterns: [] };
const patterns = [[/^(?:Regain (\d+) HP)$/, "Восстановить $1 ОЗ"]];

test("exact display text is replaced, surrounding whitespace kept, unknown text left alone", () => {
  assert.equal(translateString("Boost", text, patterns), "Рывок");
  assert.equal(translateString("\n   Boost  ", text, patterns), "\n   Рывок  ");
  assert.equal(translateString("End   of\nTurn", text, patterns), "Конец хода");
  for (const value of ["Boosted", "boost", "", "  ", "Рывок"]) assert.equal(translateString(value, text, patterns), value);
});

test("patterns carry their captured values", () => {
  assert.equal(translateString("Regain 12 HP", text, patterns), "Восстановить 12 ОЗ");
  assert.equal(translateString("Regain all HP", text, patterns), "Regain all HP");
});

test("mount type parameter is translated only for listed keys and known values", () => {
  const data = { type: "Flex" };
  assert.equal(translateFormatData("LA.tokenHud.label.mount", data).type, FORMAT["LA.tokenHud.label.mount"].type.Flex);
  assert.deepEqual(data, { type: "Flex" });
  assert.deepEqual(translateFormatData("LA.tokenHud.label.mount", { type: "Custom" }), { type: "Custom" });
  assert.deepEqual(translateFormatData("LA.other", { type: "Flex" }), { type: "Flex" });
  assert.equal(translateFormatData("LA.tokenHud.label.mount", undefined), undefined);
});
