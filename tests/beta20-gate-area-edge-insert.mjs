import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { applyBeta19Patch } from "../scripts/upgrade-beta19-gate-area-editor.mjs";
import {
  applyBeta20Patch,
  BETA20_MARKER,
  EDGE_INSERT_THRESHOLD_PX,
  nearestEdgeIndex20,
  polygonSelfIntersects20,
} from "../scripts/upgrade-beta20-gate-area-edge-insert.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = await readFile(resolve(root, "src", "navimower-map-card.js"), "utf8");
const dist = await readFile(resolve(root, "dist", "navimower-map-card.js"), "utf8");
const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const notes = await readFile(resolve(root, ".github", "release-notes", "0.3.6-beta20.md"), "utf8");

assert.equal(pkg.version, "0.3.6-beta20");
assert.match(pkg.scripts["prepare-release"], /upgrade-beta19-gate-area-editor\.mjs.*upgrade-beta20-gate-area-edge-insert\.mjs/);
assert.match(pkg.scripts.test, /beta20-gate-area-edge-insert\.mjs/);
assert.equal(dist, source, "dist must match the deterministic prepared runtime");
assert.equal(EDGE_INSERT_THRESHOLD_PX, 28);

for (const token of [
  BETA20_MARKER,
  "EDGE_INSERT_THRESHOLD_PX = 28",
  "nearestEdge20",
  "distanceToSegment20",
  "polygonSelfIntersects20",
  "Tap the map to add the first 3 corner points.",
  "Tap near an existing edge or use + to add another point.",
  "Fix crossing edges before saving.",
  "Polygon edges must not cross.",
  "invalidGeometry ? \"var(--error-color,#db4437)\"",
  "editor.points.splice(index, 0, local)",
  "nearest.index + 1",
]) {
  assert.ok(source.includes(token), `prepared beta20 runtime must include ${token}`);
}

assert.match(source, /editor\.creating && editor\.points\.length < 3/);
assert.match(source, /distancePx <= EDGE_INSERT_THRESHOLD_PX/);
assert.match(source, /save\.disabled = editor\.busy \|\| editor\.points\.length < 3 \|\| invalidGeometry/);
assert.ok(!source.includes("if (editor.creating && local && editor.points.length < MAX_POINTS)"), "free point appending after three points must be removed");

const square = [[0, 0], [10, 0], [10, 10], [0, 10]];
assert.deepEqual(nearestEdgeIndex20(square, [5, -2]), { index: 0, distance: 2 });
assert.deepEqual(nearestEdgeIndex20(square, [12, 5]), { index: 1, distance: 2 });
assert.equal(polygonSelfIntersects20(square), false);
assert.equal(polygonSelfIntersects20([[0, 0], [10, 10], [0, 10], [10, 0]]), true);
assert.equal(polygonSelfIntersects20([[0, 0], [10, 0], [5, 5]]), false);

const fixture = applyBeta19Patch([
  "class Fixture {}",
  "// 0.3.6-beta18: exact polygon gate-area rendering in Single and Multi mower views.",
].join("\n"));
const once = applyBeta20Patch(fixture);
const twice = applyBeta20Patch(once);
assert.ok(once.includes(BETA20_MARKER));
assert.equal(twice, once, "beta20 patch must be idempotent");
assert.throws(
  () => applyBeta20Patch("class Fixture {}"),
  /requires the beta19 visual gate-area editor runtime/,
);

assert.match(notes, /first three points/i);
assert.match(notes, /28 px/i);
assert.match(notes, /self-intersection/i);
assert.match(notes, /Navimower 0\.4\.4-beta34 or newer/);

console.log("beta20 edge-aware gate-area editor checks passed");
