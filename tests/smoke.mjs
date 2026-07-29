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

console.log("Navimower Map Card smoke tests passed");
