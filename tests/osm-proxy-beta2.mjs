import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");
const syncVersion = await readFile(new URL("../scripts/sync-version.mjs", import.meta.url), "utf8");

for (const marker of [
  '"#nm-osm-" + range.zoom + "-" + x + "-" + y',
  'image[href^="#nm-osm-"]',
  "osm_tile=1&z=",
  "callApiRaw",
  "fetchWithAuth",
  "_nm037Beta2OsmObjectUrls",
]) {
  assert.ok(source.includes(marker), `missing authenticated OSM marker: ${marker}`);
}

assert.ok(
  !source.includes('"https://tile.openstreetmap.org/" + range.zoom + "/" + x + "/" + y + ".png"'),
  "beta2 generated runtime must not issue direct OSM SVG tile requests",
);
assert.ok(!syncVersion.includes("PatchPath"), "release preparation must not replay old runtime patches");

console.log("0.3.7-beta2 authenticated OSM proxy checks passed");
