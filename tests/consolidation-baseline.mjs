import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/navimower-map-card.js", "utf8");
const infoLogs = source.match(/console\.info\(/g) || [];
const sourceSections = source.match(/^\/\/ src\//gm) || [];
const patchMarkers = new Set([...source.matchAll(/__navimower[0-9A-Za-z_]+/g)].map((match) => match[0]));
const iifes = source.match(/\(\(\)\s*=>\s*\{/g) || [];
const setConfigWrappers = source.match(/(?:proto|Card\.prototype)\.setConfig\s*=\s*function/g) || [];
const ensureDomWrappers = source.match(/(?:proto|Card\.prototype)\._ensureDom\s*=\s*function/g) || [];

assert.equal(infoLogs.length, 1, "production runtime must expose exactly one informational startup log");
assert.match(source, /console\.info\("\[Navimower Map Card\] v0\.3\.7-beta9 loaded"\);/);
assert.ok(!source.includes('NAVIMOWER_MAP_CARD_VERSION = "0.2.2"'), "legacy core version marker must stay removed");
assert.match(source, /SCHEDULE_CLOSE_DELAY_MS = 2500/, "successful schedule save must retain the 2.5 s close delay");
assert.match(source, /_v034sScheduleCloseTimer/, "schedule close timer cleanup must stay in the cumulative runtime");

// Temporary upper bounds for the consolidation branch. Tighten these as patches
// are folded into the canonical implementation. They prevent accidental growth
// while preserving the beta9 behavior baseline during the refactor.
assert.ok(source.length <= 827093, `runtime grew during consolidation: ${source.length} chars`);
assert.ok(sourceSections.length <= 12, `source section count grew: ${sourceSections.length}`);
assert.ok(patchMarkers.size <= 44, `runtime patch marker count grew: ${patchMarkers.size}`);
assert.ok(iifes.length <= 51, `runtime patch IIFE count grew: ${iifes.length}`);
assert.ok(setConfigWrappers.length <= 15, `setConfig wrapper count grew: ${setConfigWrappers.length}`);
assert.ok(ensureDomWrappers.length <= 13, `_ensureDom wrapper count grew: ${ensureDomWrappers.length}`);

console.log(
  `Consolidation baseline: ${source.length} chars, ${sourceSections.length} sections, ${patchMarkers.size} patch markers, ${iifes.length} IIFEs, ${setConfigWrappers.length} setConfig wrappers, ${ensureDomWrappers.length} _ensureDom wrappers`,
);
