import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const source = await readFile(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");
const dist = await readFile(new URL("../dist/navimower-map-card.js", import.meta.url), "utf8");

assert.equal(packageJson.version, "0.3.6-beta12");
assert.match(packageJson.scripts["prepare-release"], /upgrade-google-satellite-beta12\.mjs/);
assert.match(packageJson.scripts.test, /google-satellite-beta12\.mjs/);

for (const runtime of [source, dist]) {
  assert.match(runtime, /0\.3\.6-beta12: preserve Google Satellite detail after viewport metadata/);
  assert.match(runtime, /const centerLat = \(bounds\.north \+ bounds\.south\) \/ 2/);
  assert.match(runtime, /const centerLon = \(bounds\.east \+ bounds\.west\) \/ 2/);
  assert.match(runtime, /const centerZooms = maxZoomRects/);
  assert.match(runtime, /const candidates = centerZooms\.length \? centerZooms : reportedZooms/);
  assert.match(runtime, /Math\.max\(\.\.\.candidates\)/);
  assert.match(runtime, /_googleSatelliteViewportZoomRange11/);
  assert.match(runtime, /selected: nextZoom/);
  assert.doesNotMatch(runtime, /Math\.floor\(Math\.min\(\.\.\.reportedZooms\)\)/);
}

console.log("0.3.6-beta12 Google Satellite viewport sharpness regression checks passed");
