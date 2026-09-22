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

const mapEntity = "sensor.beta14_map";
const apiPath = "/api/navimower/map/entry-beta14";
const state = {
  state: "ready",
  attributes: {
    api_path: apiPath,
    map_version: "v1",
    map_modified_count: 1,
    trail_session: 7,
    active_session_id: "7",
    zone_states_revision: 1,
    vendor_trail_revision: 100,
  },
};

const calls = [];
const card = new Card();
card._config = { entity: "lawn_mower.beta14" };
card._resolved = { map_entity: mapEntity };
card._queueRender = () => {};
card._multi036DialogMember = null;
card._multi036ActionMember = null;
// This regression targets the final outgoing request, not the older _apiPath
// wrapper. Feed the cumulative runtime the exact lightweight path it normally
// receives after v0.3 map phasing.
card._apiPath = () =>
  apiPath + "?include_sessions=0&include_daily_trails=0&include_current_cycle=0";
// Keep the final Multi wrapper present, but prevent this Single-runtime
// regression from doing an unrelated Site API refresh/DOM pass.
card._multi036Site = { multi_mower: false, member_order: "west_to_east", members: [] };
card._multi036SiteAt = Date.now();
card._applyMapPayload = function(payload, _attrs, key) {
  this._mapPayload = payload;
  this._mapKey = key;
};
card._hass = {
  states: { [mapEntity]: state },
  async callApi(method, path) {
    calls.push([method, path]);
    return {
      schema_version: 1,
      trail_session: 7,
      trail_active: true,
      activity: "mowing",
      prepared_render_model: {
        schema_version: 1,
        manifest_url: "/api/navimower/map/entry-beta14?render_model_manifest=1",
        live_route_min_interval_s: 30,
        capabilities: {
          live_route_svg_paths: true,
          live_route_short_tail: true,
          live_route_tail_only_query: true,
        },
      },
    };
  },
};

await card._maybeLoadMap();
const firstMapCall = calls.find(([, path]) =>
  path.startsWith("navimower/map/entry-beta14") && path.includes("include_sessions=0")
);
assert.ok(firstMapCall, "first final-runtime lightweight Map API request must be sent");
assert.doesNotMatch(
  firstMapCall[1],
  /prepared_live_tail_only=1/,
  "cold request stays full-trail compatible until beta25 capability is discovered",
);

state.attributes.vendor_trail_revision = 101;
await card._maybeLoadMap();
const mapCalls = calls.filter(([, path]) =>
  path.startsWith("navimower/map/entry-beta14") && path.includes("include_sessions=0")
);
assert.equal(mapCalls.length, 2, "revision change must produce a second final-runtime lightweight Map API request");
assert.match(
  mapCalls[1][1],
  /prepared_live_tail_only=1/,
  "the actual runtime-overridden _maybeLoadMap request must opt into beta25 short-tail transport",
);
assert.match(mapCalls[1][1], /include_sessions=0/);
assert.match(mapCalls[1][1], /include_daily_trails=0/);
assert.match(mapCalls[1][1], /include_current_cycle=0/);

const source = readFileSync("src/navimower-map-card.js", "utf8");
assert.match(
  source,
  /const requestPath = this\._preparedLiveMapRequestPath\?\.\(apiPath\) \|\| apiPath;\s*const payload = await this\._hass\.callApi\("GET", apiCallPath\(requestPath\)\);/,
  "final v0.3 runtime override must route its outgoing Map API request through the beta13 helper",
);
assert.doesNotMatch(
  source,
  /const payload = await this\._hass\.callApi\("GET", apiCallPath\(apiPath\)\);/,
  "no final runtime Map API call may bypass the tail-only helper",
);

console.log("Prepared tail beta14: final runtime outgoing request adopts prepared_live_tail_only after discovery");
