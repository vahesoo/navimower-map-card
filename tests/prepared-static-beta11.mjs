import assert from "node:assert/strict";

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
const Card = customElements.get("navimower-map-card");
assert.equal(typeof Card, "function");

const fakeLayer = () => ({
  innerHTML: "",
  style: {},
  querySelectorAll() { return []; },
  querySelector() { return null; },
});

const baseConfig = {
  zone_label_font_size: 20,
  zone_label_opacity: 0.8,
  avoid_zone_label_overlap: true,
  show_vf_off_areas: true,
  show_custom_areas: false,
  zone_fill_color: "#81c784",
  zone_fill_opacity: 0.22,
  zone_stroke_color: "#43a047",
  zone_stroke_width: 2.5,
  off_limit_color: "#FF5A00",
  off_limit_stroke_width: 5,
  vf_off_color: "#2F80ED",
  vf_off_stroke_width: 5,
  channel_color: "#686868",
  channel_stroke_width: 5,
  gate_area_color: "#8e24aa",
  gate_area_stroke_width: 3,
  dock_color: "#37474f",
  dock_stroke_width: 3,
  map_background_color: "#ededed",
  map_legend_opacity: 0.58,
  map_legend_scale: 1,
  trail_color: "#43a047",
  trail_opacity: 0.55,
  mower_scale: 1,
  dock_scale: 1,
  show_zone_labels: false,
  show_gate_areas: true,
  show_channels: true,
  show_map_legend: false,
  show_session_legend: false,
};

const mapPayload = (revision = "map-r1", prepared = true) => ({
  trail_session: 1,
  map: {
    revision,
    zones: [{
      id: 36,
      name: "Yard",
      polygon: [[0, 0], [10, 0], [10, 10], [0, 10]],
      boundary_flags: [2, 0, 2, 0],
    }],
    off_limit_areas: [[[2, 2], [3, 2], [3, 3], [2, 3]]],
    vf_off_areas: [[[5, 5], [6, 5], [6, 6], [5, 6]]],
    channels: [{ id: 1, name: "Channel", points: [[0, 5], [10, 5]] }],
    station: { x: 1, y: -1 },
  },
  gate_areas: [{
    id: "gate",
    name: "Gate",
    polygon: [[8, 0], [9, 0], [9, 2], [8, 2]],
  }],
  custom_areas: [],
  coverage: { zones: [{ id: 36, pct: 42 }] },
  zone_details: [{ id: 36, progress: 42 }],
  ...(prepared ? {
    prepared_render_model: {
      schema_version: 1,
      scope: "prepared_map_render_model",
      coordinate_space: "map_xy_m",
      manifest_url: "/api/navimower/map/entry?render_model_manifest=1",
      ready_only: true,
    },
  } : {}),
});

const staticModel = {
  schema_version: 1,
  scope: "static_map_render_model",
  coordinate_space: "map_xy_m",
  map_revision: "map-r1",
  map_version: 1,
  layout: {
    without_gate_areas: {
      scale: 20,
      matrix: [20, 0, 0, -20, 300, 600],
    },
    with_gate_areas: {
      scale: 25,
      matrix: [25, 0, 0, -25, 250, 650],
    },
  },
  layers: {
    zones: [{
      id: 36,
      name: "Yard",
      area_m2: 100,
      path_d: "M0 0L10 0L10 10L0 10Z",
      bounds: [0, 0, 10, 10],
      centroid: [5, 5],
      point_count: 4,
    }],
    off_limit_areas: [{
      id: 0,
      path_d: "M2 2L3 2L3 3L2 3Z",
      bounds: [2, 2, 3, 3],
      centroid: [2.5, 2.5],
      point_count: 4,
    }],
    vf_off_areas: [{
      id: 0,
      path_d: "M5 5L6 5L6 6L5 6Z",
      bounds: [5, 5, 6, 6],
      centroid: [5.5, 5.5],
      point_count: 4,
    }],
    channels: [{
      id: 1,
      name: "Channel",
      path_d: "M0 5L10 5",
      bounds: [0, 5, 10, 5],
      point_count: 2,
    }],
    gate_areas: [{
      id: "gate",
      name: "Gate",
      path_d: "M8 0L9 0L9 2L8 2Z",
      bounds: [8, 0, 9, 2],
      centroid: [8.5, 1],
      point_count: 4,
    }],
    custom_areas: [],
  },
  station: { x: 1, y: -1 },
  geometry_summary: {
    zones: 1,
    off_limit_areas: 1,
    vf_off_areas: 1,
    channels: 1,
    gate_areas: 1,
    custom_areas: 0,
    source_point_count: 18,
    prepared_point_count: 18,
    invalid_geometry_count: 0,
    parity_ok: true,
  },
};

const resourceId = "a".repeat(64);
const manifest = {
  schema_version: 1,
  scope: "prepared_map_render_model",
  entry_id: "entry",
  coordinate_space: "map_xy_m",
  building: { static: false, live_route: false },
  publication_revision: { static: 1, live_route: 1 },
  static: {
    resource_id: resourceId,
    format: "json",
    scope: "static_render_model",
    coordinate_space: "map_xy_m",
    byte_length: JSON.stringify(staticModel).length,
    url: "/api/navimower/map/entry?static_render_model=" + resourceId,
  },
};

