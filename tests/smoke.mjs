import assert from "node:assert/strict";

const registry = new Map();
globalThis.HTMLElement = class {};
globalThis.customElements = {
  define(name, constructor) { registry.set(name, constructor); },
  get(name) { return registry.get(name); },
};
globalThis.window = { customCards: [] };
globalThis.Event = class {
  constructor(type, options = {}) {
    this.type = type;
    Object.assign(this, options);
  }
};

await import("../src/navimower-map-card.js");

const Card = customElements.get("navimower-map-card");
assert.equal(typeof Card, "function");
assert.equal(window.customCards.length, 1);
assert.equal(window.customCards[0].type, "navimower-map-card");
assert.deepEqual(
  window.customCards[0].getEntitySuggestion({}, "sensor.temperature"),
  null,
);
assert.equal(
  window.customCards[0].getEntitySuggestion({}, "lawn_mower.tont").config.entity,
  "lawn_mower.tont",
);

const stub = Card.getStubConfig();
assert.equal(stub.auto_entities, true);
assert.equal(stub.initial_focus, "map");
const form = Card.getConfigForm();
assert.ok(Array.isArray(form.schema));
assert.ok(form.schema.length >= 5);

const card = new Card();
card._config = { auto_entities: true };
card._hass = {
  states: {
    "sensor.tont_map_data": { state: "loaded" },
    "sensor.tont_position_x": { state: "1" },
    "sensor.tont_position_y": { state: "2" },
    "sensor.tont_heading": { state: "3" },
    "sensor.tont_battery": { state: "80" },
    "sensor.tont_current_physical_zone": { state: "Back yard" },
  },
};
const resolved = card._resolveEntitiesByName({ mower_entity: "lawn_mower.tont" });
assert.equal(resolved.map_entity, "sensor.tont_map_data");
assert.equal(resolved.zone_entity, "sensor.tont_current_physical_zone");
assert.deepEqual(card._normalizePoints([[1, 2], ["3", "4"], ["bad", 5]]), [[1, 2], [3, 4]]);

card._config = {
  trail_color: "#43a047", obstacle_color: "#616161", no_mow_color: "#bdbdbd",
  channel_color: "#8e24aa", tunnel_color: "#039be5", map_legend_opacity: 0.58,
  mower_scale: 1, dock_scale: 1, dock_color: "#37474f", zone_label_font_size: 20,
};
card._resolved = { map_entity: "sensor.tont_map_data" };
card._layout = {
  zones: [{ id: 13, name: "Zone 5", boundary: { height_set: 256 } }],
};
card._mapPayload = {
  cut_height: 30,
  coverage: { zones: [{ id: 13, pct: 72 }] },
  zone_details: [{
    id: 13,
    last_mowed_at: "2026-07-29T12:54:00+03:00",
    last_completed_at: "2026-07-28T18:16:00+03:00",
  }],
};
const zoneDetails = card._zoneDetails(13);
assert.equal(zoneDetails.name, "Zone 5");
assert.equal(zoneDetails.progress, 72);
assert.equal(zoneDetails.cuttingHeight, 30);
assert.equal(zoneDetails.inheritedHeight, true);
const legend = card._legend(false, false);
assert.ok(legend.includes("Mowed"));
assert.ok(!legend.includes(">Mower<"));
assert.ok(!legend.includes(">Dock<"));
assert.ok(card._mower(100, 100, 0).includes("nm-h2-mower"));
assert.ok(card._station(100, 100).includes("nm-dock-marker"));

console.log("Navimower Map Card smoke tests passed");
