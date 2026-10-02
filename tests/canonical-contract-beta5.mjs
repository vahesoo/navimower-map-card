import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/navimower-map-card.js", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

assert.match(pkg.version, /^0\.4\.0-beta\d+$/);
assert.match(source, /this\._mapPayload\?\.canonical\?\.cycles\?\.rows/);
assert.match(source, /coverage_pct: row\.progress_pct/);
assert.match(source, /const canonicalZoneState036 = \(payload, zoneId\) =>/);

// Cutover must consume the backend-owned canonical cycle model without adding
// another runtime wrapper around zone lookup/rendering.
assert.doesNotMatch(source, /proto\._zoneStateRecord\s*=\s*function/);
assert.doesNotMatch(source, /Card\.prototype\._zoneStateRecord\s*=\s*function/);

console.log("Canonical contract beta5: single + multi mower use backend cycle authority");
