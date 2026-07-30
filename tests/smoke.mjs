import assert from "node:assert/strict";

const registry = new Map();
globalThis.HTMLElement = class {};
globalThis.customElements = {
  define(name, constructor) { registry.set(name, constructor); },
  get(name) { return registry.get(name); },
};
globalThis.window = { customCards: [] };
globalThis.Event = class {
  constructor(type, options = {}) {
    this.type = type;
    Object.assign(this, options);
  }
};

await import("../src/navimower-map-card.js");
const sourceText = await (await import("node:fs/promises")).readFile(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");
assert.ok(sourceText.includes('const NAVIMOWER_MAP_CARD_VERSION = "0.1.11";'));
assert.ok(sourceText.includes("nm-session-route-pulse 550ms ease-in-out 3"));
assert.ok(sourceText.includes("}, 1700);"));
assert.ok(sourceText.includes("<span>Schedule</span>"));
assert.ok(sourceText.includes(".nm-schedule-button.active { color: #FF5A00; }"));
const Card = customElements.get("navimower-map-card");
assert.equal(typeof Card, "function");
assert.equal(window.customCards.length, 1);
assert.equal(window.customCards[0].type, "navimower-map-card");
assert.deepEqual(window.customCards[0].getEntitySuggestion({}, "sensor.temperature"), null);
assert.equal(
  window.customCards[0].getEntitySuggestion({}, "lawn_mower.tont").config.entity,
  "lawn_mower.tont",
);

const stub = Card.getStubConfig();
assert.equal(stub.auto_entities, true);
assert.equal(stub.initial_focus, "map");
assert.equal(stub.zone_label_opacity, 1);
assert.equal(stub.trail_opacity, 0.55);
assert.equal(stub.history_trail_min_opacity, undefined);
assert.equal(stub.history_trail_max_opacity, undefined);

const form = Card.getConfigForm();
assert.ok(Array.isArray(form.schema));
assert.ok(form.schema.length >= 5);
assert.ok(JSON.stringify(form.schema).includes("zone_label_opacity"));
assert.ok(JSON.stringify(form.schema).includes("trail_opacity"));
assert.ok(!JSON.stringify(form.schema).includes("history_trail_min_opacity"));
assert.ok(!JSON.stringify(form.schema).includes("history_trail_max_opacity"));
assert.ok(JSON.stringify(form.schema).includes("map_background_color"));
assert.ok(!JSON.stringify(form.schema).includes("doodle_opacity"));
assert.ok(JSON.stringify(form.schema).includes("schedule_entity"));

const card = new Card();
card._config = { auto_entities: true };
card._hass = {
  states: {
    "sensor.tont_map_data": { state: "loaded" },
    "sensor.tont_position_x": { state: "1" },
    "sensor.tont_position_y": { state: "2" },
    "sensor.tont_heading": { state: "3" },
    "sensor.tont_battery": { state: "80" },
    "sensor.tont_current_physical_zone": { state: "Back yard" },
    "sensor.tont_schedule": { state: "Monday", attributes: { days: [], zones: [] } },
  },
};
const resolved = card._resolveEntitiesByName({ mower_entity: "lawn_mower.tont" });
assert.equal(resolved.map_entity, "sensor.tont_map_data");
assert.equal(resolved.zone_entity, "sensor.tont_current_physical_zone");
assert.equal(resolved.schedule_entity, "sensor.tont_schedule");
assert.deepEqual(card._normalizePoints([[1, 2], ["3", "4"], ["bad", 5]]), [[1, 2], [3, 4]]);
assert.deepEqual(card._normalizeTrailSegments([[[1, 2], [3, 4]], [[5, 6], [7, 8]]]), [
  [[1, 2], [3, 4]],
  [[5, 6], [7, 8]],
]);

card._config = {
  session_count: 6,
  trail_color: "#43a047",
  trail_opacity: 0.55,
  map_background_color: "#ededed",
  obstacle_color: "#FF5A00",
  no_mow_color: "#FF5A00",
  channel_color: "#8e24aa",
  tunnel_color: "#039be5",
  map_legend_opacity: 0.58,
  mower_scale: 1,
  dock_scale: 1,
  dock_color: "#37474f",
  zone_label_font_size: 20,
  zone_label_opacity: 0.55,
  zone_fill_color: "#81c784",
  zone_fill_opacity: 0.22,
  zone_stroke_color: "#43a047",
  show_zone_labels: true,
  show_gate_areas: true,
  show_channels: true,
  show_map_legend: true,
  show_session_legend: true,
};
card._resolved = { map_entity: "sensor.tont_map_data" };
card._layout = {
  scale: 10,
  zones: [{
    id: 13,
    name: "Zone 5",
    polygon: [[0, 0], [10, 0], [10, 10], [0, 10]],
    boundary_flags: [2, 0, 2, 0],
    boundary: { height_set: 256 },
  }],
  offLimits: [[[2, 2], [3, 2], [3, 3]]],
  vfOff: [[[4, 4], [5, 4], [5, 5]]],
  channels: [{ points: [[0, 5], [10, 5]] }],
  gateAreas: [{ name: "Gate", x_min: 1, x_max: 2, y_min: 1, y_max: 2 }],
  station: { x: 1, y: 1 },
  sx: (value) => value * 10,
  sy: (value) => 100 - value * 10,
};
card._mapPayload = {
  cut_height: 30,
  coverage: { zones: [{ id: 13, pct: 72 }] },
  zone_details: [{
    id: 13,
    last_mowed_at: "2026-07-29T12:54:00+03:00",
    last_completed_at: "2026-07-28T18:16:00+03:00",
  }],
  sessions: [{
    id: "session-1",
    started_at: "2026-07-29T12:00:00+03:00",
    ended_at: "2026-07-29T13:00:00+03:00",
    points: [[0, 0], [1, 1], [2, 2], [3, 3]],
    segments: [[[0, 0], [1, 1]], [[2, 2], [3, 3]]],
  }],
};
card._baseEl = { innerHTML: "" };
card._detailsEl = { innerHTML: "" };
card._labelsEl = { innerHTML: "" };
card._uiEl = { innerHTML: "" };
card._selectedZoneId = null;
card._renderStatic();
assert.ok(card._baseEl.innerHTML.includes("81c784"));
assert.ok(card._baseEl.innerHTML.includes("ededed"));
assert.ok(!card._baseEl.innerHTML.includes("Obstacle"));
assert.ok(card._detailsEl.innerHTML.includes("nm-dock-marker"));
assert.ok(card._detailsEl.innerHTML.includes("stroke-dasharray"));
assert.ok(card._labelsEl.innerHTML.includes("Zone 5 · 72%"));
assert.ok(card._labelsEl.innerHTML.includes('opacity="0.55"'));
assert.ok(card._labelsEl.innerHTML.includes("Gate"));
assert.ok(card._uiEl.innerHTML.includes("Mowed"));
assert.ok(card._uiEl.innerHTML.includes("Off-limit"));
assert.ok(card._uiEl.innerHTML.includes("VF-off"));

const zoneDetails = card._zoneDetails(13);
assert.equal(zoneDetails.name, "Zone 5");
assert.equal(zoneDetails.progress, 72);
assert.equal(zoneDetails.cuttingHeight, 30);
assert.equal(zoneDetails.inheritedHeight, true);

let mowedOpacity = null;
card._mowedAreaEl = { setAttribute: (name, value) => { if (name === "opacity") mowedOpacity = value; } };
card._syncMowedAreaStyle();
assert.equal(mowedOpacity, "0.55");

card._historyEl = { innerHTML: "" };
card._renderHistory();
assert.ok(card._historyEl.innerHTML.includes("nm-session-path"));
assert.equal((card._historyEl.innerHTML.match(/<polyline/g) || []).length, 2);
assert.ok(!card._historyEl.innerHTML.includes("opacity="));

card._mapPayload.trail_segments = [[[0, 0], [1, 1]], [[2, 2], [3, 3]]];
card._trail = [[0, 0], [1, 1], [2, 2], [3, 3]];
card._trailSession = 2;
card._trailEl = { innerHTML: "" };
card._renderTrail();
assert.ok(card._trailEl.innerHTML.includes("nm-session-path"));
assert.equal((card._trailEl.innerHTML.match(/<polyline/g) || []).length, 2);
assert.ok(!card._trailEl.innerHTML.includes("opacity="));

card._sessionsEl = { innerHTML: "", style: {} };
card._renderSessions();
assert.ok(card._sessionsEl.innerHTML.includes("opacity:0.55"));

card._highlightEl = { innerHTML: "" };
card._sessionsEl = { querySelectorAll: () => [] };
card._pulseSessionPath("session-1");
assert.ok(card._highlightEl.innerHTML.includes("nm-session-highlight"));
assert.equal((card._highlightEl.innerHTML.match(/<polyline/g) || []).length, 2);
clearTimeout(card._pulseTimer);
card._pulseTimer = null;

const legend = card._legend(false, false);
assert.ok(legend.includes("Mowed"));
assert.ok(!legend.includes(">Mower<"));
assert.ok(!legend.includes(">Dock<"));
assert.ok(card._mower(100, 100, 0).includes("nm-h2-mower"));
assert.ok(card._station(100, 100).includes("nm-dock-marker"));

card._hass = { locale: { language: "en-US", time_format: "24" } };
assert.equal(card._hour12Preference(), false);
const formatted = card._formatSessionTime(new Date("2026-07-30T13:05:00Z"), new Date("2026-07-30T14:10:00Z"), false, new Date("2026-07-30T15:00:00Z"));
assert.ok(!formatted.toLowerCase().includes("pm"));
console.log("Navimower Map Card smoke tests passed");

const mowCard = new Card();
mowCard._config = { entity: "lawn_mower.tont" };
mowCard._resolved = { mower_entity: "lawn_mower.tont" };
mowCard._mapPayload = { zones: [{ id: 13, name: "Street" }, { id: 24, name: "Yard" }] };
mowCard._hass = {
  states: { "lawn_mower.tont": { state: "docked", attributes: {} } },
  entities: { "lawn_mower.tont": { device_id: "device-1" } },
};
assert.deepEqual(mowCard._availableMowZones(), [{ id: 13, name: "Street" }, { id: 24, name: "Yard" }]);
assert.equal(mowCard._isPausedJob(), false);
mowCard._hass.states["lawn_mower.tont"] = { state: "paused", attributes: {} };
assert.equal(mowCard._isPausedJob(), true);
assert.equal(mowCard._mowerDeviceId(), "device-1");


const scheduleCard = new Card();
const scheduleCalls = [];
const scheduleDays = [{
  day: 2,
  weekday: "Monday",
  enabled: true,
  periods: [{ start_hhmm: "08:00", end_hhmm: "10:00", zone_ids: [13] }],
}];
scheduleCard._config = { entity: "lawn_mower.tont", auto_entities: true };
scheduleCard._resolved = { mower_entity: "lawn_mower.tont", schedule_entity: "sensor.tont_schedule" };
scheduleCard._hass = {
  states: {
    "lawn_mower.tont": { state: "docked", attributes: {} },
    "sensor.tont_schedule": {
      state: "Monday",
      attributes: { days: scheduleDays, zones: [{ id: 13, name: "Street" }, { id: 24, name: "Yard" }] },
    },
  },
  entities: { "lawn_mower.tont": { device_id: "device-1" } },
  callService: async (domain, service, data) => scheduleCalls.push({ domain, service, data }),
};
assert.equal(scheduleCard._scheduleEnabled(), true);
scheduleCard._hass.states["sensor.tont_schedule"] = {
  state: "Off",
  attributes: { days: scheduleDays.map((day) => ({ ...day, enabled: false })), zones: [] },
};
assert.equal(scheduleCard._scheduleEnabled(), false);
scheduleCard._hass.states["sensor.tont_schedule"] = {
  state: "Monday",
  attributes: { days: scheduleDays, zones: [{ id: 13, name: "Street" }, { id: 24, name: "Yard" }] },
};
scheduleCard._syncScheduleDraft(true);
assert.equal(scheduleCard._scheduleDraft.length, 7);
assert.equal(scheduleCard._scheduleDraft[0].key, "monday");
assert.equal(scheduleCard._scheduleDraft[0].periods[0].start, "08:00");
assert.deepEqual(scheduleCard._scheduleZones, [{ id: 13, name: "Street" }, { id: 24, name: "Yard" }]);
assert.equal(scheduleCard._scheduleSnap15("09:08"), "09:15");
assert.equal(scheduleCard._scheduleEndMin("00:00"), 1440);
scheduleCard._scheduleDraft[0]._dirty = true;
scheduleCard._scheduleDraft[0]._rev = 1;
await scheduleCard._saveScheduleDay(0);
assert.equal(scheduleCalls.length, 1);
assert.equal(scheduleCalls[0].domain, "navimower");
assert.equal(scheduleCalls[0].service, "set_schedule");
assert.deepEqual(scheduleCalls[0].data, {
  day: "monday",
  enabled: true,
  periods: [{ start: "08:00", end: "10:00", zones: [13] }],
  device_id: "device-1",
});
for (const timer of Object.values(scheduleCard._scheduleStatusTimers)) clearTimeout(timer);
scheduleCard._scheduleStatusTimers = {};

const registryCard = new Card();
registryCard._config = { auto_entities: true, status_entity: null, schedule_entity: null };
registryCard._resolved = {};
registryCard._resolutionKey = "registry-test";
registryCard._hass = {
  callWS: async () => [
    { entity_id: "lawn_mower.tont", device_id: "device-1", unique_id: "tont_mower" },
    { entity_id: "calendar.tont_schedule", device_id: "device-1", unique_id: "tont_schedule" },
    { entity_id: "sensor.tont_schedule", device_id: "device-1", unique_id: "tont_schedule" },
  ],
};
registryCard._maybeLoadMap = () => {};
registryCard._updateLive = () => {};
await registryCard._resolveEntitiesFromRegistry("lawn_mower.tont", "registry-test");
assert.equal(registryCard._resolved.schedule_entity, "sensor.tont_schedule");
