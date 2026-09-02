import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const source = await readFile(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");
const dist = await readFile(new URL("../dist/navimower-map-card.js", import.meta.url), "utf8");

assert.match(packageJson.version, /^0\.3\.6-beta\d+$/);
assert.ok(Number(packageJson.version.split("beta")[1]) >= 12);
assert.match(packageJson.scripts["prepare-release"], /upgrade-google-satellite-beta12\.mjs/);
assert.match(packageJson.scripts.test, /google-satellite-beta12\.mjs/);

for (const runtime of [source, dist]) {
  assert.match(runtime, /0\.3\.6-beta12: Google Satellite sharpness and provider-frame normalization/);
  assert.match(runtime, /const centerLat = \(bounds\.north \+ bounds\.south\) \/ 2/);
  assert.match(runtime, /const centerLon = \(bounds\.east \+ bounds\.west\) \/ 2/);
  assert.match(runtime, /const centerZooms = maxZoomRects/);
  assert.match(runtime, /const candidates = centerZooms\.length \? centerZooms : reportedZooms/);
  assert.match(runtime, /Math\.max\(\.\.\.candidates\)/);
  assert.match(runtime, /_googleSatelliteViewportZoomRange11/);
  assert.match(runtime, /selected: nextZoom/);
  assert.doesNotMatch(runtime, /Math\.floor\(Math\.min\(\.\.\.reportedZooms\)\)/);

  // Keep the beta12 compatibility helpers available for users who update the
  // card before the beta23 integration. beta13 may route the active renderer
  // through integration-owned frames instead of calling these helpers directly.
  assert.match(runtime, /googleDynamicFrameOffset12/);
  assert.match(runtime, /googleDynamicGeoreference12/);
  assert.match(runtime, /googleDynamicSiteOrigin12/);
  assert.match(runtime, /inverse_active_cartographic_translation/);
  assert.match(runtime, /-frameOffset\.east/);
  assert.match(runtime, /-frameOffset\.north/);
}

console.log("0.3.6-beta12 Google Satellite sharpness/frame regression checks passed");
