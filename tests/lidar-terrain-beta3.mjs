import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const beta3 = await readFile(new URL("../scripts/runtime-v037-beta3.js.txt", import.meta.url), "utf8");
const source = await readFile(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");

for (const marker of [
  "0.3.7-beta3: selectable LiDAR terrain overlay.",
  "mower_local_xy",
  "terrain_overlay_opacity",
  "nm-lidar-terrain-overlay",
  "nm-lidar-terrain-multi-layer",
  "member?.svg_matrix",
  "callApiRaw",
  "fetchWithAuth",
]) {
  assert.ok(beta3.includes(marker), `missing beta3 LiDAR marker: ${marker}`);
  if (marker !== "0.3.7-beta3: selectable LiDAR terrain overlay.") assert.ok(source.includes(marker), `generated runtime is missing beta3 LiDAR capability: ${marker}`);
}
assert.equal(
  (source.match(/0\.3\.7-beta3: selectable LiDAR terrain overlay\./g) || []).length,
  1,
  "beta3 runtime patch must be applied exactly once",
);
assert.equal(beta3.includes("tile.openstreetmap.org"), false);
assert.equal(beta3.includes("mowerbot/vehicle/common/get-iot-file"), false);

class MockCard {}
MockCard.getStubConfig = () => ({ entity: "lawn_mower.test" });
MockCard.getConfigForm = () => ({
  schema: [{ type: "expandable", name: "map_underlay_settings", schema: [] }],
  computeLabel: (schema) => schema?.name || "",
});

const context = {
  console: { info() {}, warn() {}, error() {} },
  customElements: { get: (name) => name === "navimower-map-card" ? MockCard : null },
  setTimeout,
  clearTimeout,
};
context.globalThis = context;
vm.runInNewContext(beta3, context, { filename: "runtime-v037-beta3.js.txt" });

const stub = MockCard.getStubConfig();
assert.equal(stub.terrain_overlay, "none");
assert.equal(stub.terrain_overlay_opacity, 0.65);

const form = MockCard.getConfigForm();
const underlayIndex = form.schema.findIndex((item) => item?.name === "map_underlay_settings");
const terrainIndex = form.schema.findIndex((item) => item?.name === "terrain_overlay_settings");
assert.ok(underlayIndex >= 0);
assert.equal(terrainIndex, underlayIndex + 1);
const fields = form.schema[terrainIndex].schema[0].schema;
const kindField = fields.find((item) => item?.name === "terrain_overlay");
const opacityField = fields.find((item) => item?.name === "terrain_overlay_opacity");
assert.ok(kindField);
assert.ok(opacityField);
assert.equal(
  JSON.stringify(Array.from(kindField.selector.select.options, (item) => item.value)),
  JSON.stringify(["none", "terrain", "elevation"]),
);
assert.equal(opacityField.selector.number.min, 0.1);
assert.equal(opacityField.selector.number.max, 1);
assert.equal(opacityField.selector.number.step, 0.05);
assert.equal(form.computeLabel({ name: "terrain_overlay" }), "LiDAR overlay");
assert.equal(form.computeLabel({ name: "terrain_overlay_opacity" }), "LiDAR opacity");

console.log("0.3.7-beta3 LiDAR terrain overlay checks passed");
