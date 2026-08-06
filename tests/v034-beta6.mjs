import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NAVIMOWER_MAP_CARD_V034_VERSION, normalizeColorEditorConfig } from "../src/navimower-map-card-v034.js";

assert.equal(NAVIMOWER_MAP_CARD_V034_VERSION, "0.3.0-beta6");
const config = Object.freeze({ type: "custom:navimower-map-card", zone_fill_color: "#81c784" });
const normalized = normalizeColorEditorConfig(config);
assert.notEqual(normalized, config);
assert.equal(config.zone_fill_color, "#81c784");
assert.equal(normalized.zone_fill_color, "#81C784");
assert.equal(normalized.type, "custom:navimower-map-card");

for (const root of ["src", "dist"]) {
  const source = readFileSync(`${root}/navimower-map-card-v034.js`, "utf8");
  assert.match(source, /return originalSetConfig\.call\(this, normalized\)/);
  assert.doesNotMatch(source, /Object\.assign\(config/);
}

console.log("0.3.0-beta6 immutable config checks passed");
