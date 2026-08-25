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

assert.ok(source.includes("0.3.4-beta10: resilient Navimower scheduler discovery"));
assert.equal(typeof Card.prototype._discoverNavimowerSchedulerEntities, "function");

const statusEntity = "sensor.tont_navimower_schedule_status";
const statusState = {
  state: "outside_window",
  attributes: {
    enabled: true,
    configured: true,
    mode: "window",
    order_mode: "custom",
    custom_queue: [36, 37],
    start: "09:00",
    end: "21:00",
    queue: [
      { slot: 0, id: 36, name: "Yard2", status: "upcoming" },
      { slot: 1, id: 37, name: "Street2", status: "upcoming" },
    ],
  },
};

const correctRegistry = [
  {
    entity_id: "lawn_mower.legacy_tont",
    unique_id: "legacy_mower",
    config_entry_id: "legacy-entry",
    device_id: "legacy-device",
  },
  {
    entity_id: "sensor.tont_map_data",
    unique_id: "SN123_map_data",
    config_entry_id: "nav-entry",
    device_id: "nav-device",
  },
  {
    entity_id: statusEntity,
    unique_id: "SN123_navimower_schedule_status",
    config_entry_id: "nav-entry",
    device_id: "nav-device",
  },
  {
    entity_id: "switch.tont_navimower_schedule",
    unique_id: "SN123_navimower_schedule",
    config_entry_id: "nav-entry",
    device_id: "nav-device",
  },
  {
    entity_id: "time.tont_navimower_schedule_start",
    unique_id: "SN123_navimower_schedule_start",
    config_entry_id: "nav-entry",
    device_id: "nav-device",
  },
  {
    entity_id: "time.tont_navimower_schedule_end",
    unique_id: "SN123_navimower_schedule_end",
    config_entry_id: "nav-entry",
    device_id: "nav-device",
  },
  {
    entity_id: "sensor.other_navimower_schedule_status",
    unique_id: "OTHER_navimower_schedule_status",
    config_entry_id: "other-entry",
    device_id: "other-device",
  },
];

const card = new Card();
card._config = { entity: "lawn_mower.legacy_tont", schedule_view_mode: "auto" };
card._resolved = {
  mower_entity: "lawn_mower.legacy_tont",
  map_entity: "sensor.tont_map_data",
};
card._apiPath = () => "/api/navimower/map/nav-entry";
card._mowerEntity = () => "lawn_mower.legacy_tont";
card._renderDialog = () => { card._renderedManagedSchedule = true; };
let wsCalls = 0;
card._hass = {
  states: { [statusEntity]: statusState },
  callWS: async () => { wsCalls += 1; return correctRegistry; },
};

const discovered = await card._discoverNavimowerSchedulerEntities();
assert.equal(discovered.status, statusEntity);
assert.equal(discovered.managedSwitch, "switch.tont_navimower_schedule");
assert.equal(discovered.start, "time.tont_navimower_schedule_start");
assert.equal(discovered.end, "time.tont_navimower_schedule_end");
assert.equal(discovered.deviceId, "nav-device");
assert.equal(discovered.configEntryId, "nav-entry");
assert.equal(discovered.source, "map_api_config_entry");
assert.equal(wsCalls, 1);

// A positive result is cached briefly, but only while its HA state still exists.
const cached = await card._discoverNavimowerSchedulerEntities();
assert.equal(cached.status, statusEntity);
assert.equal(wsCalls, 1);

// The status sensor is authoritative for managed-scheduler enablement. The
// managed switch state is deliberately absent here; Auto must still open the
// Navimower custom-order view from status.attributes.enabled.
await card._openScheduleDialog();
assert.equal(card._beta6ManagedOpen, true);
assert.equal(card._renderedManagedSchedule, true);
assert.equal(card._beta6SchedulerEntities.status, statusEntity);
assert.equal(card._mowerDeviceId(), "nav-device");

// A failed early discovery must never become a permanent negative cache. This
// reproduces the field failure where the scheduler entity appeared after card
// setup/reload and beta6 kept returning an empty object forever.
const retryCard = new Card();
retryCard._config = { entity: "lawn_mower.retry", schedule_view_mode: "navimower" };
retryCard._resolved = {
  mower_entity: "lawn_mower.retry",
  map_entity: "sensor.retry_map_data",
};
retryCard._apiPath = () => "/api/navimower/map/retry-entry";
retryCard._mowerEntity = () => "lawn_mower.retry";
let retryRegistry = [
  {
    entity_id: "lawn_mower.retry",
    unique_id: "RETRY_mower",
    config_entry_id: "retry-entry",
    device_id: "retry-device",
  },
  {
    entity_id: "sensor.retry_map_data",
    unique_id: "RETRY_map_data",
    config_entry_id: "retry-entry",
    device_id: "retry-device",
  },
];
let retryCalls = 0;
retryCard._hass = {
  states: {},
  callWS: async () => { retryCalls += 1; return retryRegistry; },
};

const firstAttempt = await retryCard._discoverNavimowerSchedulerEntities();
assert.equal(firstAttempt.status, null);
assert.equal(retryCard._beta10SchedulerEntities, null);
assert.equal(retryCalls, 1);

retryRegistry = retryRegistry.concat({
  entity_id: "sensor.retry_navimower_schedule_status",
  unique_id: "RETRY_navimower_schedule_status",
  config_entry_id: "retry-entry",
  device_id: "retry-device",
});
retryCard._hass.states["sensor.retry_navimower_schedule_status"] = {
  state: "waiting",
  attributes: { enabled: true, configured: true, order_mode: "custom", custom_queue: [1, 2] },
};

const secondAttempt = await retryCard._discoverNavimowerSchedulerEntities();
assert.equal(secondAttempt.status, "sensor.retry_navimower_schedule_status");
assert.equal(retryCalls, 2);
const thirdAttempt = await retryCard._discoverNavimowerSchedulerEntities();
assert.equal(thirdAttempt.status, "sensor.retry_navimower_schedule_status");
assert.equal(retryCalls, 2);

// If config_entry_id is unavailable, the resolved map device remains a safe
// fallback and must win over an unrelated mower device.
const mapDeviceCard = new Card();
mapDeviceCard._config = { entity: "lawn_mower.old" };
mapDeviceCard._resolved = {
  mower_entity: "lawn_mower.old",
  map_entity: "sensor.new_map_data",
};
mapDeviceCard._apiPath = () => null;
mapDeviceCard._mowerEntity = () => "lawn_mower.old";
mapDeviceCard._hass = {
  states: {
    "sensor.new_navimower_schedule_status": {
      state: "waiting",
      attributes: { enabled: true },
    },
  },
  callWS: async () => [
    { entity_id: "lawn_mower.old", unique_id: "OLD_mower", device_id: "old-device" },
    { entity_id: "sensor.new_map_data", unique_id: "NEW_map_data", device_id: "new-device" },
    { entity_id: "sensor.new_navimower_schedule_status", unique_id: "NEW_navimower_schedule_status", device_id: "new-device" },
  ],
};
const mapDeviceResult = await mapDeviceCard._discoverNavimowerSchedulerEntities();
assert.equal(mapDeviceResult.status, "sensor.new_navimower_schedule_status");
assert.equal(mapDeviceResult.source, "map_device");
assert.equal(mapDeviceResult.deviceId, "new-device");

console.log("Scheduler discovery regression checks passed");
