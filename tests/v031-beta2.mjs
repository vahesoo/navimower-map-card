import assert from "node:assert/strict";

class FakeCard {
  static getStubConfig() {
    return { entity: "", title: "Navimower Map" };
  }

  static getConfigForm() {
    return {
      schema: [
        {
          name: "appearance",
          schema: [
            {
              name: "appearance_grid",
              schema: [
                { name: "trail_opacity", selector: { number: {} } },
                { name: "map_background_color", selector: { text: {} } },
              ],
            },
          ],
        },
      ],
      computeLabel: (schema) => schema?.name === "trail_opacity" ? "Mowed area opacity" : schema?.name,
    };
  }

  setConfig(config) {
    this._config = config;
  }

  _ensureDom() {}
  _renderStatic() {}
  _applyStaticLayers() {}
}

globalThis.customElements = {
  get(name) {
    return name === "navimower-map-card" ? FakeCard : undefined;
  },
};

const {
  OUTLINE_DEFAULTS,
  applyOutlineSettings,
  extendConfigForm,
  normalizeOutlineConfig,
} = await import("../src/navimower-map-card-v031.js");

const expectedFields = [
  "zone_stroke_width",
  "off_limit_stroke_width",
  "vf_off_stroke_width",
  "channel_stroke_width",
  "gate_area_stroke_width",
  "dock_stroke_width",
];

const stub = FakeCard.getStubConfig();
for (const field of expectedFields) {
  assert.equal(stub[field], OUTLINE_DEFAULTS[field]);
}

const form = FakeCard.getConfigForm();
const appearanceGrid = form.schema[0].schema[0];
const names = appearanceGrid.schema.map((field) => field.name);
for (const field of expectedFields) {
  assert.equal(names.filter((name) => name === field).length, 1);
  const entry = appearanceGrid.schema.find((item) => item.name === field);
  assert.equal(entry.selector.number.mode, "slider");
  assert.equal(entry.selector.number.unit_of_measurement, "px");
}
assert.equal(form.computeLabel({ name: "zone_stroke_width" }), "Zone border width");
assert.equal(form.computeLabel({ name: "trail_opacity" }), "Mowed area opacity");

// Extending an already extended form must not duplicate controls.
extendConfigForm(form);
for (const field of expectedFields) {
  assert.equal(appearanceGrid.schema.filter((item) => item.name === field).length, 1);
}

const configured = new FakeCard();
configured.setConfig({
  entity: "lawn_mower.test",
  zone_stroke_width: 0.1,
  off_limit_stroke_width: 20,
  channel_stroke_width: "4.5",
});
assert.equal(configured._config.zone_stroke_width, 0.5);
assert.equal(configured._config.off_limit_stroke_width, 12);
assert.equal(configured._config.channel_stroke_width, 4.5);
assert.equal(configured._config.vf_off_stroke_width, OUTLINE_DEFAULTS.vf_off_stroke_width);

assert.deepEqual(normalizeOutlineConfig(null), OUTLINE_DEFAULTS);

function element() {
  return {
    attributes: {},
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
  };
}

const zone = element();
const offLimit = element();
const vfOff = element();
const channel = element();
const gate = element();
const dock = element();
const groups = new Map([
  ["line", [zone]],
  ['polygon[fill-opacity=".08"]', [offLimit]],
  ['polygon[fill-opacity=".06"]', [vfOff]],
  ['polyline[stroke-dasharray="12 8"]', [channel]],
  ['rect[stroke-dasharray="10 6"]', [gate]],
  [".nm-dock-marker rect", [dock]],
]);
const details = {
  querySelectorAll(selector) {
    return groups.get(selector) || [];
  },
};

applyOutlineSettings({
  _detailsEl: details,
  _config: {
    zone_stroke_width: 1.5,
    off_limit_stroke_width: 2,
    vf_off_stroke_width: 2.5,
    channel_stroke_width: 3,
    gate_area_stroke_width: 3.5,
    dock_stroke_width: 4,
  },
});

for (const item of [zone, offLimit, vfOff, channel, gate, dock]) {
  assert.equal(item.attributes["vector-effect"], "non-scaling-stroke");
}
assert.equal(zone.attributes["stroke-width"], "1.5");
assert.equal(offLimit.attributes["stroke-width"], "2");
assert.equal(vfOff.attributes["stroke-width"], "2.5");
assert.equal(channel.attributes["stroke-width"], "3");
assert.equal(gate.attributes["stroke-width"], "3.5");
assert.equal(dock.attributes["stroke-width"], "4");

console.log("0.3.0-beta2 outline checks passed");
