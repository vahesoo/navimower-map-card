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
  "0.3.4-beta11: responsive managed scheduler editor",
  "SAVE_DEBOUNCE_MS = 750",
  "loadCardHelpers",
  "createRowElement",
  "data-beta11-drag",
  "pointerdown",
  "elementFromPoint",
  "Add zone…",
  "Save order",
  "Saving…",
  "Saved",
  "selected_zone_ids",
]) {
  assert.ok(source.includes(needle), `Missing beta11 scheduler editor contract: ${needle}`);
}

const statusEntity = "sensor.tont_navimower_schedule_status";
const card = new Card();
card._beta10SchedulerEntities = {
  status: statusEntity,
  start: "time.tont_navimower_schedule_start",
  end: "time.tont_navimower_schedule_end",
};
card._beta10ScheduleDeviceId = "nav-device";
card._mapPayload = {
  zones: [
    { id: 36, name: "Yard2" },
    { id: 37, name: "Street2" },
    { id: 38, name: "Garden" },
  ],
};
const calls = [];
card._hass = {
  states: {
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

assert.deepEqual(card._managedScheduleMissingZones(), [{ id: 38, name: "Garden" }]);
assert.deepEqual(card._beta11ScheduleDraft, [36, 37]);
assert.equal(card._beta11ScheduleDirty, false);

// Add Zone only accepts configured zones that are not already represented.
assert.equal(card._managedScheduleAddDraftZone(38), true);
assert.deepEqual(card._beta11ScheduleDraft, [36, 37, 38]);
assert.deepEqual(card._managedScheduleMissingZones(), []);
assert.equal(card._managedScheduleAddDraftZone(38), false);

// Repeating a zone does not make it eligible for Add Zone, because that zone
// is still represented in the draft.
assert.equal(card._managedScheduleRepeatDraft(0), true);
assert.deepEqual(card._beta11ScheduleDraft, [36, 36, 37, 38]);
assert.deepEqual(card._managedScheduleMissingZones(), []);

// A zone returns to Add Zone only after its final occurrence is removed.
assert.equal(card._managedScheduleRemoveDraft(0), true);
assert.deepEqual(card._beta11ScheduleDraft, [36, 37, 38]);
assert.deepEqual(card._managedScheduleMissingZones(), []);
assert.equal(card._managedScheduleRemoveDraft(0), true);
assert.deepEqual(card._beta11ScheduleDraft, [37, 38]);
assert.deepEqual(card._managedScheduleMissingZones(), [{ id: 36, name: "Yard2" }]);

// Drag/drop reorder mutates only the local draft until Save is pressed.
assert.equal(card._managedScheduleMoveDraft(1, 0), true);
assert.deepEqual(card._beta11ScheduleDraft, [38, 37]);
assert.equal(calls.length, 0);
assert.equal(card._beta11ScheduleDirty, true);

// The final remaining queue row cannot be removed; the integration also
// rejects an empty custom queue.
assert.equal(card._managedScheduleRemoveDraft(1), true);
assert.deepEqual(card._beta11ScheduleDraft, [38]);
assert.equal(card._managedScheduleRemoveDraft(0), false);
assert.deepEqual(card._beta11ScheduleDraft, [38]);

// Save is one debounced backend write for the complete draft, scoped to the
// scheduler device. Replace timers so the regression stays fast and deterministic.
const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;
globalThis.setTimeout = (fn) => { fn(); return 1; };
globalThis.clearTimeout = () => {};
try {
  assert.equal(await card._managedScheduleSaveDraft(), true);
} finally {
  globalThis.setTimeout = originalSetTimeout;
  globalThis.clearTimeout = originalClearTimeout;
}
assert.equal(calls.length, 1);
assert.deepEqual(calls[0], {
  domain: "navimower",
  service: "set_schedule_queue",
  data: { zones: [38], device_id: "nav-device" },
});
assert.equal(card._beta11ScheduleDirty, false);
assert.deepEqual(card._beta11ScheduleServerQueue, [38]);

console.log("Responsive scheduler editor regression checks passed");
