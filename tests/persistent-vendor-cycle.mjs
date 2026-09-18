import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Execute the cumulative production runtime. Expose closure-local multi helpers
// only in this test copy; no historical upgrade-script implementation is used.
let source = readFileSync("src/navimower-map-card.js", "utf8");
assert.ok(!source.includes("MAX_TAIL_DISTANCE_M"));
assert.ok(!source.includes("mqtt-live-tail-short"));
source = source.replace(/^export\s*\{[^}]*\};?/m, "");
const multiTestAnchor = '  proto._beta8RefreshMultiRender = function() { if (multiActive036(this)) renderMultiMap036(this, true); };';
assert.ok(source.includes(multiTestAnchor), "multi-mower beta8 test hook anchor missing");
source = source.replace(
  multiTestAnchor,
  multiTestAnchor + '\n  globalThis.multiTest = {renderMultiMap036, memberState036, refreshMemberMap036, refreshMemberCurrentCycle036};',
);
const registry = new Map();
const idle = [];
const context = vm.createContext({
  HTMLElement: class {}, Map, Set, URL, Date, JSON, Math, queueMicrotask() {},
  document: {createElement: () => ({dataset: {}, style: {}, append() {}, setAttribute() {}})},
  customElements: {define: (name, cls) => registry.set(name, cls), get: (name) => registry.get(name)},
  window: {customCards: []}, console: {info() {}, warn() {}, debug() {}, error() {}},
  setTimeout: (callback) => { idle.push(callback); return idle.length; }, clearTimeout() {},
});
vm.runInContext(source, context);
const Card = registry.get("navimower-map-card");
const plain = (v) => JSON.parse(JSON.stringify(v));
const element = () => ({innerHTML: "", style: {}, dataset: {}, querySelectorAll: () => []});
const card = new Card();
card._config = {trail_color: "#43a047", trail_opacity: 0.5, trail_length: 10000};
card._queueRender = () => {};
card._layout = {scale: 1, sx: (x) => x, sy: (y) => -y};
card._historyEl = element(); card._trailEl = element(); card._highlightEl = element();
card._mapPayload = {
  trail_session: 1,
  vendor_trail_debug: {store_version: 1, backend_tail_authoritative: true, live_tail_allowed: true,
    active_zone_id: 92, active_cycle_id: "cycle-a", current_cycle_key: "1"},
  trail_segments: [Array.from({length: 21}, (_, i) => [i+10, 0])],
};
card._trail = Array.from({length: 36}, (_, i) => [i, 0]);
assert.deepEqual(plain(card._activeTrailSegments()), [Array.from({length: 26}, (_, i) => [i+10, 0])]);
card._mapPayload.trail_segments = [[[30, 0]]];
assert.deepEqual(plain(card._activeTrailSegments()), [[[30, 0], [31, 0], [32, 0], [33, 0], [34, 0], [35, 0]]]);
card._mapPayload.trail_segments = [];
assert.deepEqual(plain(card._activeTrailSegments()), [], "explicit empty confirmation must not resurrect previous tail");
card._mapPayload.vendor_trail_debug.active_cycle_id = "cycle-b";
assert.deepEqual(plain(card._activeTrailSegments()), [], "new cycle cannot inherit same-session browser tail");
card._mapPayload.vendor_trail_debug.live_tail_allowed = false;
card._mapPayload.trail_segments = [[[30, 0], [31, 0]]];
assert.deepEqual(plain(card._activeTrailSegments()), [], "docked/empty-task has no live overlay");

const session = {id: "session-a", point_count: 2, ended_at_ms: 1000, active: false};
const other = {id: "session-b", point_count: 2, ended_at_ms: 2000, active: false};
const archive = (path) => ({version: 2, coordinate_space: "map_xy_m", mowed_area: {path_d: path}, travel: {path_d: ""}});
const aPath = "M1 1L2 1L2 2Z", bPath = "M10 10L11 10L11 11Z", cyclePath = "M20 20L21 20L21 21Z";
card._sessionRecords = () => [session, other];
card._v030Renders = new Map([
  [session.id, {signature: context.renderSignature(session), render: archive(aPath)}],
  [other.id, {signature: context.renderSignature(other), render: archive(bPath)}],
]);
card._mapPayload.current_cycle_render = {scope: "current_cycle", revision: "c", mowed_area: {path_d: cyclePath}};
card._renderHistory();
assert.ok(card._historyEl.innerHTML.includes(cyclePath));
await card._pulseSessionPath(session.id);
assert.equal(card._historyEl.innerHTML, "");
assert.equal(card._trailEl.innerHTML, "");
assert.ok(card._highlightEl.innerHTML.includes(aPath));
assert.ok(!card._highlightEl.innerHTML.includes(bPath));
assert.ok(!card._highlightEl.innerHTML.includes(cyclePath));

// Multi-mower selection must hide cumulative geometry from both members and
// render exactly the chosen mower/session archive.
const multi = new Card();
multi._config = {...card._config, multi_mower: true, show_zone_labels: false, show_map_legend: false};
multi._queueRender = () => {};
multi._hass = {states: {}};
multi._multi036Layer = element();
multi._multi036Site = {multi_mower: true, member_order: "west_to_east",
  combined_svg_bounds: {min_x: 0, min_y: 0, max_x: 50, max_y: 50},
  members: ["m1", "m2"].map((entry_id) => ({entry_id, svg_matrix: [1, 0, 0, 1, 0, 0]}))};
for (const member of multi._multi036Site.members) {
  context.multiTest.memberState036(multi, member.entry_id).map = {
    map: {zones: []}, current_cycle_render: {scope: "current_cycle", mowed_area: {path_d: cyclePath}},
    trail_segments: [[[0, 0], [1, 0]]],
  };
}
multi._multi036SelectedSessionKey = "m2:session-a";
multi._multi036RenderCache = new Map([["m2:session-a", archive(aPath)]]);
context.multiTest.renderMultiMap036(multi, true);
assert.ok(multi._multi036Layer.innerHTML.includes(aPath));
assert.ok(!multi._multi036Layer.innerHTML.includes(cyclePath));
assert.ok(!multi._multi036Layer.innerHTML.includes("nm-multi-live-trail"));
assert.equal((multi._multi036Layer.innerHTML.match(/nm-multi-selected-session/g) || []).length, 1);

// Source version changes cause deferred refresh while the retained SVG remains.
// The old request may finish after a newer base payload, but cannot overwrite it.
const phased = new Card();
phased._config = card._config;
phased._queueRender = () => {};
phased._apiPath = () => "/api/navimower/map/m1";
phased._staticCacheKey = () => "phased";
phased._buildLayout = () => null;
phased._applyStaticLayers = () => {};
phased._payloadStaticSignature = () => "map";
phased._hass = {states: {}};
phased._mapPayload = {current_cycle_render: {scope: "current_cycle", revision: "retained", mowed_area: {path_d: cyclePath}}};
phased._retainedCycleEntry = "m1";
phased._applyMapPayload({trail_session: 1, map: {zones: []}, vendor_trail_debug: {store_version: 1, current_cycle_key: "new"}}, {entry_id: "m1"}, "new-map");
assert.equal(phased._mapPayload.current_cycle_render.revision, "retained");

console.log("Persistent vendor cycle: unbounded tails, confirmation, History isolation, Single/Multi and phased retention passed");
