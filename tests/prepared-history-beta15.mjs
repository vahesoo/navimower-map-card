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

const waitFor = async (predicate, label) => {
  for (let i = 0; i < 80; i += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("Timed out waiting for " + label);
};

const render = {
  version: 2,
  coordinate_space: "map_xy_m",
  source: { session_id: "s1", point_count: 42 },
  mowed_area: { path_d: "M0 0L2 0L2 2Z" },
  travel: { path_d: "M2 2L3 3", stroke_width_m: 0.08 },
  route: { path_d: "M0 0L3 3" },
};

const manifestPath = "/api/navimower/history-manifest/entry-beta15";
const resourcePath = "/api/navimower/history-resource/entry-beta15/history-r1";
const legacyPath = "/api/navimower/session-render/entry-beta15/s1";

const preparedMapPayload = {
  trail_session: 8,
  active_session_id: null,
  trail_active: false,
  prepared_render_model: {
    schema_version: 1,
    scope: "prepared_map_render_model",
    history_manifest_url: manifestPath,
    history_resource_url_template: "/api/navimower/history-resource/entry-beta15/{resource_id}",
    capabilities: {
      history_ready_manifest: true,
      history_content_addressed_resources: true,
      history_etag: true,
    },
  },
};

const historyManifest = {
  schema_version: 1,
  scope: "prepared_history",
  entry_id: "entry-beta15",
  ready_only: true,
  prewarm_started: true,
  prewarm_complete: true,
  retained_session_count: 1,
  eligible_session_count: 1,
  ready_session_count: 1,
  pending_session_count: 0,
  publication_revision: 1,
  legacy_session_render_url_template: "/api/navimower/session-render/entry-beta15/{session_id}",
  resource_url_template: "/api/navimower/history-resource/entry-beta15/{resource_id}",
  sessions: [{
    id: "s1",
    active: false,
    started_at: "2026-09-22T10:00:00+00:00",
    ended_at: "2026-09-22T11:00:00+00:00",
    started_at_ms: 1790060000000,
    ended_at_ms: 1790063600000,
    sequence: 1,
    point_count: 42,
    render_ready: true,
    render: {
      resource_id: "history-r1",
      format: "json",
      scope: "prepared_history_render",
      coordinate_space: "map_xy_m",
      session_id: "s1",
      byte_length: 450,
      url: resourcePath,
    },
  }],
};

function configureCard(calls) {
  const card = new Card();
  card._config = {
    entity: "lawn_mower.beta15",
    session_count: 6,
    trail_color: "#43a047",
    trail_opacity: 0.55,
    show_session_legend: true,
  };
  card._queueRender = () => {};
  card._v030BaseApiPath = "/api/navimower/map/entry-beta15";
  card._mapPayload = structuredClone(preparedMapPayload);
  card._historyDayOffset = 1;
  card._historyEl = { innerHTML: "" };
  card._layout = {
    scale: 25,
    sx: (x) => Number(x) * 25 + 200,
    sy: (y) => 800 - Number(y) * 25,
  };
  card._sessionsForCurrentView = () => card._sessionRecords({ applyLimit: false });
  card._hass = {
    states: {},
    async callApi(method, path) {
      calls.push([method, path]);
      if (path === "navimower/history-manifest/entry-beta15") return structuredClone(historyManifest);
      if (path === "navimower/history-resource/entry-beta15/history-r1") {
        return {
          schema_version: 1,
          scope: "prepared_history_render",
          coordinate_space: "map_xy_m",
          session_id: "s1",
          render: structuredClone(render),
        };
      }
      if (path === "navimower/session-render/entry-beta15/s1") {
        throw new Error("legacy session-render must not be used when beta26 resource is ready");
      }
      throw new Error("Unexpected API call: " + path);
    },
  };
  return card;
}

const firstCalls = [];
const first = configureCard(firstCalls);
first._mapPostV030(preparedMapPayload);
await waitFor(() => Array.isArray(first._v030SessionIndex), "Prepared History manifest");
assert.equal(first._v030PreparedHistory, true);
assert.equal(first._v030SessionIndex.length, 1);
assert.equal(first._v030SessionIndex[0].prepared_render.resource_id, "history-r1");
assert.equal(firstCalls.filter(([, path]) => path === "navimower/history-manifest/entry-beta15").length, 1);

first._archive();
await waitFor(
  () => Boolean(first._sessionRecords({ applyLimit: false })[0]?.render),
  "Prepared History resource",
);
assert.equal(firstCalls.filter(([, path]) => path === "navimower/history-resource/entry-beta15/history-r1").length, 1);
assert.equal(firstCalls.filter(([, path]) => path === "navimower/session-render/entry-beta15/s1").length, 0);
assert.match(first._sessionRecords({ applyLimit: false })[0].render.mowed_area.path_d, /M0 0L2 0/);

// A second card instance represents Single/Multi or another dashboard instance.
// Both the manifest cache and immutable resource cache must be shared by module
// resource_id so no second network fetch is required.
const secondCalls = [];
const second = configureCard(secondCalls);
second._mapPostV030(preparedMapPayload);
await waitFor(() => Array.isArray(second._v030SessionIndex), "shared Prepared History manifest cache");
second._archive();
await waitFor(
  () => Boolean(second._sessionRecords({ applyLimit: false })[0]?.render),
  "shared Prepared History resource cache",
);
assert.equal(secondCalls.length, 0, "prepared History manifest/resource caches must be shared across card instances");

// Older integrations stay fully supported through the sessions + session-render
// path. Use a different entry id so the prepared cache cannot satisfy it.
const legacyCalls = [];
const legacy = new Card();
legacy._config = {
  entity: "lawn_mower.legacy",
  session_count: 6,
  trail_color: "#43a047",
  trail_opacity: 0.55,
  show_session_legend: true,
};
legacy._queueRender = () => {};
legacy._v030BaseApiPath = "/api/navimower/map/entry-legacy";
legacy._mapPayload = { trail_session: 3, active_session_id: null, trail_active: false };
legacy._historyDayOffset = 1;
legacy._historyEl = { innerHTML: "" };
legacy._layout = {
  scale: 25,
  sx: (x) => Number(x) * 25 + 200,
  sy: (y) => 800 - Number(y) * 25,
};
legacy._sessionsForCurrentView = () => legacy._sessionRecords({ applyLimit: false });
legacy._hass = {
  states: {},
  async callApi(method, path) {
    legacyCalls.push([method, path]);
    if (path === "navimower/sessions/entry-legacy") {
      return {
        schema_version: 1,
        session_render_api_path_template: "/api/navimower/session-render/entry-legacy/{session_id}",
        sessions: [{
          id: "legacy-s1",
          active: false,
          started_at: "2026-09-21T10:00:00+00:00",
          ended_at: "2026-09-21T11:00:00+00:00",
          point_count: 20,
        }],
      };
    }
    if (path === "navimower/session-render/entry-legacy/legacy-s1") {
      return { schema_version: 1, render: structuredClone(render) };
    }
    throw new Error("Unexpected legacy API call: " + path);
  },
};
legacy._mapPostV030(legacy._mapPayload);
await waitFor(() => Array.isArray(legacy._v030SessionIndex), "legacy session index");
assert.equal(legacy._v030PreparedHistory, false);
legacy._archive();
await waitFor(
  () => Boolean(legacy._sessionRecords({ applyLimit: false })[0]?.render),
  "legacy session render fallback",
);
assert.equal(legacyCalls.filter(([, path]) => path === "navimower/sessions/entry-legacy").length, 1);
assert.equal(legacyCalls.filter(([, path]) => path === "navimower/session-render/entry-legacy/legacy-s1").length, 1);

const source = readFileSync("src/navimower-map-card.js", "utf8");
assert.match(source, /PREPARED_HISTORY_RESOURCE_CACHE/);
assert.match(source, /history_ready_manifest/);
assert.match(source, /payload\?\.scope === "prepared_history"/);
assert.match(source, /payload\.scope !== "prepared_history_render"/);
assert.match(source, /memberHistoryManifestPath036/);
assert.match(source, /state\.sessions = normalizeIndexSessions\(payload\)/);
assert.match(source, /render = await loadPreparedHistoryResource\(card, descriptor, id\)/);
assert.match(source, /legacy_session_render_url_template/);

console.log("Prepared History beta15: ready-only manifest, immutable resource, shared cache, Multi wiring and legacy fallback passed");
