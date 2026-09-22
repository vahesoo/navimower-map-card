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
  card._mapPayload = {
    trail_session: 7,
    trail_active: true,
    sessions: [{ id: "session-7", active: true }],
    trail_segments: [[[0, 0], [1, 0], [2, 0], [3, 0]]],
    prepared_render_model: {
      schema_version: 1,
      manifest_url: "/api/navimower/map/entry?render_model_manifest=1",
    },
  };
  card._trailSession = 7;
  card._trail = [[0, 0], [1, 0], [2, 0], [3, 0]];
  card._queueRender = () => {};
  return card;
};

const model = {
  schema_version: 1,
  scope: "live_route_render_model",
  coordinate_space: "map_xy_m",
  trail_session: 7,
  trail_active: true,
  segments: [{
    id: 0,
    path_d: "M0 0L1 0L2 0",
    point_count: 3,
  }],
  segment_count: 1,
  point_count: 3,
  invalid_segment_count: 0,
};

const card = makeCard();
card._preparedLiveModel = model;
card._preparedLiveResourceId = "live-r1";

assert.equal(card._preparedLiveCompatible(), true, "matching prepared live route must be accepted");
assert.deepEqual(
  card._preparedLiveTailSegments(model),
  [[[2, 0], [3, 0]]],
  "prepared route keeps only the short browser/MQTT tail after the backend point count",
);

card._renderTrail();
assert.match(card._trailEl.innerHTML, /nm-prepared-live-route/);
assert.match(card._trailEl.innerHTML, /d="M0 0L1 0L2 0"/);
assert.match(card._trailEl.innerHTML, /matrix\(25\.00000000 0\.00000000 0\.00000000 -25\.00000000 250\.00000000 650\.00000000\)/);
assert.match(card._trailEl.innerHTML, /nm-live-tail/);
assert.match(card._trailEl.innerHTML, /points="300\.0,650\.0 325\.0,650\.0"/);

const mismatch = makeCard();
mismatch._preparedLiveModel = { ...model, trail_session: 8 };
mismatch._preparedLiveResourceId = "stale";
assert.equal(mismatch._preparedLiveCompatible(), false, "another trail session must never be adopted");
mismatch._renderTrail();
assert.doesNotMatch(mismatch._trailEl.innerHTML, /nm-prepared-live-route/);
assert.match(mismatch._trailEl.innerHTML, /<polyline/);

const calls = [];
const loader = makeCard();
loader._hass = {
  async callApi(method, path) {
    calls.push([method, path]);
    if (path.includes("render_model_manifest=1")) {
      return {
        schema_version: 1,
        live_route: {
          resource_id: "live-r2",
          url: "/api/navimower/map/entry?live_render_model=live-r2",
        },
      };
    }
    if (path.includes("live_render_model=live-r2")) return { ...model };
    throw new Error("unexpected path " + path);
  },
};
await loader._maybeLoadPreparedLive(true);
assert.equal(loader._preparedLiveResourceId, "live-r2");
assert.equal(calls.filter(([, path]) => path.includes("render_model_manifest=1")).length, 1);
assert.equal(calls.filter(([, path]) => path.includes("live_render_model=live-r2")).length, 1);

await loader._maybeLoadPreparedLive(true);
assert.equal(calls.filter(([, path]) => path.includes("render_model_manifest=1")).length, 2, "forced manifest refresh checks for a newer live resource");
assert.equal(calls.filter(([, path]) => path.includes("live_render_model=live-r2")).length, 1, "same content-addressed live resource is not downloaded twice");

const shared = makeCard();
shared._hass = loader._hass;
await shared._maybeLoadPreparedLive(true);
assert.equal(shared._preparedLiveResourceId, "live-r2");
assert.equal(calls.filter(([, path]) => path.includes("live_render_model=live-r2")).length, 1, "live resource body cache is shared across card instances");

const source = readFileSync("src/navimower-map-card.js", "utf8");
assert.match(source, /memberPreparedLive036/);
assert.match(source, /refreshMemberPreparedLive036/);
assert.match(source, /preparedLiveTailSegments036/);
assert.match(source, /nm-multi-live-trail nm-prepared-live-route/);

console.log("Prepared live beta12: Single path, short live tail, stale-session fallback, shared resource cache and Multi path passed");
