import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts, plain } from "./load.mjs";
import { FULL_BUILD } from "../fixtures/builds.mjs";

const load = (globals = {}) =>
  loadScripts(["js/core/build.js", "js/core/share.js"], { state: structuredClone(FULL_BUILD), ...globals });

test("pack → unpack round-trips the build", () => {
  const run = load();
  assert.deepEqual(plain(run("unpackBuild(packBuild())")), FULL_BUILD);
});

test("compressed link (z…) decodes back to the same build", async () => {
  const run = load();
  const payload = await run("encodeShare()");
  assert.match(payload, /^z[A-Za-z0-9_-]+$/, "url-safe base64, no padding");
  run.ctx.payload = payload;
  assert.deepEqual(plain(run("unpackBuild")(await run("decodeShare(payload)"))), FULL_BUILD);
});

test("without CompressionStream the link falls back to plain (u…)", async () => {
  const run = load({ CompressionStream: undefined });
  const payload = await run("encodeShare()");
  assert.equal(payload[0], "u");
  run.ctx.payload = payload;
  assert.deepEqual(plain(run("unpackBuild")(await run("decodeShare(payload)"))), FULL_BUILD);
});

test("an unknown link format is rejected", async () => {
  const run = load();
  await assert.rejects(() => run(`decodeShare("xAAAA")`));
});

test("unpackBuild ignores garbage", () => {
  assert.equal(load()("unpackBuild(null)"), null);
  assert.equal(load()("unpackBuild('nope')"), null);
});
