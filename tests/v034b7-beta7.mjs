import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  NAVIMOWER_MAP_CARD_V034B7_VERSION,
  SCHEDULE_CLOSE_DELAY_MS,
  scheduleSaveSucceeded,
} from "../src/navimower-map-card-v034b7.js";

assert.equal(NAVIMOWER_MAP_CARD_V034B7_VERSION, "0.3.0-beta7");
assert.equal(SCHEDULE_CLOSE_DELAY_MS, 2500);
assert.equal(scheduleSaveSucceeded({
  _scheduleDraft: [{ _dirty: false, _saving: false }],
  _scheduleStatus: { mon: { kind: "saved" } },
}), true);
assert.equal(scheduleSaveSucceeded({
  _scheduleDraft: [{ _dirty: true, _saving: false }],
  _scheduleStatus: {},
}), false);

for (const root of ["src", "dist"]) {
  const loader = readFileSync(`${root}/navimower-map-card.js`, "utf8");
  const layer = readFileSync(`${root}/navimower-map-card-v034b7.js`, "utf8");
  assert.match(loader, /NAVIMOWER_MAP_CARD_VERSION = "0\.3\.0-beta7"/);
  assert.match(loader, /navimower-map-card-v034b7\.js/);
  assert.doesNotMatch(loader, /navimower-map-card-v034\.js/);
  assert.doesNotMatch(layer, /normalizeHexColor|normalizeColorEditorConfig|navimower_hex|Object\.assign\(config/);
  assert.doesNotMatch(layer, /getConfigForm|getStubConfig|proto\.setConfig/);
  assert.match(layer, /delayedScheduleDialogClose/);
}

console.log("0.3.0-beta7 cache-safe native-color checks passed");
