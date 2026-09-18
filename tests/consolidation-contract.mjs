import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/navimower-map-card.js", "utf8");

const patchMarkers = new Set([...source.matchAll(/__navimower[A-Za-z0-9_]+/g)].map((match) => match[0]));
const patchIifes = (source.match(/\(\(\)\s*=>\s*\{/g) || []).length;
const prototypeAssignments = [...source.matchAll(/(?:Card\.prototype|proto(?:\w+)?)\.([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function\b/g)];
const overrides = new Map();
for (const match of prototypeAssignments) overrides.set(match[1], (overrides.get(match[1]) || 0) + 1);

assert.ok(Buffer.byteLength(source) <= 830_000, "runtime must not grow beyond the beta9 consolidation baseline");
const allowedMarkers = new Set([
  "__navimowerConsolidatedRuntime",
  "__navimowerRuntimeCard",
  "__navimowerRuntimeAlreadyApplied",
  "__navimowerBeta14SettingsBackdrop",
  "__navimowerBeta14ScheduleBackdrop",
  "__navimower036EstoniaSite",
]);
assert.deepEqual(
  [...patchMarkers].filter((marker) => !allowedMarkers.has(marker)),
  [],
  "historical per-patch runtime guards must not return",
);
assert.ok(patchIifes <= 53, "historical patch-IIFE count must only move downward during consolidation");
assert.ok(prototypeAssignments.length <= 194, "prototype wrapper count must only move downward during consolidation");
assert.ok((overrides.get("setConfig") || 0) <= 22, "setConfig wrapper depth must not increase");
assert.ok((overrides.get("_ensureDom") || 0) <= 15, "_ensureDom wrapper depth must not increase");
assert.ok((overrides.get("_renderDialog") || 0) <= 13, "_renderDialog wrapper depth must not increase");
assert.ok((overrides.get("_applyMapPayload") || 0) <= 6, "_applyMapPayload wrapper depth must not increase");

assert.doesNotMatch(source, /var NAVIMOWER_MAP_CARD_VERSION = "0\.2\.2";/, "legacy core version constant must not return");
assert.doesNotMatch(source, /%c NAVIMOWER-MAP-CARD %c v\$\{/, "legacy styled version banners must not return");
assert.equal(
  (source.match(/console\.info\("\[Navimower Map Card\] v[^"]+ loaded"\);/g) || []).length,
  1,
  "runtime must expose exactly one current-version informational startup line",
);

console.log("Runtime consolidation guard checks passed");
