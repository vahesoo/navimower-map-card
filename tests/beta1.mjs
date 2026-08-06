import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

for (const root of ["src", "dist"]) {
  const loader = readFileSync(`${root}/navimower-map-card.js`, "utf8");
  const core = readFileSync(`${root}/navimower-map-card-core.js`, "utf8");
  const archive = readFileSync(`${root}/navimower-map-card-v030.js`, "utf8");
  const outlines = readFileSync(`${root}/navimower-map-card-v031.js`, "utf8");
  const zoneMarkers = readFileSync(`${root}/navimower-map-card-v032.js`, "utf8");
  const gridDefaults = readFileSync(`${root}/navimower-map-card-v033.js`, "utf8");
  const editorRefinements = readFileSync(`${root}/navimower-map-card-v034.js`, "utf8");

  assert.match(loader, /NAVIMOWER_MAP_CARD_VERSION = "0\.3\.0-beta6"/);
  assert.match(loader, /navimower-map-card-core\.js/);
  assert.match(loader, /navimower-map-card-v030\.js/);
  assert.match(loader, /navimower-map-card-v031\.js/);
  assert.match(loader, /navimower-map-card-v032\.js/);
  assert.match(loader, /navimower-map-card-v033\.js/);
  assert.match(loader, /navimower-map-card-v034\.js/);
  assert.match(core, /type: "color"/);
  assert.match(core, /data-schedule-action="save-all"/);
  assert.match(archive, /session-render/);
  assert.match(archive, /fill-rule="evenodd"/);
  assert.match(outlines, /non-scaling-stroke/);
  assert.match(zoneMarkers, /zone_marker_scale/);
  assert.match(gridDefaults, /columns: "full"/);
  assert.match(editorRefinements, /NAVIMOWER_MAP_CARD_V034_VERSION = "0\.3\.0-beta6"/);
  assert.match(editorRefinements, /normalizeHexColor/);
  assert.match(editorRefinements, /navimower_hex/);
  assert.match(editorRefinements, /SCHEDULE_CLOSE_DELAY_MS = 2500/);
  assert.doesNotMatch(editorRefinements, /Object\.assign\(config/);
}
console.log("0.3.0-beta6 feature checks passed");
