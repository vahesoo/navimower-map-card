import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  NAVIMOWER_MAP_CARD_V034S_VERSION,
  SCHEDULE_CLOSE_DELAY_MS,
  scheduleSaveSucceeded,
} from "../src/navimower-map-card-v034s.js";

assert.equal(NAVIMOWER_MAP_CARD_V034S_VERSION, "0.3.0");
assert.equal(SCHEDULE_CLOSE_DELAY_MS, 2500);
assert.equal(scheduleSaveSucceeded({
  _scheduleDraft: [{ _dirty: false, _saving: false }],
  _scheduleStatus: { mon: { kind: "saved" } },
}), true);
assert.equal(scheduleSaveSucceeded({
  _scheduleDraft: [{ _dirty: true, _saving: false }],
  _scheduleStatus: {},
}), false);

const hacs = JSON.parse(readFileSync("hacs.json", "utf8"));
assert.equal(hacs.filename, "navimower-map-card-v030-stable.js");

for (const root of ["src", "dist"]) {
  const loader = readFileSync(`${root}/navimower-map-card.js`, "utf8");
  const hacsLoader = readFileSync(`${root}/navimower-map-card-v030-stable.js`, "utf8");
  const layer = readFileSync(`${root}/navimower-map-card-v034s.js`, "utf8");
  assert.match(loader, /NAVIMOWER_MAP_CARD_VERSION = "0\.3\.0"/);
  assert.match(loader, /navimower-map-card-v034s\.js/);
  assert.match(hacsLoader, /navimower-map-card-v034s\.js/);
  assert.doesNotMatch(loader, /navimower-map-card-v034\.js|navimower-map-card-v034b7\.js/);
  assert.doesNotMatch(hacsLoader, /navimower-map-card-v034\.js|navimower-map-card-v034b7\.js/);
  assert.doesNotMatch(layer, /normalizeHexColor|normalizeColorEditorConfig|navimower_hex|Object\.assign\(config/);
  assert.doesNotMatch(layer, /getConfigForm|getStubConfig|proto\.setConfig/);
  assert.match(layer, /delayedScheduleDialogClose/);
}

console.log("0.3.0 stable cache-isolation checks passed");
