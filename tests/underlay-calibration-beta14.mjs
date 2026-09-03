import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const source = await readFile(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");
const dist = await readFile(new URL("../dist/navimower-map-card.js", import.meta.url), "utf8");
const upgrade = await readFile(new URL("../scripts/upgrade-underlay-calibration-beta14.mjs", import.meta.url), "utf8");

assert.match(packageJson.version, /^0\.3\.6-beta\d+$/);
assert.ok(Number(packageJson.version.split("beta")[1]) >= 14);
assert.match(packageJson.scripts["prepare-release"], /upgrade-underlay-calibration-beta14\.mjs/);
assert.match(packageJson.scripts.test, /underlay-calibration-beta14\.mjs/);

for (const runtime of [source, dist]) {
  assert.match(runtime, /0\.3\.6-beta14: manual underlay position and rotation calibration/);
  assert.match(runtime, /underlay_east_offset/);
  assert.match(runtime, /underlay_north_offset/);
  assert.match(runtime, /underlay_rotation/);
  assert.match(runtime, /OFFSET_MIN14 = -5/);
  assert.match(runtime, /OFFSET_MAX14 = 5/);
  assert.match(runtime, /ROTATION_MIN14 = -5/);
  assert.match(runtime, /ROTATION_MAX14 = 5/);
  assert.match(runtime, /STEP14 = 0\.1/);
  assert.match(runtime, /unit_of_measurement: "m"/);
  assert.match(runtime, /unit_of_measurement: "°"/);
  assert.match(runtime, /East offset/);
  assert.match(runtime, /North offset/);
  assert.match(runtime, /Rotation/);
  assert.match(runtime, /rotation_deg_clockwise/);
  assert.match(runtime, /transformMatrix14/);
  assert.match(runtime, /singleTranslation14/);
  assert.match(runtime, /multiTranslation14/);
  assert.match(runtime, /singleCenter14/);
  assert.match(runtime, /centerX: 500/);
  assert.match(runtime, /\.nm-osm-underlay,\.nm-estonia-wms-detail,\.nm-estonia-wms-detail-pending/);
  assert.match(runtime, /_osm036MultiLayer/);
  assert.match(runtime, /_multi036Layer/);
}

// Manual presentation tuning must remain a frontend concern and must not
// introduce mower-model or datum-specific geodesy into the card.
assert.doesNotMatch(upgrade, /x3_rtk_anchor/i);
assert.doesNotMatch(upgrade, /vendor_map_static_fit/i);
assert.doesNotMatch(upgrade, /epsg:?\s*8366/i);
assert.doesNotMatch(upgrade, /etrs89/i);

console.log("0.3.6-beta14 manual underlay calibration regression checks passed");
