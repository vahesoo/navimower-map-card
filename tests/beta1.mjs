import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

for (const root of ["src", "dist"]) {
  const loader = readFileSync(`${root}/navimower-map-card.js`, "utf8");
  const core = readFileSync(`${root}/navimower-map-card-core.js`, "utf8");
  const archive = readFileSync(`${root}/navimower-map-card-v030.js`, "utf8");
  const outlines = readFileSync(`${root}/navimower-map-card-v031.js`, "utf8");
  const zoneMarkers = readFileSync(`${root}/navimower-map-card-v032.js`, "utf8");
  const gridDefaults = readFileSync(`${root}/navimower-map-card-v033.js`, "utf8");
  const beta7 = readFileSync(`${root}/navimower-map-card-v034b7.js`, "utf8");

  assert.match(loader, /NAVIMOWER_MAP_CARD_VERSION = "0\.3\.0-beta7"/);
  assert.match(loader, /navimower-map-card-core\.js/);
  assert.match(loader, /navimower-map-card-v030\.js/);
  assert.match(loader, /navimower-map-card-v031\.js/);
  assert.match(loader, /navimower-map-card-v032\.js/);
  assert.match(loader, /navimower-map-card-v033\.js/);
  assert.match(loader, /navimower-map-card-v034b7\.js/);
  assert.doesNotMatch(loader, /navimower-map-card-v034\.js/);
  assert.match(core, /type: "color"/);
  assert.match(core, /data-schedule-action="save-all"/);
  assert.match(archive, /session-render/);
  assert.match(archive, /fill-rule="evenodd"/);
  assert.match(outlines, /non-scaling-stroke/);
  assert.match(zoneMarkers, /zone_marker_scale/);
  assert.match(gridDefaults, /columns: "full"/);
  assert.match(beta7, /NAVIMOWER_MAP_CARD_V034B7_VERSION = "0\.3\.0-beta7"/);
  assert.match(beta7, /SCHEDULE_CLOSE_DELAY_MS = 2500/);
  assert.doesNotMatch(beta7, /normalizeHexColor|navimower_hex|Object\.assign\(config/);
}
console.log("0.3.0-beta7 feature checks passed");
