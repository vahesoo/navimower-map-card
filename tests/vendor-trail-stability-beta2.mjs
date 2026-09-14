import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const beta1 = await readFile(new URL("../scripts/runtime-v037-beta1.js.txt", import.meta.url), "utf8");
const beta2 = await readFile(new URL("../scripts/runtime-v037-beta2.js.txt", import.meta.url), "utf8");
const source = await readFile(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");

for (const marker of [
  "0.3.7-beta2: stable vendor backbone / MQTT tail and authenticated OSM tiles.",
  "__navimower037Beta2StableTrailOsm",
  "backend_tail_authoritative",
  "_nm037Beta2ServerTail",
  "data-trail-source\", \"mqtt-tail",
  "MATCH_RADIUS_M = 1.0",
]) {
  assert.ok(source.includes(marker), `missing beta2 stable-trail marker: ${marker}`);
}
assert.equal(
  (source.match(/0\.3\.7-beta2: stable vendor backbone \/ MQTT tail and authenticated OSM tiles\./g) || []).length,
  1,
  "beta2 runtime patch must be applied exactly once",
);

const plain = (value) => JSON.parse(JSON.stringify(value));

class MockLine {
  constructor() {
    this.attributes = new Map();
  }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
  getAttribute(name) {
    return this.attributes.get(name) || null;
  }
}

class MockCard {
  constructor() {
    this._config = { trail_color: "#43a047" };
    this._mapPayload = {};
    this._trail = [];
    this._line = new MockLine();
    this._trailEl = { querySelectorAll: () => [this._line] };
    this._attrs = new Set();
  }
  _activeTrailSegments() {
    return [this._trail.map((point) => [...point])];
  }
  _renderTrail() {
    this._line.setAttribute("stroke", "#123456");
    return true;
  }
  toggleAttribute(name, enabled) {
    if (enabled) this._attrs.add(name);
    else this._attrs.delete(name);
  }
  removeAttribute(name) {
    this._attrs.delete(name);
  }
}

const context = {
  console: { info() {}, warn() {}, error() {} },
  customElements: { get: (name) => name === "navimower-map-card" ? MockCard : null },
  setTimeout,
  clearTimeout,
  URL,
  document: {
    createElement() {
      return { dataset: {}, style: {}, textContent: "" };
    },
  },
};
context.globalThis = context;
vm.runInNewContext(beta1, context, { filename: "runtime-v037-beta1.js.txt" });
vm.runInNewContext(beta2, context, { filename: "runtime-v037-beta2.js.txt" });

const card = new MockCard();
card._mapPayload = {
  trail_session: 11,
  vendor_trail_debug: { enabled: true, backend_tail_authoritative: true },
  trail_segments: [[[2, 0], [3, 0]]],
};
card._trail = [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]];
assert.deepEqual(
  plain(card._activeTrailSegments()),
  [[[2, 0], [3, 0], [4, 0]]],
  "browser live MQTT must append only after the server-trimmed tail anchor",
);

card._mapPayload.trail_segments = [];
assert.deepEqual(
  plain(card._activeTrailSegments()),
  [[[2, 0], [3, 0], [4, 0]]],
  "temporary empty payloads must keep the same-session authoritative tail sticky",
);

card._mapPayload = {
  trail_session: 12,
  vendor_trail_debug: { enabled: true, backend_tail_authoritative: true },
  trail_segments: [[[10, 0]]],
};
card._trail = [[10, 0], [11, 0]];
assert.deepEqual(
  plain(card._activeTrailSegments()),
  [[[10, 0], [11, 0]]],
  "a new session must start from its own backend anchor",
);

card._mapPayload.trail_segments = [[[20, 0], [21, 0]]];
card._trail = [[0, 0], [1, 0], [2, 0]];
assert.deepEqual(
  plain(card._activeTrailSegments()),
  [[[20, 0], [21, 0]]],
  "missing anchor match must never resurrect the full local MQTT session",
);

card._mapPayload.vendor_trail_debug.enabled = true;
card._renderTrail();
assert.equal(card._line.getAttribute("stroke"), "#43a047");
assert.equal(card._line.getAttribute("data-trail-source"), "mqtt-tail");
assert.equal(card._attrs.has("data-nm-vendor-trail-debug"), false);

console.log("0.3.7-beta2 stable vendor/MQTT tail checks passed");
