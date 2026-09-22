import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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

const model = {
  schema_version: 1,
  scope: "live_route_render_model",
  coordinate_space: "map_xy_m",
  trail_session: 7,
  trail_active: true,
  segments: [{ id: 0, path_d: "M0 0L1 0L2 0", point_count: 3 }],
  segment_count: 1,
  point_count: 3,
  invalid_segment_count: 0,
};

const makeCard = () => {
  const card = new Card();
  card._config = {
    trail_color: "#43a047",
    trail_opacity: 0.55,
    trail_length: 10000,
  };
  card._layout = {
    scale: 25,
    preparedMatrix: [25, 0, 0, -25, 250, 650],
    sx: (x) => 25 * Number(x) + 250,
    sy: (y) => -25 * Number(y) + 650,
  };
  card._trailEl = { innerHTML: "" };
  card._trailSession = 7;
  card._trail = [[0, 0], [1, 0], [2, 0], [3, 0]];
  card._preparedLiveModel = model;
  card._preparedLiveResourceId = "live-r1";
  card._preparedLiveTailLocal = [];
  card._queueRender = () => {};
  card._mapPayload = {
    trail_session: 7,
    trail_active: true,
    activity: "mowing",
    sessions: [{ id: "session-7", active: true }],
    prepared_render_model: {
      schema_version: 1,
      manifest_url: "/api/navimower/map/entry?render_model_manifest=1",
      live_route_min_interval_s: 30,
      capabilities: {
        live_route_svg_paths: true,
        live_route_short_tail: true,
        live_route_tail_only_query: true,
      },
    },
    prepared_live_tail: {
      schema_version: 1,
      scope: "prepared_live_tail",
      usable: true,
      base_resource_id: "live-r1",
      trail_session: 7,
      base_point_count: 3,
      current_point_count: 4,
      point_count: 2,
      segment_count: 1,
      max_points: 128,
      segments: [[[2, 0], [3, 0]]],
      reason: null,
    },
  };
  card._preparedLiveTailPayload = card._mapPayload.prepared_live_tail;
  return card;
};

const card = makeCard();

assert.equal(card._preparedLiveTailOnlySupported(), true);
assert.equal(card._preparedLiveManifestIntervalMs(), 30000);
assert.equal(
  card._preparedLiveMapRequestPath("/api/navimower/map/entry"),
  "/api/navimower/map/entry?prepared_live_tail_only=1",
);
assert.equal(
  card._preparedLiveMapRequestPath("/api/navimower/map/entry?include_sessions=0"),
  "/api/navimower/map/entry?include_sessions=0&prepared_live_tail_only=1",
);

assert.deepEqual(
  card._preparedLiveTailSegments(model),
  [[[2, 0], [3, 0]]],
  "beta13 must consume the backend short tail without needing full raw trail_segments",
);

card._appendPreparedLiveTailPoint([4, 0]);
assert.deepEqual(
  card._preparedLiveTailSegments(model),
  [[[2, 0], [3, 0], [4, 0]]],
  "live MQTT point must continue directly after the backend short tail",
);

card._renderTrail();
assert.match(card._trailEl.innerHTML, /nm-prepared-live-route/);
assert.match(card._trailEl.innerHTML, /nm-live-tail/);
assert.match(card._trailEl.innerHTML, /points="300\.0,650\.0 325\.0,650\.0 350\.0,650\.0"/);

card._mapPayload.prepared_live_tail = {
  ...card._mapPayload.prepared_live_tail,
  base_resource_id: "live-r2",
};
assert.equal(card._preparedLiveTailNeedsResource(), true, "a new backend backbone id must force immediate prepared-resource adoption");

const oldBackend = makeCard();
delete oldBackend._mapPayload.prepared_render_model.capabilities.live_route_tail_only_query;
assert.equal(oldBackend._preparedLiveTailOnlySupported(), false);
assert.equal(
  oldBackend._preparedLiveMapRequestPath("/api/navimower/map/entry"),
  "/api/navimower/map/entry",
  "older integrations must keep the legacy full-trail request",
);

const calls = [];
const throttled = makeCard();
throttled._preparedLiveManifestAt = Date.now();
throttled._hass = {
  async callApi(method, path) {
    calls.push([method, path]);
    throw new Error("manifest should stay throttled");
  },
};
await throttled._maybeLoadPreparedLive(false);
assert.equal(calls.length, 0, "beta25 30 s discovery cadence must suppress per-MQTT manifest reads");

const source = readFileSync("src/navimower-map-card.js", "utf8");
assert.match(source, /prepared_live_tail_only=1/);
assert.match(source, /preparedLiveTailOnlySupported036/);
assert.match(source, /preparedLiveTailSegments036\(card, member, payload/);
assert.match(source, /tailBase && tailBase !== String\(state\.preparedLiveResourceId/);
assert.match(source, /state\.preparedLiveModel = card\._preparedLiveModel/);

console.log("Prepared tail beta13: tail-only query, 30 s cadence, resource alignment, MQTT continuation and Multi reuse passed");
