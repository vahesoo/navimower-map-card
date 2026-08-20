import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");

assert.match(source, /function mowerCuttingWidthMeters034\(model\)/);
assert.match(source, /return 0\.43;/);
assert.match(source, /return 0\.237;/);
assert.match(source, /return 0\.21;/);
assert.match(source, /return 0\.18;/);
assert.match(source, /cuttingWidth \+ 0\.10/);
assert.equal((source.match(/const width = trailWidth034\(this\);/g) || []).length, 3);
assert.equal((source.match(/Math\.min\(Math\.max\(0\.25 \* this\._layout\.scale, 5\), 28\)/g) || []).length, 0);

console.log("model-aware trail width checks passed");
