import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ZONE_MARKER_SCALE_DEFAULT,
  extendZoneMarkerConfigForm,
  leaderEndpoint,
  markerTransform,
  normalizeZoneMarkerConfig,
  zoneMarkerScale,
} from "../src/navimower-map-card-v032.js";

assert.equal(ZONE_MARKER_SCALE_DEFAULT, 1);
assert.equal(zoneMarkerScale({}), 1);
assert.equal(zoneMarkerScale({ zone_marker_scale: 0.1 }), 0.5);
assert.equal(zoneMarkerScale({ zone_marker_scale: 9 }), 2.5);
assert.equal(normalizeZoneMarkerConfig({ zone_marker_scale: "1.4" }).zone_marker_scale, 1.4);

const form = {
  schema: [{
    name: "appearance_grid",
    schema: [
      { name: "zone_label_font_size" },
      { name: "zone_label_opacity" },
    ],
  }],
  computeLabel: (schema) => schema.name,
};
const extended = extendZoneMarkerConfigForm(form);
const appearance = extended.schema[0].schema;
assert.equal(appearance[1].name, "zone_marker_scale");
assert.equal(appearance[1].selector.number.min, 0.5);
assert.equal(appearance[1].selector.number.max, 2.5);
assert.equal(appearance[1].selector.number.step, 0.1);
assert.equal(extended.computeLabel({ name: "zone_marker_scale" }), "Zone marker size");

assert.equal(
  markerTransform(100, 200, 2),
  "translate(100.0,200.0) scale(0.50000) translate(-100,-200)",
);
assert.equal(
  markerTransform(100, 200, 1),
  "translate(100.0,200.0) scale(1.00000) translate(-100,-200)",
);

const normalEndpoint = leaderEndpoint({
  anchorX: 0,
  anchorY: 0,
  cx: 100,
  cy: 0,
  width: 40,
  height: 20,
  zoom: 1,
});
assert.deepEqual(normalEndpoint, { x: 80, y: 0 });
const zoomedEndpoint = leaderEndpoint({
  anchorX: 0,
  anchorY: 0,
  cx: 100,
  cy: 0,
  width: 40,
  height: 20,
  zoom: 2,
});
assert.deepEqual(zoomedEndpoint, { x: 90, y: 0 });

const source = readFileSync("src/navimower-map-card-v032.js", "utf8");
const dist = readFileSync("dist/navimower-map-card-v032.js", "utf8");
assert.equal(source, dist);
assert.match(source, /wrapMarkerRefresh\(proto, "_renderMower"\)/);
assert.match(source, /wrapMarkerRefresh\(proto, "_renderShell"\)/);
assert.match(source, /vector-effect="non-scaling-stroke"/);
assert.match(source, /zone-marker:/);

console.log("0.3.0-beta3 zone marker checks passed");
