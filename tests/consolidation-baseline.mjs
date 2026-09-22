import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/navimower-map-card.js", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const normalizedSource = source.replaceAll(pkg.version, "0.3.7-beta9");
const infoLogs = source.match(/console\.info\(/g) || [];
const sourceSections = source.match(/^\/\/ src\//gm) || [];
const patchMarkers = new Set([...source.matchAll(/__navimower[0-9A-Za-z_]+/g)].map((match) => match[0]));
const iifes = source.match(/\(\(\)\s*=>\s*\{/g) || [];
const setConfigWrappers = source.match(/(?:proto|Card\.prototype)\.setConfig\s*=\s*function/g) || [];
const ensureDomWrappers = source.match(/(?:proto|Card\.prototype)\._ensureDom\s*=\s*function/g) || [];
const renderHistoryBarWrappers = source.match(/(?:proto|Card\.prototype)\._renderHistoryBar\s*=\s*function/g) || [];
const renderHistoryWrappers = source.match(/(?:proto|Card\.prototype)\._renderHistory\s*=\s*function/g) || [];
const renderMowerWrappers = source.match(/(?:proto|Card\.prototype)\._renderMower\s*=\s*function/g) || [];
const renderTrailWrappers = source.match(/(?:proto|Card\.prototype)\._renderTrail\s*=\s*function/g) || [];
const applyMapPayloadWrappers = source.match(/(?:proto|Card\.prototype)\._applyMapPayload\s*=\s*function/g) || [];

assert.equal(infoLogs.length, 1, "production runtime must expose exactly one informational startup log");
assert.ok(
  source.includes(`console.info("[Navimower Map Card] v${pkg.version} loaded");`),
  "startup log must match the current package version",
);
assert.ok(!source.includes('NAVIMOWER_MAP_CARD_VERSION = "0.2.2"'), "legacy core version marker must stay removed");
assert.match(source, /SCHEDULE_CLOSE_DELAY_MS = 2500/, "successful schedule save must retain the 2.5 s close delay");
assert.match(source, /_v034sScheduleCloseTimer/, "schedule close timer cleanup must stay in the cumulative runtime");

// Upper bounds for the consolidated runtime. Normalize only the release
// version text so beta number width cannot look like production code growth.
// beta14 fixes the final runtime Map API override without adding another
// wrapper/IIFE layer or expanding the beta13 feature budget.
assert.ok(normalizedSource.length <= 864000, `runtime grew beyond beta14 feature budget: ${normalizedSource.length} normalized chars`);
assert.ok(sourceSections.length <= 12, `source section count grew: ${sourceSections.length}`);
assert.ok(patchMarkers.size <= 43, `runtime patch marker count grew: ${patchMarkers.size}`);
assert.ok(iifes.length <= 50, `runtime patch IIFE count grew: ${iifes.length}`);
assert.ok(setConfigWrappers.length <= 8, `setConfig wrapper count grew: ${setConfigWrappers.length}`);
assert.ok(ensureDomWrappers.length <= 7, `_ensureDom wrapper count grew: ${ensureDomWrappers.length}`);
assert.ok(renderHistoryBarWrappers.length <= 1, `_renderHistoryBar wrapper count grew: ${renderHistoryBarWrappers.length}`);
assert.ok(renderHistoryWrappers.length <= 1, `_renderHistory wrapper count grew: ${renderHistoryWrappers.length}`);
assert.ok(renderMowerWrappers.length <= 1, `_renderMower wrapper count grew: ${renderMowerWrappers.length}`);
assert.ok(renderTrailWrappers.length <= 1, `_renderTrail wrapper count grew: ${renderTrailWrappers.length}`);
assert.ok(applyMapPayloadWrappers.length <= 1, `_applyMapPayload wrapper count grew: ${applyMapPayloadWrappers.length}`);

console.log(
  `Consolidation baseline: ${source.length} chars, ${sourceSections.length} sections, ${patchMarkers.size} patch markers, ${iifes.length} IIFEs, ${setConfigWrappers.length} setConfig wrappers, ${ensureDomWrappers.length} _ensureDom wrappers, ${renderHistoryBarWrappers.length} _renderHistoryBar wrappers, ${renderHistoryWrappers.length} _renderHistory wrappers, ${renderMowerWrappers.length} _renderMower wrappers, ${renderTrailWrappers.length} _renderTrail wrappers, ${applyMapPayloadWrappers.length} _applyMapPayload wrappers`,
);
