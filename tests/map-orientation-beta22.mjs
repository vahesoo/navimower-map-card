import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

assert.match(pkg.version, /^0\.3\.7(?:-|$)/);

for (const needle of [
  'map_orientation: "native"',
  'map_rotation: 0',
  'title: "Map zoom and rotate"',
  '{ value: "native", label: "Native" }',
  '{ value: "north_up", label: "North up" }',
  '{ value: "custom", label: "Custom" }',
  'visible: { field: "map_orientation", value: "custom" }',
  'min: -180, max: 180, step: 1',
  '["native", "north_up", "custom"].includes(mapOrientation)',
  'if (this._multiMapPresentationActive()) return desired;',
  'return desired - nativeRotation;',
  '_mapPresentationTransformPoint',
  '_mapPresentationClientToRoot',
  '_syncMapPresentationRotation',
  'this._osm036MultiLayer',
  'this._nm037Beta3MultiTerrainLayer',
  'presentationFit',
]) {
  assert.ok(source.includes(needle), `Missing beta22 map-orientation contract: ${needle}`);
}

assert.ok(
  source.includes(
    'this._config.map_rotation = clamp(finiteNumber(incoming.map_rotation, DEFAULTS.map_rotation), -180, 180);',
  ),
  "Custom rotation must retain decimal YAML values while clamping the supported range",
);
assert.ok(
  !source.includes("Math.round(incoming.map_rotation"),
  "YAML custom rotation must not be rounded to the editor slider step",
);

const nodesStart = source.indexOf("  _mapPresentationNodes() {");
const nodesEnd = source.indexOf("  _setMapPresentationTransform(", nodesStart);
assert.ok(nodesStart >= 0 && nodesEnd > nodesStart, "Map presentation node contract missing");
const nodesBody = source.slice(nodesStart, nodesEnd);

for (const needle of [
  "this._baseEl",
  "this._mowedAreaEl",
  "this._highlightEl",
  "this._detailsEl",
  "this._labelsEl",
  "this._dynamicEl",
  "this._osm036MultiLayer",
  "this._nm037Beta3MultiTerrainLayer",
  "this._multi036Layer",
]) {
  assert.ok(nodesBody.includes(needle), `Map presentation layer missing: ${needle}`);
}
assert.ok(!nodesBody.includes("this._uiEl"), "Screen UI/legend must remain upright");

assert.ok(
  source.includes(
    'const root = card?._mapPresentationClientToRoot?.(clientX, clientY)',
  ),
  "Single gate editor must inverse-map pointer coordinates through presentation rotation",
);
assert.ok(
  source.includes(
    'return card?._mapPresentationTransformPoint?.(root[0], root[1]) || root;',
  ),
  "Single gate editor must present local polygon points through map rotation",
);

console.log("Map orientation beta22 regression checks passed");
