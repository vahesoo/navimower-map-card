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
  "0.3.5-beta2: lazy persistent scheduler runtime",
  "REGISTRY_FALLBACK_DELAY_MS = 250",
  "map_payload_frontend",
  "data-beta2-root",
  "data-beta2-add-select",
  "pointerdown",
  "setPointerCapture",
  "targetRow.after(moving)",
  "targetRow.before(moving)",
  "createRowElement({ entity: entityId, name: label })",
  "Save order",
]) {
  assert.ok(source.includes(needle), `Missing beta2 scheduler performance contract: ${needle}`);
}

const statusEntity = "sensor.renamed_schedule_status";
const card = new Card();
card._mapPayload = {
  entry_id: "nav-entry",
  frontend: {
    device_id: "nav-device",
    entities: {
      mower: "lawn_mower.renamed_mower",
      map_data: "sensor.renamed_map",
      position_x: "sensor.renamed_x",
      position_y: "sensor.renamed_y",
      heading: "sensor.renamed_heading",
      battery: "sensor.renamed_battery",
      current_physical_zone: "sensor.renamed_zone",
      native_schedule_data: "sensor.renamed_native_schedule",
      schedule_status: statusEntity,
      managed_schedule: "switch.renamed_managed_schedule",
      native_schedule: "switch.renamed_native_schedule",
      schedule_start: "time.renamed_schedule_start",
      schedule_end: "time.renamed_schedule_end",
    },
  },
  zones: [
    { id: 36, name: "Yard2" },
    { id: 37, name: "Street2" },
    { id: 38, name: "Garden" },
  ],
};
const calls = [];
card._hass = {
  states: {
    "lawn_mower.renamed_mower": { state: "docked", attributes: {} },
    "sensor.renamed_map": { state: "loaded", attributes: {} },
    "sensor.renamed_x": { state: "0", attributes: {} },
    "sensor.renamed_y": { state: "0", attributes: {} },
    "sensor.renamed_heading": { state: "0", attributes: {} },
    "sensor.renamed_battery": { state: "100", attributes: {} },
    "sensor.renamed_zone": { state: "Dock", attributes: {} },
    "sensor.renamed_native_schedule": { state: "Off", attributes: {} },
    [statusEntity]: {
      state: "outside_window",
      attributes: {
        enabled: true,
        configured: true,
        order_mode: "custom",
        custom_queue: [36, 37],
        selected_zone_ids: [36, 37, 38],
        queue: [
          { slot: 0, id: 36, name: "Yard2", status: "upcoming" },
          { slot: 1, id: 37, name: "Street2", status: "upcoming" },
        ],
      },
    },
  },
  callService: async (domain, service, data) => calls.push({ domain, service, data }),
};

assert.equal(card._beta2ApplyFrontendEntities(), true);
assert.equal(card._deviceId, "nav-device");
assert.equal(card._resolved.map_entity, "sensor.renamed_map");
assert.equal(card._resolved.battery_entity, "sensor.renamed_battery");
assert.equal(card._resolved.zone_entity, "sensor.renamed_zone");

const ids = card._beta2SchedulerIdsFromPayload();
assert.equal(ids.status, statusEntity);
assert.equal(ids.deviceId, "nav-device");
assert.equal(ids.start, "time.renamed_schedule_start");
assert.equal(ids.end, "time.renamed_schedule_end");
assert.equal(ids.source, "map_payload_frontend");

assert.deepEqual(card._beta2ScheduleMissingZones(), [{ id: 38, name: "Garden" }]);
assert.deepEqual(card._beta2ScheduleDraft, [36, 37]);
assert.equal(card._beta2ScheduleDirty, false);

// Save stays a single scoped backend write; no registry websocket lookup is
// necessary when beta44 frontend metadata is available.
card._beta2ScheduleDraft = [37, 36];
card._beta2ScheduleServerQueue = [36, 37];
card._beta2ScheduleDirty = true;
card._beta2SchedulerIds = ids;
const originalSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn) => { fn(); return 1; };
try {
  assert.equal(await card._beta2ScheduleSaveDraft(), true);
} finally {
  globalThis.setTimeout = originalSetTimeout;
}
assert.deepEqual(calls, [{
  domain: "navimower",
  service: "set_schedule_queue",
  data: { zones: [37, 36], device_id: "nav-device" },
}]);

console.log("Scheduler performance regression checks passed");
