import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

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
const sourceText = await readFile(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");
const Card = customElements.get("navimower-map-card");

assert.ok(sourceText.includes('const NAVIMOWER_MAP_CARD_VERSION = "0.1.16";'));
assert.equal(typeof Card, "function");
assert.equal(window.customCards.length, 1);
assert.equal(window.customCards[0].type, "navimower-map-card");
assert.equal(window.customCards[0].getEntitySuggestion({}, "lawn_mower.tont").config.entity, "lawn_mower.tont");
assert.equal(window.customCards[0].getEntitySuggestion({}, "sensor.temperature"), null);

const stub = Card.getStubConfig();
assert.equal(stub.auto_entities, true);
assert.equal(stub.initial_focus, "map");
assert.equal(stub.avoid_zone_label_overlap, true);
const formText = JSON.stringify(Card.getConfigForm());
assert.ok(formText.includes("avoid_zone_label_overlap"));
assert.ok(formText.includes("zone_label_opacity"));
assert.ok(formText.includes("schedule_entity"));

const card = new Card();
card._config = {
  zone_label_font_size: 20,
  zone_label_opacity: 0.8,
  avoid_zone_label_overlap: true,
  zone_fill_color: "#81c784",
  zone_fill_opacity: 0.22,
  zone_stroke_color: "#43a047",
  off_limit_color: "#FF5A00",
  vf_off_color: "#2F80ED",
  channel_color: "#686868",
  gate_area_color: "#8e24aa",
  dock_color: "#37474f",
  map_background_color: "#ededed",
  map_legend_opacity: 0.58,
  trail_color: "#43a047",
  trail_opacity: 0.55,
  mower_scale: 1,
  dock_scale: 1,
  show_zone_labels: true,
  show_gate_areas: false,
  show_channels: false,
  show_map_legend: false,
  show_session_legend: false,
};

const sharedPolygon = [[380, 380], [620, 380], [620, 620], [380, 620]];
const crowded = Array.from({ length: 9 }, (_, index) => ({
  anchorX: 500,
  anchorY: 500,
  value: `Zone ${index + 1} · 100%`,
  zoneId: index + 1,
  polygon: sharedPolygon,
  area: 57600,
}));
const arranged = card._layoutZoneLabels(crowded);
assert.equal(arranged.length, 9);
assert.ok(arranged.some((item) => item.moved));
assert.ok(arranged.some((item) => card._zoneLabelLeader(item).includes("nm-zone-label-leader")));
for (let left = 0; left < arranged.length; left += 1) {
  const a = card._labelBox(arranged[left].cx, arranged[left].cy, arranged[left].width, arranged[left].height);
  for (let right = left + 1; right < arranged.length; right += 1) {
    const b = card._labelBox(arranged[right].cx, arranged[right].cy, arranged[right].width, arranged[right].height);
    assert.equal(card._labelOverlapArea(a, b), 0, `Zone labels ${left + 1} and ${right + 1} overlap`);
  }
}

card._layout = {
  scale: 10,
  zones: [
    { id: 1, name: "Front", polygon: [[0, 0], [10, 0], [10, 10], [0, 10]], boundary_flags: [] },
    { id: 2, name: "Back", polygon: [[4, 4], [14, 4], [14, 14], [4, 14]], boundary_flags: [] },
  ],
  offLimits: [],
  vfOff: [],
  channels: [],
  gateAreas: [],
  station: null,
  sx: (value) => 400 + value * 10,
  sy: (value) => 600 - value * 10,
};
card._mapPayload = { coverage: { zones: [{ id: 1, pct: 50 }, { id: 2, pct: 60 }] }, zone_details: [] };
card._baseEl = { innerHTML: "" };
card._detailsEl = { innerHTML: "" };
card._labelsEl = { innerHTML: "" };
card._uiEl = { innerHTML: "" };
card._selectedZoneId = null;
card._renderStatic();
assert.ok(card._labelsEl.innerHTML.includes("Front · 50%"));
assert.ok(card._labelsEl.innerHTML.includes("Back · 60%"));
assert.ok(card._labelsEl.innerHTML.includes("nm-zone-label-leader"));
assert.ok(card._labelsEl.innerHTML.includes('opacity="0.80"'));

console.log("Navimower Map Card smoke tests passed");
