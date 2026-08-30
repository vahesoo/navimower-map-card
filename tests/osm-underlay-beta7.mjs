import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

assert.equal(packageJson.version, "0.3.6-beta7");
assert.match(packageJson.scripts["prepare-release"], /upgrade-osm-underlay-beta7\.mjs/);
assert.match(source, /0\.3\.6-beta7: OSM Multi visibility and ready-state sync/);
assert.match(source, /osmUnderlayActive036/);
assert.match(source, /\? "transparent" : esc\(background\)/);
assert.match(source, /_syncOsmUnderlay036/);
assert.match(source, /queueMicrotask\(\(\) => card\._syncOsmUnderlay036\?\.\(\)\)/);

console.log("0.3.6-beta7 OSM Multi visibility regression checks passed");
