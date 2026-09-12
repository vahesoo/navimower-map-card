import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { applyBeta19Patch, BETA19_MARKER } from "../scripts/upgrade-beta19-gate-area-editor.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = await readFile(resolve(root, "src", "navimower-map-card.js"), "utf8");
const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const notes = await readFile(resolve(root, ".github", "release-notes", "0.3.6-beta19.md"), "utf8");

assert.equal(pkg.version, "0.3.6-beta19");
assert.match(pkg.scripts["prepare-release"], /upgrade-beta18-gate-area-polygons\.mjs.*upgrade-beta19-gate-area-editor\.mjs/);
assert.match(pkg.scripts.test, /beta19-gate-area-editor\.mjs/);

for (const token of [
  BETA19_MARKER,
  'icon="mdi:pencil"',
  'className = "nm-gate19-button"',
  'data-gate19-vertex',
  'data-gate19-midpoint',
  'Add gate area',
  'Remove point',
  'Confirm delete',
  'MAX_POINTS = 64',
  'callService("navimower", "set_gate_area"',
  'callService("navimower", "delete_gate_area"',
  'data.gate_area_id = editor.areaId',
  'data.device_id = editor.target.deviceId',
  'memberGroup19',
  'getScreenCTM',
  '_multi036Members',
  '_multi036MapRenderKey = null',
  'layout.sx(0)',
  'layout.sy(0)',
]) {
  assert.ok(source.includes(token), `prepared runtime must include ${token}`);
}

assert.match(source, /position:absolute;top:10px;right:10px/);
assert.match(source, /editor\.points\.length < 3/);
assert.match(source, /editor\.points\.length <= 3/);
assert.match(source, /editor\.points\.splice\(index, 0, point\)/);
assert.match(source, /screenToLocal19\(card, editor\.target, event\.clientX, event\.clientY\)/);
assert.match(source, /target\.mode === "multi"/);
assert.match(source, /rectanglePolygon19/);
assert.match(source, /event\.stopImmediatePropagation\(\)/);

assert.match(notes, /Navimower 0\.4\.4-beta34 or newer/);
assert.match(notes, /pencil/i);
assert.match(notes, /3–64 points/);

const fixture = [
  "class Fixture {}",
  "// 0.3.6-beta18: exact polygon gate-area rendering in Single and Multi mower views.",
].join("\n");
const once = applyBeta19Patch(fixture);
const twice = applyBeta19Patch(once);
assert.ok(once.includes(BETA19_MARKER));
assert.equal(twice, once, "beta19 patch must be idempotent");
assert.throws(
  () => applyBeta19Patch("class Fixture {}"),
  /requires the beta18 polygon gate-area runtime/,
);

console.log("beta19 gate-area editor contract passed");
