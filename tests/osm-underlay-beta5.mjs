import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

const releaseMatch = String(packageJson.version || "").match(/^0\.3\.6(?:-beta(\d+))?$/);
assert.ok(releaseMatch, "beta5 regression must stay on the 0.3.6 release line");
if (releaseMatch[1]) assert.ok(Number(releaseMatch[1]) >= 5, "beta5 regression requires 0.3.6-beta5 or later");
assert.match(packageJson.scripts["prepare-release"], /upgrade-osm-underlay-beta5\.mjs/);

assert.match(source, /0\.3\.6-beta5: optional OpenStreetMap underlay/);
assert.match(source, /map_underlay/);
assert.match(source, /osm_underlay_opacity/);
assert.match(source, /https:\/\/tile\.openstreetmap\.org\//);
assert.match(source, /© OpenStreetMap contributors/);
assert.match(source, /openstreetmap\.org\/copyright/);
assert.match(source, /validGeoreference/);
assert.match(source, /value\.status === "validated"/);
assert.match(source, /MAX_TILES = 36/);
assert.match(source, /syncSingle/);
assert.match(source, /syncMulti/);
assert.match(source, /combined_site_bounds/);
assert.match(source, /site\?\.status !== "validated"/);
assert.match(source, /pointer-events", "none"/);

console.log("0.3.6-beta5 OSM underlay regression checks passed");
