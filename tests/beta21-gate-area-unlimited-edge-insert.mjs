import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { applyBeta19Patch } from "../scripts/upgrade-beta19-gate-area-editor.mjs";
import { applyBeta20Patch } from "../scripts/upgrade-beta20-gate-area-edge-insert.mjs";
import {
  applyBeta21Patch,
  BETA21_MARKER,
} from "../scripts/upgrade-beta21-gate-area-unlimited-edge-insert.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = await readFile(resolve(root, "src", "navimower-map-card.js"), "utf8");
const dist = await readFile(resolve(root, "dist", "navimower-map-card.js"), "utf8");
const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const notes = await readFile(resolve(root, ".github", "release-notes", "0.3.6-beta21.md"), "utf8");

assert.equal(pkg.version, "0.3.6-beta21");
assert.match(pkg.scripts["prepare-release"], /upgrade-beta20-gate-area-edge-insert\.mjs.*upgrade-beta21-gate-area-unlimited-edge-insert\.mjs/);
assert.match(pkg.scripts.test, /beta21-gate-area-unlimited-edge-insert\.mjs/);
assert.equal(dist, source, "dist must match the deterministic prepared runtime");

for (const token of [
  BETA21_MARKER,
  "return index !== null ? { index, distancePx } : null;",
  "Tap anywhere to insert another point on the nearest edge, or use +.",
  "Could not determine the nearest polygon edge. Try again.",
  "nearest.index + 1",
  "polygonSelfIntersects20",
]) {
  assert.ok(source.includes(token), `prepared beta21 runtime must include ${token}`);
}

assert.ok(!source.includes("EDGE_INSERT_THRESHOLD_PX = 28"), "runtime threshold constant must be removed");
assert.ok(!source.includes("distancePx <= EDGE_INSERT_THRESHOLD_PX"), "nearest-edge selection must have no distance limit");
assert.ok(!source.includes("Tap near an existing edge or use + to add another point."), "old near-edge warning must be removed");

const beta19 = applyBeta19Patch([
  "class Fixture {}",
  "// 0.3.6-beta18: exact polygon gate-area rendering in Single and Multi mower views.",
].join("\n"));
const beta20 = applyBeta20Patch(beta19);
assert.ok(beta20.includes("EDGE_INSERT_THRESHOLD_PX = 28"));
const once = applyBeta21Patch(beta20);
const twice = applyBeta21Patch(once);
assert.ok(once.includes(BETA21_MARKER));
assert.ok(!once.includes("EDGE_INSERT_THRESHOLD_PX = 28"));
assert.ok(!once.includes("distancePx <= EDGE_INSERT_THRESHOLD_PX"));
assert.equal(twice, once, "beta21 patch must be idempotent");
assert.throws(
  () => applyBeta21Patch("class Fixture {}"),
  /requires the beta20 edge-aware gate-area editor runtime/,
);

assert.match(notes, /no distance limit/i);
assert.match(notes, /nearest existing edge/i);
assert.match(notes, /first three points/i);
assert.match(notes, /Navimower 0\.4\.4-beta34 or newer/);

console.log("beta21 unrestricted nearest-edge gate-area insertion checks passed");
