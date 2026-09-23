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
  card._trailSession = 7;
  card._trail = [];
  card._queueRender = () => {};
  card._mapPayload = {
    trail_session: 7,
    trail_active: true,
    active_session_id: "session-7",
    prepared_render_model: {
      schema_version: 1,
      manifest_url: "/api/navimower/map/entry?render_model_manifest=1",
      live_route_min_interval_s: 30,
      capabilities: {
        live_semantic_route_resource: true,
        live_semantic_tail_only_query: true,
      },
    },
    prepared_live_semantic_tail: {
      schema_version: 1,
      scope: "prepared_live_semantic_tail",
      usable: true,
      base_resource_id: "semantic-r1",
      base_session_id: "session-7",
      session_id: "session-7",
      current_point_count: 6,
      point_count: 2,
      cutting_segments: [{ path_d: "M2 0L3 0", point_count: 2, kind: "cutting" }],
      travel_segments: [{ path_d: "M3 0L4 0", point_count: 2, kind: "travel" }],
    },
  };
  card._preparedSemanticLiveTailPayload = card._mapPayload.prepared_live_semantic_tail;
  return card;
};

const semanticModel = {
  schema_version: 1,
  scope: "live_semantic_route_render_model",
  coordinate_space: "map_xy_m",
  available: true,
  session_id: "session-7",
  source_point_count: 5,
  cutting_segments: [{ path_d: "M0 0L1 0L2 0", point_count: 3, kind: "cutting" }],
  travel_segments: [{ path_d: "M1 0L1 1", point_count: 2, kind: "travel" }],
};

const card = makeCard();
card._preparedSemanticLiveModel = semanticModel;
card._preparedSemanticLiveResourceId = "semantic-r1";

assert.equal(card._preparedSemanticLiveTailOnlySupported(), true);
assert.equal(
  card._preparedLiveMapRequestPath("/api/navimower/map/entry?include_sessions=0"),
  "/api/navimower/map/entry?include_sessions=0&prepared_live_semantic_tail_only=1",
);
assert.equal(card._preparedSemanticLiveCompatible(), true);
assert.deepEqual(
  card._preparedSemanticLiveTailRows(),
  {
    cutting: card._mapPayload.prepared_live_semantic_tail.cutting_segments,
    travel: card._mapPayload.prepared_live_semantic_tail.travel_segments,
  },
);

card._renderTrail();
assert.match(card._trailEl.innerHTML, /nm-semantic-live-cutting/);
assert.match(card._trailEl.innerHTML, /nm-semantic-live-travel/);
assert.match(card._trailEl.innerHTML, /stroke-opacity="0\.55"/);
assert.match(card._trailEl.innerHTML, /stroke-width="8\.3"/);
assert.match(card._trailEl.innerHTML, /stroke-width="2\.0"/);
assert.ok(
  card._trailEl.innerHTML.indexOf("nm-semantic-live-cutting")
    < card._trailEl.innerHTML.indexOf("nm-semantic-live-travel"),
  "cutting and travel must be separate semantic route classes",
);

const calls = [];
const loader = makeCard();
loader._hass = {
  async callApi(method, path) {
    calls.push([method, path]);
    if (path.includes("render_model_manifest=1")) {
      return {
        schema_version: 1,
        live_semantic_route: {
          resource_id: "semantic-r2",
          url: "/api/navimower/map/entry?live_semantic_route_render=semantic-r2",
        },
        live_route: {
          resource_id: "legacy-r2",
          url: "/api/navimower/map/entry?live_route_render=legacy-r2",
        },
      };
    }
    if (path.includes("live_semantic_route_render=semantic-r2")) {
      return { ...semanticModel };
    }
    throw new Error("unexpected path " + path);
  },
};
loader._preparedSemanticLiveTailPayload = {
  ...loader._mapPayload.prepared_live_semantic_tail,
  base_resource_id: "semantic-r2",
};
loader._mapPayload.prepared_live_semantic_tail = loader._preparedSemanticLiveTailPayload;
await loader._maybeLoadPreparedLive(true);
assert.equal(loader._preparedSemanticLiveResourceId, "semantic-r2");
assert.equal(calls.filter(([, path]) => path.includes("live_semantic_route_render=semantic-r2")).length, 1);
assert.equal(calls.filter(([, path]) => path.includes("live_route_render=legacy-r2")).length, 0);

const mismatch = makeCard();
mismatch._preparedSemanticLiveModel = { ...semanticModel, session_id: "other-session" };
mismatch._preparedSemanticLiveResourceId = "semantic-r1";
assert.equal(mismatch._preparedSemanticLiveCompatible(), false);

const source = readFileSync("src/navimower-map-card.js", "utf8");
assert.match(source, /PREPARED_SEMANTIC_LIVE_RESOURCE_CACHE/);
assert.match(source, /prepared_live_semantic_tail_only=1/);
assert.match(source, /live_semantic_route/);
assert.match(source, /nm-semantic-live-cutting/);
assert.match(source, /nm-semantic-live-travel/);
assert.match(source, /memberPreparedSemanticLive036/);
assert.match(source, /preparedSemanticTailRows036/);

console.log("Semantic live beta16: opt-in resource, short tail, cutting/travel composition, opacity and fallback guards passed");
