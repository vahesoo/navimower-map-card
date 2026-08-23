import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync("src/navimower-map-card.js", "utf8");
assert.match(source, /unique_id \|\| ""\)\.includes\("_custom_area_"\)/);
assert.doesNotMatch(source, /attrs\?\.source === "navimow_off_limit_import"/);
assert.match(source, /robust Custom Area discovery enabled/);
assert.match(source, /renderCustomAreas\(this\)/);
console.log("Custom Area discovery regression checks passed");
