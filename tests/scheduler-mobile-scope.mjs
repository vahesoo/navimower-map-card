import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const registryElements = new Map();
globalThis.HTMLElement = class {};
globalThis.customElements = {
  define(name, constructor) { registryElements.set(name, constructor); },
  get(name) { return registryElements.get(name); },
};
globalThis.window = { customCards: [] };
globalThis.Event = class {
  constructor(type, options = {}) { this.type = type; Object.assign(this, options); }
};

await import("../src/navimower-map-card.js");
const source = await readFile(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");
const Card = customElements.get("navimower-map-card");

for (const needle of [
  "0.3.5-beta3: mobile scheduler scope and interaction fixes",
  "map_payload_frontend_no_managed_schedule",
  'result?.source === "single_global_status"',
  "getBoundingClientRect",
  "lostpointercapture",
  "data-beta3-add-toggle",
  "data-beta3-add-menu",
  "select.style.display = \"none\"",
]) {
  assert.ok(source.includes(needle), `Missing beta3 scheduler contract: ${needle}`);
}

// Frontend metadata is authoritative per mower. If this mower has no managed
// schedule status, another mower's global status must never be borrowed.
const noScheduleCard = new Card();
noScheduleCard._mapPayload = {
  entry_id: "robot-two-entry",
  frontend: {
    device_id: "robot-two-device",
    entities: {
      mower: "lawn_mower.robot_two",
      map_data: "sensor.robot_two_map",
      native_schedule: "switch.robot_two_native_schedule",
      schedule_status: null,
      managed_schedule: null,
      schedule_start: null,
      schedule_end: null,
    },
  },
};
noScheduleCard._hass = {
  states: {
    "lawn_mower.robot_two": { state: "docked", attributes: {} },
    "switch.robot_two_native_schedule": { state: "off", attributes: {} },
    // This belongs to robot one and must not affect robot two.
    "sensor.robot_one_navimower_schedule_status": {
      state: "outside_window",
      attributes: { enabled: true, configured: true },
    },
  },
};
const scopedEmpty = noScheduleCard._beta3ScopedSchedulerIds();
assert.equal(scopedEmpty.authoritative, true);
assert.equal(scopedEmpty.status, null);
assert.equal(scopedEmpty.deviceId, "robot-two-device");
assert.equal(scopedEmpty.nativeSwitch, "switch.robot_two_native_schedule");
assert.equal(scopedEmpty.source, "map_payload_frontend_no_managed_schedule");

// A configured mower still resolves its own scheduler metadata exactly.
const configuredCard = new Card();
configuredCard._mapPayload = {
  entry_id: "robot-one-entry",
  frontend: {
    device_id: "robot-one-device",
    entities: {
      schedule_status: "sensor.robot_one_navimower_schedule_status",
      managed_schedule: "switch.robot_one_navimower_schedule",
      native_schedule: "switch.robot_one_native_schedule",
      schedule_start: "time.robot_one_start",
      schedule_end: "time.robot_one_end",
    },
  },
};
configuredCard._hass = {
  states: {
    "sensor.robot_one_navimower_schedule_status": {
      state: "outside_window",
      attributes: { enabled: true, configured: true },
    },
  },
};
const scoped = configuredCard._beta3ScopedSchedulerIds();
assert.equal(scoped.status, "sensor.robot_one_navimower_schedule_status");
assert.equal(scoped.deviceId, "robot-one-device");
assert.equal(scoped.source, "map_payload_frontend");

// Drag targeting is based only on row geometry, not document.elementFromPoint
// or Shadow DOM retargeting. Moving row index 0 below the next row midpoint
// yields insertion index 1; below all remaining rows yields the end.
const rects = [
  { top: 0, height: 46 },
  { top: 52, height: 46 },
  { top: 104, height: 46 },
];
assert.equal(configuredCard._beta3DragTargetIndex(90, rects, 0), 1);
assert.equal(configuredCard._beta3DragTargetIndex(200, rects, 0), 2);
assert.equal(configuredCard._beta3DragTargetIndex(10, rects, 2), 0);

console.log("Scheduler mobile/scope regression checks passed");
