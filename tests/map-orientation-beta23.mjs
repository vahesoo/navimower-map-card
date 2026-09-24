import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

assert.equal(pkg.version, "0.3.7-beta23");

for (const needle of [
  "_mapPresentationInverseMatrix",
  "_mapPresentationSourceCorners",
  "_mapPresentationInverseBox",
  "presentationMarkerTransform",
  "dockMarkerTransform",
  "inversePresentationMatrixString",
  'wrapMarkerRefresh(proto, "_syncMapPresentationRotation")',
  'card?._multi036Layer',
  'card?._mapPresentationSourceCorners?.() || []',
  'data-marker-cx=',
  'data-dock-scale=',
]) {
  assert.ok(source.includes(needle), `Missing beta23 orientation/underlay contract: ${needle}`);
}

const markerStart = source.indexOf("function applyZoneMarkerScale(card) {");
const markerEnd = source.indexOf("function wrapMarkerRefresh", markerStart);
assert.ok(markerStart >= 0 && markerEnd > markerStart, "Presentation marker refresh contract missing");
const markerBody = source.slice(markerStart, markerEnd);
assert.ok(markerBody.includes("[card?._labelsEl, card?._multi036Layer]"), "Single and Multi zone labels must be counter-rotated");
assert.ok(markerBody.includes("[card?._detailsEl, card?._multi036Layer]"), "Single and Multi dock markers must be counter-rotated");
assert.ok(markerBody.includes('querySelector?.(".nm-multi-map-legend")'), "Multi legend must be counter-transformed");
assert.ok(markerBody.includes("inversePresentationMatrixString(card)"), "Multi legend must cancel the scene presentation transform");

assert.ok(
  !source.includes('const gateLabel = gate.name || "Gate area"')
    && !source.includes('const gateLabel = channel.name || "Gate area"'),
  "Gate-area text labels must no longer be rendered",
);
assert.ok(
  !source.includes("labels.push(card._label(cx, cy, area.name, 19))"),
  "Custom-area text labels must no longer be rendered",
);
assert.ok(
  source.includes('card._labelsEl?.querySelector?.(".nm-custom-area-labels")?.remove?.();'),
  "Custom-area refresh must clean any stale label group from an older render",
);

const sourceCornerUses = source.match(/_mapPresentationSourceCorners\?\.\(\) \|\| \[\]/g) || [];
assert.ok(sourceCornerUses.length >= 4, "Base tiles and Estonia detail must both use presentation-aware viewport coverage");

const singleUnderlayStart = source.indexOf("const syncSingle = (card) => {");
const multiUnderlayStart = source.indexOf("const syncMulti = (card) => {", singleUnderlayStart);
assert.ok(singleUnderlayStart >= 0 && multiUnderlayStart > singleUnderlayStart, "Underlay sync contract missing");
assert.ok(
  source.slice(singleUnderlayStart, multiUnderlayStart).includes("_mapPresentationSourceCorners"),
  "Single underlay must overscan the inverse-transformed viewport",
);
assert.ok(
  source.slice(multiUnderlayStart, source.indexOf("const syncCard = (card) => {", multiUnderlayStart)).includes("_mapPresentationSourceCorners"),
  "Multi underlay must overscan the inverse-transformed viewport",
);

console.log("Map orientation beta23 regression checks passed");
