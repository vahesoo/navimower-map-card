import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const source = await readFile(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");
const dist = await readFile(new URL("../dist/navimower-map-card.js", import.meta.url), "utf8");

assert.match(packageJson.version, /^0\.3\.6-beta\d+$/);
assert.ok(Number(packageJson.version.split("beta")[1]) >= 9);
assert.match(packageJson.scripts["prepare-release"], /upgrade-estonia-orthophoto-beta9\.mjs/);
assert.match(packageJson.scripts.test, /estonia-orthophoto-beta9\.mjs/);

for (const runtime of [source, dist]) {
  assert.match(runtime, /0\.3\.6-beta9: Estonia orthophoto editor availability and zoom fix/);
  assert.match(runtime, /haConfig\.latitude/);
  assert.match(runtime, /haConfig\.longitude/);
  assert.match(runtime, /homeInEstonia/);
  assert.match(runtime, /haConfig\.time_zone/);
  assert.match(runtime, /Europe\/Tallinn/);
  assert.match(runtime, /Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone/);
  assert.match(runtime, /Card\.__navimower036EstoniaSite/);
  assert.match(runtime, /Maa- ja Ruumiamet Ortofoto/);
  assert.match(runtime, /chooseTiles = \(bounds, maxZoom = DEFAULT_ZOOM\)/);
  assert.match(runtime, /Math\.min\(DEFAULT_ZOOM, maxZoom\)/);
  assert.match(runtime, /provider === "estonia_orthophoto" \? 18 : DEFAULT_ZOOM/);
}

console.log("0.3.6-beta9 Estonia orthophoto editor and zoom regression checks passed");
