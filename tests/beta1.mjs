import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

for (const path of ["src/navimower-map-card.js", "dist/navimower-map-card.js"]) {
  const code = readFileSync(path, "utf8");
  assert.match(code, /NAVIMOWER_MAP_CARD_VERSION = "0\.2\.2"/);
  assert.match(code, /type: "color"/);
  assert.match(code, /const zoom = Math\.max\(1, finiteNumber\(this\._view\?\.scale, 1\)\)/);
  assert.match(code, /data-schedule-action="save-all"/);
  assert.match(code, /_saveAllScheduleChanges\(\)/);
  assert.doesNotMatch(code, /data-schedule-action="save-day"/);
}
console.log("0.2.2 feature checks passed");
