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

  assert.match(loader, /NAVIMOWER_MAP_CARD_VERSION = "0\.3\.0-beta5"/);
  assert.match(loader, /navimower-map-card-core\.js/);
  assert.match(loader, /navimower-map-card-v030\.js/);
  assert.match(loader, /navimower-map-card-v031\.js/);
  assert.match(loader, /navimower-map-card-v032\.js/);
  assert.match(loader, /navimower-map-card-v033\.js/);
  assert.match(loader, /navimower-map-card-v034\.js/);

  // The stable core keeps all previously tested controls and visual-editor work.
  assert.match(core, /type: "color"/);
  assert.match(core, /const zoom = Math\.max\(1, finiteNumber\(this\._view\?\.scale, 1\)\)/);
  assert.match(core, /data-schedule-action="save-all"/);
  assert.match(core, /_saveAllScheduleChanges\(\)/);
  assert.doesNotMatch(core, /data-schedule-action="save-day"/);

  assert.match(archive, /session-render/);
  assert.match(archive, /fill-rule="evenodd"/);
  assert.match(archive, /include_sessions=0&include_daily_trails=0/);
  assert.match(archive, /this\._scheduleDialogOpen = false/);
  assert.match(archive, /max-width: 100% !important/);
  assert.match(archive, /vector-effect/);

  assert.match(outlines, /zone_stroke_width/);
  assert.match(outlines, /off_limit_stroke_width/);
  assert.match(outlines, /vf_off_stroke_width/);
  assert.match(outlines, /channel_stroke_width/);
  assert.match(outlines, /gate_area_stroke_width/);
  assert.match(outlines, /dock_stroke_width/);
  assert.match(outlines, /non-scaling-stroke/);

  assert.match(zoneMarkers, /zone_marker_scale/);
  assert.match(zoneMarkers, /nm-zone-marker-body/);
  assert.match(zoneMarkers, /fixed-size adjustable zone markers/);
  assert.match(zoneMarkers, /leaderEndpoint/);

  assert.match(gridDefaults, /columns: "full"/);
  assert.match(gridDefaults, /automatic-height full-width grid defaults/);

  assert.match(editorRefinements, /normalizeHexColor/);
  assert.match(editorRefinements, /_hex/);
  assert.match(editorRefinements, /SCHEDULE_CLOSE_DELAY_MS = 2500/);
  assert.match(editorRefinements, /delayedScheduleDialogClose/);
  assert.doesNotMatch(editorRefinements, /concurrenc|semaphore|Promise\.allSettled/i);
}
console.log("0.3.0-beta5 feature checks passed");
