import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const patch = readFileSync("scripts/runtime-v037-beta6.js.txt", "utf8");

class Card {
  _payloadStaticSignature(payload) { return JSON.stringify(payload); }
  _applyStaticLayers() { this.staticApplies = (this.staticApplies || 0) + 1; }
  _staticCacheKey() { return "static-key"; }
  _zoneDetails(id) { return this._zoneRows?.[id] || {}; }
  _pillMetrics(value) { return {fontSize: 10, width: value.length * 6 + 10, height: 20}; }
  _applyMapPayload(payload) {
    this._mapPayload = payload;
    this._mapStaticSignature = this._payloadStaticSignature(payload);
    this._applyStaticLayers({});
    this._historyRenderKey = null;
    this._trailRenderKey = null;
  }
  _renderHistory() { this.historyRenders = (this.historyRenders || 0) + 1; }
  _renderTrail() { this.trailRenders = (this.trailRenders || 0) + 1; }
  _activeTrailSegments() { return this._segments || []; }
  _pointString(points) { return points.map((point) => point.join(",")).join(" "); }
}

const registry = new Map([["navimower-map-card", Card]]);
const context = vm.createContext({
  customElements: {get: (name) => registry.get(name)},
  console: {info() {}, debug() {}, warn() {}, error() {}},
  JSON, Math, Number, String, Array,
  trailWidth034: () => 7,
});
vm.runInContext(patch, context);

const card = new Card();
const base = {
  map_version: "1",
  map: {version: "1", zones: [{id: 1, name: "Zone 1", polygon: [[0,0],[1,0],[1,1]]}]},
  coverage: {zones: [{id: 1, pct: 3}]},
  zone_details: [{id: 1, progress: 3}],
  zone_states: [{id: 1, coverage_pct: 3}],
};
const changedProgress = structuredClone(base);
changedProgress.coverage.zones[0].pct = 4;
changedProgress.zone_details[0].progress = 4;
changedProgress.zone_states[0].coverage_pct = 4;
assert.equal(card._payloadStaticSignature(base), card._payloadStaticSignature(changedProgress), "progress must not invalidate static geometry");
const changedGeometry = structuredClone(base);
changedGeometry.map.zones[0].polygon[1][0] = 2;
assert.notEqual(card._payloadStaticSignature(base), card._payloadStaticSignature(changedGeometry), "geometry must invalidate static cache");

const text = {textContent: "Zone 1 · 3%", attrs: {x: "50"}, getAttribute(k) { return this.attrs[k]; }, setAttribute(k,v) { this.attrs[k]=String(v); }};
const rect = {attrs: {}, setAttribute(k,v) { this.attrs[k]=String(v); }};
const label = {
  dataset: {zoneId: "1", markerCx: "50", markerCy: "50"},
  querySelector(selector) { return selector === "text" ? text : selector === "rect" ? rect : null; },
};
card._labelsEl = {childNodes: [{}], querySelectorAll: () => [label]};
card._baseEl = {childNodes: [{}]}; card._detailsEl = {childNodes: [{}]}; card._uiEl = {childNodes: [{}]};
card._layout = {scale: 1, zones: base.map.zones};
card._zoneRows = {1: {progress: 3}};
card._applyStaticLayers({});
card._zoneRows[1].progress = 4;
card._applyStaticLayers({});
assert.equal(card.staticApplies, 1, "same static cache entry must not be rewritten");
assert.equal(text.textContent, "Zone 1 · 4%", "zone progress must still update incrementally");

const group = {attrs: {opacity: "0.55"}, getAttribute(k) { return this.attrs[k]; }, setAttribute(k,v) { this.attrs[k]=String(v); }, remove() { this.removed = true; }};
const path = {
  attrs: {d: "M0 0L1 1", fill: "#43a047"},
  getAttribute(k) { return this.attrs[k]; },
  setAttribute(k,v) { this.attrs[k]=String(v); },
  closest() { return group; },
};
card._historyEl = {querySelector: () => path};
card._config = {trail_color: "#43a047", trail_opacity: 0.55};
card._historyDayOffset = null;
card._historySelectedSessionId = null;
card._mapStaticSignature = "stable";
card._nm037Beta6CycleStructureKey = "stable|#43a047|0.55|1";
card._mapPayload = {current_cycle_render: {scope: "current_cycle", revision: "r2", mowed_area: {path_d: "M0 0L2 2"}}};
card._renderHistory();
assert.equal(card.historyRenders || 0, 0, "existing current-cycle SVG must not be replaced");
assert.equal(path.attrs.d, "M0 0L2 2", "current-cycle path must update in place");

const line = {
  attrs: {points: "0,0 1,1", stroke: "#43a047", "stroke-width": "7.0"},
  getAttribute(k) { return this.attrs[k]; },
  setAttribute(k,v) { this.attrs[k]=String(v); },
};
card._trailEl = {querySelectorAll: () => [line]};
card._segments = [[[0,0],[2,2]]];
card._trailSession = 1;
card._mapPayload.sessions = [];
card._renderTrail();
assert.equal(card.trailRenders || 0, 0, "same-segment live tail must not replace its DOM layer");
assert.equal(line.attrs.points, "0,0 2,2", "live tail points must update in place");

console.log("beta6 flicker-free incremental refresh tests passed");
