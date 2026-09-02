import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const source = await readFile(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");
const dist = await readFile(new URL("../dist/navimower-map-card.js", import.meta.url), "utf8");

assert.match(packageJson.version, /^0\.3\.6-beta\d+$/);
assert.ok(Number(packageJson.version.split("beta")[1]) >= 10);
assert.match(packageJson.scripts["prepare-release"], /upgrade-estonia-orthophoto-beta10\.mjs/);
assert.match(packageJson.scripts.test, /estonia-orthophoto-beta10\.mjs/);

for (const runtime of [source, dist]) {
  assert.match(runtime, /0\.3\.6-beta10: zoom-aware Estonia orthophoto detail and WGS84 ellipsoid underlay geodesy/);
  assert.match(runtime, /UNDERLAY_WGS84_A_M = 6378137\.0/);
  assert.match(runtime, /298\.257223563/);
  assert.match(runtime, /underlayCurvatureRadii/);
  assert.match(runtime, /WGS84_E2/);
  assert.match(runtime, /DETAIL_SCALE_THRESHOLD = 1\.08/);
  assert.match(runtime, /DETAIL_DEBOUNCE_MS = 180/);
  assert.match(runtime, /devicePixelRatio/);
  assert.match(runtime, /MAX_WMS_PIXELS = 1600/);
  assert.match(runtime, /kaart\.maaamet\.ee\/wms\/alus-geo/);
  assert.match(runtime, /params\.set\("VERSION", "1\.1\.1"\)/);
  assert.match(runtime, /EESTIFOTO/);
  assert.match(runtime, /params\.set\("SRS", "EPSG:4326"\)/);
  assert.match(runtime, /nm-estonia-wms-detail-pending/);
  assert.match(runtime, /image\.addEventListener\("load"/);
  assert.match(runtime, /method === "_applyViewBox" \? DETAIL_DEBOUNCE_MS : 0/);
  assert.match(runtime, /providerMaxZoom/);
}

console.log("0.3.6-beta10 Estonia zoom-aware orthophoto detail regression checks passed");