const calls = [];
const hass = {
  states: {},
  async callApi(method, path) {
    calls.push([method, path]);
    if (path.includes("render_model_manifest=1")) return manifest;
    if (path.includes("static_render_model=")) return staticModel;
    throw new Error("unexpected API call " + path);
  },
};

const makeCard = () => {
  const card = new Card();
  card._config = { ...baseConfig };
  card._hass = hass;
  card._resolved = {};
  card._baseEl = fakeLayer();
  card._detailsEl = fakeLayer();
  card._labelsEl = fakeLayer();
  card._uiEl = fakeLayer();
  card._selectedZoneId = null;
  card._queueRender = () => {};
  card._applyInitialView = () => {};
  card._mapPostV030 = () => {};
  card._apiPath = () => "/api/navimower/map/entry";
  // Keep the beta11 regression scoped to static/layout adoption. Beta12 has
  // its own prepared-live regression and intentionally adds another manifest
  // reader during normal cumulative runtime operation.
  card._maybeLoadPreparedLive = async () => {};
  return card;
};

const wait = async (predicate, label) => {
  for (let index = 0; index < 200; index += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out: " + label);
};

// First paint is backward-compatible legacy geometry. Prepared static replaces
// it asynchronously once the integration manifest/resource is ready.
const first = makeCard();
first._applyMapPayload(mapPayload(), { entry_id: "entry", trail_session: 1 }, "map-key-1");
assert.ok(first._baseEl.innerHTML.includes("<polygon"), "legacy geometry paints immediately");
await wait(() => first._preparedStaticResourceId === resourceId, "prepared static resource");
assert.equal(first._layout.prepared, true);
assert.equal(first._layout.scale, 25);
assert.equal(first._layout.sx(5), 375);
assert.equal(first._layout.sy(5), 525);
assert.ok(first._baseEl.innerHTML.includes('d="M0 0L10 0L10 10L0 10Z"'));
assert.ok(first._baseEl.innerHTML.includes('transform="matrix(25.00000000 0.00000000 0.00000000 -25.00000000 250.00000000 650.00000000)"'));
assert.ok(first._detailsEl.innerHTML.includes("M2 2L3 2L3 3L2 3Z"));
assert.ok(first._detailsEl.innerHTML.includes("M0 5L10 5"));
assert.ok(first._detailsEl.innerHTML.includes("M8 0L9 0L9 2L8 2Z"));
assert.equal(calls.filter(([, path]) => path.includes("render_model_manifest=1")).length, 1);
assert.equal(calls.filter(([, path]) => path.includes("static_render_model=")).length, 1);

// A second card sharing the same content-addressed resource reuses the prepared
// JSON body; only its tiny manifest is read.
const second = makeCard();
second._applyMapPayload(mapPayload(), { entry_id: "entry", trail_session: 1 }, "map-key-2");
await wait(() => second._preparedStaticResourceId === resourceId, "shared prepared static resource");
assert.equal(calls.filter(([, path]) => path.includes("static_render_model=")).length, 1);
assert.equal(second._layout.prepared, true);

// Dynamic progress churn must not cause another prepared-static fetch.
for (let pct = 43; pct < 60; pct += 1) {
  const payload = mapPayload();
  payload.coverage.zones[0].pct = pct;
  payload.zone_details[0].progress = pct;
  first._applyMapPayload(payload, { entry_id: "entry", trail_session: 1 }, "progress-" + pct);
}
await new Promise((resolve) => setTimeout(resolve, 20));
assert.equal(calls.filter(([, path]) => path.includes("render_model_manifest=1")).length, 2);
assert.equal(calls.filter(([, path]) => path.includes("static_render_model=")).length, 1);

// No prepared discovery means the card must remain fully backward compatible.
const legacy = makeCard();
legacy._applyMapPayload(mapPayload("legacy-r1", false), { entry_id: "entry", trail_session: 1 }, "legacy");
assert.equal(legacy._preparedStaticResourceId, undefined);
assert.ok(legacy._baseEl.innerHTML.includes("<polygon"));
assert.equal(legacy._layout?.prepared, undefined);

// A prepared resource for another map revision is rejected and must not replace
// the already usable legacy layout.
const mismatch = makeCard();
const mismatchPayload = mapPayload("map-r2", true);
mismatch._applyMapPayload(mismatchPayload, { entry_id: "entry", trail_session: 1 }, "mismatch");
await new Promise((resolve) => setTimeout(resolve, 30));
assert.equal(mismatch._preparedStaticResourceId, undefined);
assert.ok(mismatch._baseEl.innerHTML.includes("<polygon"));
assert.notEqual(mismatch._layout?.prepared, true);

console.log("Prepared static beta11: async opt-in, matrix, cache, dynamic stability and legacy fallback passed");
