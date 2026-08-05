import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { defaultGridOptions } from "../src/navimower-map-card-v033.js";

const options = defaultGridOptions();
assert.equal(options.columns, "full");
assert.equal(options.min_columns, 3);
assert.equal(options.min_rows, 5);
assert.equal("rows" in options, false);

for (const root of ["src", "dist"]) {
  const loader = readFileSync(`${root}/navimower-map-card.js`, "utf8");
  const layer = readFileSync(`${root}/navimower-map-card-v033.js`, "utf8");
  assert.match(loader, /NAVIMOWER_MAP_CARD_VERSION = "0\.3\.0-beta4"/);
  assert.match(loader, /navimower-map-card-v033\.js/);
  assert.match(layer, /columns: "full"/);
  assert.doesNotMatch(layer, /rows:\s*\d/);
}

console.log("0.3.0-beta4 grid-default checks passed");
