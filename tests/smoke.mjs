import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const registry = new Map();
globalThis.HTMLElement = class {};
globalThis.customElements = {
  define(name, constructor) { registry.set(name, constructor); },
  get(name) { return registry.get(name); },
};
globalThis.window = { customCards: [] };
globalThis.Event = class {
  constructor(type, options = {}) { this.type = type; Object.assign(this, options); }
};

await import("../src/navimower-map-card.js");
const sourceText = await readFile(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");
const Card = customElements.get("navimower-map-card");

assert.ok(sourceText.includes("NAVIMOWER_MAP_CARD_VERSION"));
assert.equal(typeof Card, "function");
assert.equal(window.customCards.length, 1);
assert.equal(window.customCards[0].type, "navimower-map-card");
assert.equal(window.customCards[0].getEntitySuggestion({}, "lawn_mower.tont").config.entity, "lawn_mower.tont");
assert.equal(window.customCards[0].getEntitySuggestion({}, "sensor.temperature"), null);

const stub = Card.getStubConfig();
assert.equal(stub.auto_entities, true);
assert.equal(stub.initial_focus, "map");
assert.equal(stub.avoid_zone_label_overlap, true);
assert.equal(stub.show_vf_off_areas, true);
const formText = JSON.stringify(Card.getConfigForm());
assert.ok(formText.includes("avoid_zone_label_overlap"));
assert.ok(formText.includes("show_vf_off_areas"));
assert.ok(formText.includes("zone_label_opacity"));
assert.ok(formText.includes("schedule_entity"));
assert.ok(formText.includes("schedule_switch_entity"));

const card = new Card();
card._config = {
  zone_label_font_size: 20,
  zone_label_opacity: 0.8,
  avoid_zone_label_overlap: true,
  show_vf_off_areas: true,
  zone_fill_color: "#81c784",
  zone_fill_opacity: 0.22,
  zone_stroke_color: "#43a047",
  off_limit_color: "#FF5A00",
  vf_off_color: "#2F80ED",
  channel_color: "#686868",
  gate_area_color: "#8e24aa",
  dock_color: "#37474f",
  map_background_color: "#ededed",
  map_legend_opacity: 0.58,
  trail_color: "#43a047",
  trail_opacity: 0.55,
  mower_scale: 1,
  dock_scale: 1,
  show_zone_labels: true,
  show_gate_areas: false,
  show_channels: false,
  show_map_legend: false,
  show_session_legend: false,
};

const sharedPolygon = [[380, 380], [620, 380], [620, 620], [380, 620]];
const crowded = Array.from({ length: 9 }, (_, index) => ({
  anchorX: 500,
  anchorY: 500,
  value: `Zone ${index + 1} · 100%`,
  zoneId: index + 1,
  polygon: sharedPolygon,
  area: 57600,
}));
const arranged = card._layoutZoneLabels(crowded);
assert.equal(arranged.length, 9);
assert.ok(arranged.some((item) => item.moved));
assert.ok(arranged.some((item) => card._zoneLabelLeader(item).includes("nm-zone-label-leader")));
for (let left = 0; left < arranged.length; left += 1) {
  const a = card._labelBox(arranged[left].cx, arranged[left].cy, arranged[left].width, arranged[left].height);
  for (let right = left + 1; right < arranged.length; right += 1) {
    const b = card._labelBox(arranged[right].cx, arranged[right].cy, arranged[right].width, arranged[right].height);
    assert.equal(card._labelOverlapArea(a, b), 0, `Zone labels ${left + 1} and ${right + 1} overlap`);
  }
}

card._layout = {
  scale: 10,
  zones: [
    { id: 1, name: "Front", polygon: [[0, 0], [10, 0], [10, 10], [0, 10]], boundary_flags: [] },
    { id: 2, name: "Back", polygon: [[4, 4], [14, 4], [14, 14], [4, 14]], boundary_flags: [] },
  ],
  offLimits: [],
  vfOff: [],
  channels: [],
  gateAreas: [],
  station: null,
  sx: (value) => 400 + value * 10,
  sy: (value) => 600 - value * 10,
};
card._mapPayload = { coverage: { zones: [{ id: 1, pct: 50 }, { id: 2, pct: 60 }] }, zone_details: [] };
card._baseEl = { innerHTML: "" };
card._detailsEl = { innerHTML: "" };
card._labelsEl = { innerHTML: "" };
card._uiEl = { innerHTML: "" };
card._selectedZoneId = null;
card._renderStatic();
assert.ok(card._labelsEl.innerHTML.includes("Front · 50%"));
assert.ok(card._labelsEl.innerHTML.includes("Back · 60%"));
assert.ok(card._labelsEl.innerHTML.includes("nm-zone-label-leader"));
assert.ok(card._labelsEl.innerHTML.includes('opacity="0.80"'));

// Completed history stubs without a drawable route are hidden, while the active
// session remains visible until its first usable route arrives.
const sessionCard = new Card();
sessionCard._config = { session_count: 6 };
sessionCard._trail = [];
sessionCard._mapPayload = {
  sessions: [
    { id: "stub", started_at: "2026-08-02T08:00:00Z", ended_at: "2026-08-02T08:00:00Z", points: [] },
    { id: "stationary-stub", started_at: "2026-08-02T08:00:01Z", ended_at: "2026-08-02T08:00:01Z", points: [[1, 1], [1, 1]] },
    { id: "real", started_at: "2026-08-02T08:00:02Z", ended_at: "2026-08-02T09:00:00Z", points: [[0, 0], [1, 1]] },
    { id: "active", started_at: "2026-08-02T10:00:00Z", ended_at: null, active: true, points: [] },
  ],
};
const filteredSessions = sessionCard._sessionRecords({ applyLimit: false });
assert.deepEqual(filteredSessions.map((session) => session.id), ["real", "active"]);
assert.equal(filteredSessions.find((session) => session.id === "real").drawable, true);
assert.equal(filteredSessions.find((session) => session.id === "active").drawable, false);

// VF-off rendering and its legend entry can be hidden without changing the map payload.
const vfCard = new Card();
vfCard._config = { ...card._config, show_vf_off_areas: false, show_map_legend: true };
vfCard._mapKey = "vf-hidden";
vfCard._layout = {
  scale: 10,
  zones: [{ id: 1, name: "Yard", polygon: [[0, 0], [10, 0], [10, 10], [0, 10]], boundary_flags: [] }],
  offLimits: [],
  vfOff: [[[2, 2], [8, 2], [8, 8], [2, 8]]],
  channels: [],
  gateAreas: [],
  station: null,
  sx: (value) => 400 + value * 10,
  sy: (value) => 600 - value * 10,
};
vfCard._mapPayload = { coverage: { zones: [] }, zone_details: [] };
vfCard._baseEl = { innerHTML: "" };
vfCard._detailsEl = { innerHTML: "" };
vfCard._labelsEl = { innerHTML: "" };
vfCard._uiEl = { innerHTML: "" };
vfCard._selectedZoneId = null;
vfCard._renderStatic();
assert.ok(!vfCard._detailsEl.innerHTML.includes(vfCard._config.vf_off_color));
assert.ok(!vfCard._uiEl.innerHTML.includes("VF-off"));

// Static geometry is restored from the module cache for a second card instance.
const cachedPayload = {
  trail_session: 7,
  trail_started_at: "2026-08-02T08:00:00Z",
  map: {
    zones: [{ id: 7, name: "Cached", polygon: [[0, 0], [12, 0], [12, 9], [0, 9]], boundary_flags: [] }],
    off_limit_areas: [],
    vf_off_areas: [],
    channels: [],
    station: null,
  },
  gate_areas: [],
  coverage: { zones: [] },
  sessions: [],
};
const makeCacheCard = () => {
  const instance = new Card();
  instance._config = { ...card._config, show_vf_off_areas: true };
  instance._baseEl = { innerHTML: "" };
  instance._detailsEl = { innerHTML: "" };
  instance._labelsEl = { innerHTML: "" };
  instance._uiEl = { innerHTML: "" };
  instance._selectedZoneId = null;
  return instance;
};
const cacheCard1 = makeCacheCard();
cacheCard1._applyMapPayload(cachedPayload, { trail_session: 7 }, "cache-test");
assert.ok(cacheCard1._baseEl.innerHTML.includes("polygon"));
const cacheCard2 = makeCacheCard();
let rebuilt = false;
cacheCard2._buildLayout = () => { rebuilt = true; };
cacheCard2._renderStatic = () => { rebuilt = true; };
cacheCard2._applyMapPayload(cachedPayload, { trail_session: 7 }, "cache-test");
assert.equal(rebuilt, false);
assert.equal(cacheCard2._baseEl.innerHTML, cacheCard1._baseEl.innerHTML);

// Unrelated Home Assistant entity changes no longer schedule any card redraw.
const perfCard = new Card();
perfCard._config = {
  show_position: false,
  show_status: true,
  show_zone: true,
  show_battery: true,
  trail_length: 1000,
};
perfCard._resolved = {
  mower_entity: "lawn_mower.test",
  status_entity: "lawn_mower.test",
  map_entity: "sensor.test_map_data",
  x_entity: "sensor.test_x",
  y_entity: "sensor.test_y",
  heading_entity: "sensor.test_heading",
  battery_entity: "sensor.test_battery",
  zone_entity: "sensor.test_zone",
  schedule_entity: null,
  schedule_switch_entity: null,
};
perfCard._mapPayload = { activity: "docked", current_physical_zone: "Not in zone", trail_active: false };
const baseStates = {
  "lawn_mower.test": { state: "docked", attributes: { activity: "docked" } },
  "sensor.test_map_data": { state: "ready", attributes: { activity: "docked", trail_active: false } },
  "sensor.test_x": { state: "1", attributes: {} },
  "sensor.test_y": { state: "2", attributes: {} },
  "sensor.test_heading": { state: "90", attributes: {} },
  "sensor.test_battery": { state: "80", attributes: {} },
  "sensor.test_zone": { state: "Yard", attributes: {} },
};
let queued = null;
perfCard._queueRender = (flags) => { queued = flags; };
perfCard._hass = { states: { ...baseStates } };
perfCard._updateLive(true);
assert.equal(queued.mower, true);
perfCard._hass = { states: { ...baseStates, "sensor.unrelated": { state: "changed", attributes: {} } } };
perfCard._updateLive(false);
assert.equal(Object.values(queued).some(Boolean), false);
perfCard._hass = { states: { ...baseStates, "sensor.test_battery": { state: "79", attributes: {} } } };
perfCard._updateLive(false);
assert.equal(queued.footer, true);
assert.equal(queued.mower, false);


// Schema-v5 daily trails replace older same-day routes zone by zone, while the
// active cycle stays on the separate live-trail layer.
const dailyCard = new Card();
dailyCard._config = { session_count: 6, trail_color: "#43a047" };
dailyCard._layout = { scale: 10, sx: (value) => value * 10, sy: (value) => value * 10 };
dailyCard._historyDayOffset = null;
dailyCard._historyEl = { innerHTML: "" };
dailyCard._mapStaticSignature = "daily-map";
dailyCard._mapPayload = {
  schema_version: 5,
  daily_trails: {
    date: "2026-08-03",
    revision: 9,
    zones: [
      { zone_id: 1, cycle_id: "new-zone-1", active: false, segments: [[[1, 1], [2, 2]]] },
      { zone_id: 2, cycle_id: "active-zone-2", active: true, segments: [[[3, 3], [4, 4]]] },
    ],
  },
  sessions: [
    { id: "old-zone-1", started_at: new Date().toISOString(), ended_at: new Date().toISOString(), segments: [[[90, 90], [91, 91]]] },
  ],
};
dailyCard._renderHistory();
assert.ok(dailyCard._historyEl.innerHTML.includes("10.0,10.0 20.0,20.0"));
assert.ok(!dailyCard._historyEl.innerHTML.includes("900.0,900.0"));
assert.ok(!dailyCard._historyEl.innerHTML.includes("30.0,30.0 40.0,40.0"));

// A real global schedule switch is authoritative. Without it, configured day
// periods are reported as configured rather than incorrectly claiming On.
const scheduleCard = new Card();
scheduleCard._config = { schedule_entity: "sensor.test_schedule", schedule_switch_entity: "switch.test_schedule_enabled" };
scheduleCard._resolved = { schedule_entity: "sensor.test_schedule", schedule_switch_entity: "switch.test_schedule_enabled" };
scheduleCard._hass = { states: {
  "sensor.test_schedule": { state: "Mon", attributes: { days: [{ enabled: true, periods: [{ start_min: 60, end_min: 120 }] }] } },
  "switch.test_schedule_enabled": { state: "off", attributes: {} },
} };
assert.equal(scheduleCard._scheduleEnabled(), false);
assert.equal(scheduleCard._scheduleStatusText(), "Off");
delete scheduleCard._hass.states["switch.test_schedule_enabled"];
assert.equal(scheduleCard._scheduleEnabled(), null);
assert.equal(scheduleCard._scheduleStatusText(), "Configured");


// An active backend session continues collecting live positions while the mower
// returns to the dock, matching the integration's include_return_trail option.
const returnCard = new Card();
returnCard._config = { show_position: false, show_status: true, show_zone: true, show_battery: true, trail_length: 1000 };
returnCard._resolved = {
  mower_entity: "lawn_mower.return_test",
  status_entity: "lawn_mower.return_test",
  map_entity: "sensor.return_map",
  x_entity: "sensor.return_x",
  y_entity: "sensor.return_y",
  heading_entity: "sensor.return_heading",
  battery_entity: "sensor.return_battery",
  zone_entity: "sensor.return_zone",
  schedule_entity: null,
  schedule_switch_entity: null,
};
returnCard._mapPayload = { active_session: { id: "session-1" }, trail_active: false, include_return_trail: true };
returnCard._hass = { states: {
  "lawn_mower.return_test": { state: "returning", attributes: { activity: "returning" } },
  "sensor.return_map": { state: "ready", attributes: { activity: "returning", trail_active: false, active_session_id: "session-1", include_return_trail: true } },
  "sensor.return_x": { state: "4", attributes: {} },
  "sensor.return_y": { state: "5", attributes: {} },
  "sensor.return_heading": { state: "180", attributes: {} },
  "sensor.return_battery": { state: "50", attributes: {} },
  "sensor.return_zone": { state: "Yard", attributes: {} },
} };
returnCard._queueRender = () => {};
returnCard._updateLive(true);
assert.deepEqual(returnCard._trail, [[4, 5]]);
returnCard._hass.states["sensor.return_x"] = { state: "4.5", attributes: {} };
returnCard._updateLive(false);
assert.deepEqual(returnCard._trail, [[4, 5], [4.5, 5]]);
returnCard._hass.states["sensor.return_map"].attributes.include_return_trail = false;
returnCard._hass.states["sensor.return_x"] = { state: "5", attributes: {} };
returnCard._updateLive(false);
assert.deepEqual(returnCard._trail, [[4, 5], [4.5, 5]]);

assert.ok(sourceText.includes("LATEST_MAP_PAYLOAD_CACHE"));
assert.ok(sourceText.includes("daily_trails_revision"));
assert.ok(sourceText.includes("recordTrail"));
assert.ok(sourceText.includes("MAP_PAYLOAD_CACHE"));
assert.ok(sourceText.includes("STATIC_MAP_CACHE"));
assert.ok(sourceText.includes("CARD_TEMPLATE"));
assert.ok(sourceText.includes("MOWER_TEMPLATE"));
assert.ok(sourceText.includes('document.createElementNS("http://www.w3.org/2000/svg", "g")'));
assert.ok(!sourceText.includes('MOWER_TEMPLATE = document.createElement("template")'));
assert.ok(sourceText.includes("this._mowerGroup = MOWER_TEMPLATE.cloneNode(true)"));

console.log("Navimower Map Card smoke tests passed");
