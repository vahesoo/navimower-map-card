import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const source = await readFile(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");
const dist = await readFile(new URL("../dist/navimower-map-card.js", import.meta.url), "utf8");

assert.match(packageJson.version, /^0\.3\.6-beta\d+$/);
assert.ok(Number(packageJson.version.split("beta")[1]) >= 8);
assert.match(packageJson.scripts["prepare-release"], /upgrade-estonia-orthophoto-beta8\.mjs/);
assert.match(packageJson.scripts.test, /estonia-orthophoto-beta8\.mjs/);

for (const runtime of [source, dist]) {
  assert.match(runtime, /0\.3\.6-beta8: Estonia orthophoto underlay/);
  assert.match(runtime, /estonia_orthophoto/);
  assert.match(runtime, /foto@GMC/);
  assert.match(runtime, /tiles\.maaamet\.ee\/tm\/tms\/1\.0\.0/);
  assert.match(runtime, /ASUTUS=NAVIMOWER/);
  assert.match(runtime, /KESKKOND=LIVE/);
  assert.match(runtime, /IS=NAVIMOWER_MAP_CARD/);
  assert.match(runtime, /2 \*\* range\.zoom - 1 - y/);
  assert.match(runtime, /Ortofoto, Maa- ja Ruumiamet/);
  assert.match(runtime, /country === "EE"/);
  assert.match(runtime, /isEstoniaLocation/);
  assert.match(runtime, /Maa- ja Ruumiamet Ortofoto/);
  assert.match(runtime, /Map underlay opacity/);
  assert.match(runtime, /\["openstreetmap", "estonia_orthophoto"\]/);
}

assert.doesNotMatch(source, /google.*api.*key/i);
assert.doesNotMatch(source, /mapbox.*token/i);

console.log("0.3.6-beta8 Estonia orthophoto regression checks passed");
