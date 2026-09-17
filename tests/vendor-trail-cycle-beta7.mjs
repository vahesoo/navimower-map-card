import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const patch = readFileSync("scripts/runtime-v037-beta7.js.txt", "utf8");

const cycle = "vendor:36:100";
const nextCycle = "vendor:36:200";
const render = (cycleId, path, revision) => ({
  scope: "current_cycle",
  revision: `render-${revision}`,
  zones: [{ zone_id: 36, cycle_id: cycleId, revision: `geometry-${revision}` }],
  mowed_area: { path_d: path },
  vendor_trail_debug: { revision },
});
const payload = (revision, cycleId, current = undefined) => ({
  vendor_trail_debug: {
    store_version: 1,
    revision,
    current_cycle_key: `${revision}:409:536`,
    cycle_ids: { "36": cycleId },
    owned_zone_ids: [36],
  },
  ...(current ? { current_cycle_render: current } : {}),
});

class Card {
  _apiPath() { return "/api/navimower/map/entry"; }
  _applyMapPayload(next) {
    const retained = this._mapPayload?.current_cycle_render;
    this._mapPayload = { ...next };
    if (!this._mapPayload.current_cycle_render && retained) {
      this._mapPayload.current_cycle_render = retained;
    }
  }
  _queueRender(flags) {
    this.renderRequests = [...(this.renderRequests || []), flags];
  }
  setConfig(config) { this._config = config || {}; }
  disconnectedCallback() {}
}

const registry = new Map([["navimower-map-card", Card]]);
const context = vm.createContext({
  customElements: { get: (name) => registry.get(name) },
  console: { info() {}, debug() {}, warn() {}, error() {} },
  requestIdleCallback: (callback) => callback(),
  setTimeout,
  clearTimeout,
  Date,
  JSON,
  Math,
  Number,
  String,
  Array,
  Map,
  Promise,
});
vm.runInContext(patch, context);

const requests = [];
const card = new Card();
card._beta16CycleGeneration = 0;
card._historyEl = { innerHTML: "mounted" };
card._hass = {
  callApi(method, path) {
    assert.equal(method, "GET");
    assert.equal(path, "navimower/map/entry?current_cycle_only=1");
    return new Promise((resolve, reject) => requests.push({ resolve, reject }));
  },
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

// Revision 96 is already mounted. A base refresh announces geometry revision 97
// but the stable zone/cycle identity is unchanged, so the existing render stays
// visible while beta7 asks for the newer artifact.
card._mapPayload = payload(96, cycle, render(cycle, "M96", 96));
card._applyMapPayload(payload(97, cycle));
assert.equal(card._mapPayload.current_cycle_render.mowed_area.path_d, "M96");
assert.equal(card._retainedCycleSourceKey, "97:409:536", "same-cycle retention must neutralize beta16 source-key churn");
assert.equal(requests.length, 1);

// Geometry advances again while request 97 is in flight. The 97 response must
// still be accepted because it belongs to the same stable cycle, then beta7 must
// immediately request 98 instead of starving on a moving revision.
card._applyMapPayload(payload(98, cycle));
assert.equal(requests.length, 1, "only one beta7 current-cycle request may be in flight");
requests[0].resolve({ current_cycle_render: render(cycle, "M97", 97) });
await flush();
assert.equal(card._mapPayload.current_cycle_render.mowed_area.path_d, "M97", "older same-cycle prefix must become visible");
assert.equal(requests.length, 2, "newer geometry must be fetched after publishing the valid prefix");
requests[1].resolve({ current_cycle_render: render(cycle, "M98", 98) });
await flush();
assert.equal(card._mapPayload.current_cycle_render.mowed_area.path_d, "M98");
assert.equal(card._nm037Beta7AcceptedVendorRevision, "98");

// Start another same-cycle request, then reset the zone before it returns. The
// mounted old-cycle SVG must be removed immediately and the late old response
// must never be allowed to reappear.
card._applyMapPayload(payload(99, cycle));
assert.equal(requests.length, 3);
card._historyEl.innerHTML = "old-cycle-svg";
card._applyMapPayload(payload(100, nextCycle));
assert.equal(card._mapPayload.current_cycle_render, undefined, "cycle change must clear retained old geometry");
assert.equal(card._historyEl.innerHTML, "", "old-cycle DOM must be cleared on confirmed cycle change");
requests[2].resolve({ current_cycle_render: render(cycle, "OLD-CYCLE", 99) });
await flush();
assert.notEqual(card._mapPayload.current_cycle_render?.mowed_area?.path_d, "OLD-CYCLE", "late previous-cycle response must be rejected");
assert.equal(requests.length, 4, "new stable cycle must be requested after rejecting the stale response");
requests[3].resolve({ current_cycle_render: render(nextCycle, "NEW-CYCLE", 100) });
await flush();
assert.equal(card._mapPayload.current_cycle_render.mowed_area.path_d, "NEW-CYCLE");
assert.equal(requests.length, 4);

assert.deepEqual(
  Card.prototype._beta7CurrentCycleContract(),
  {
    stableCycleIdentity: true,
    geometryRevisionIsFreshnessOnly: true,
    sameCyclePrefixAccepted: true,
    crossCycleRejected: true,
    oneDeferredRequestAtATime: true,
  },
);

console.log("beta7 stable-cycle deferred vendor render tests passed");
