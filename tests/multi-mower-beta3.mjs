import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
assert.equal(pkg.version, "0.3.6-beta3");

const source = readFileSync("src/navimower-map-card.js", "utf8");
const dist = readFileSync("dist/navimower-map-card.js", "utf8");
assert.equal(dist, source, "dist must remain the deterministic copy of src");

for (const token of [
  "// 0.3.6-beta3: compact multi-mower metadata and labels.",
  "map_legend_scale: 1",
  'map_legend_scale: "Map legend size"',
  '{ name: "map_legend_scale", selector: { number: { min: 0.5, max: 2, step: 0.1, mode: "slider" } } }',
  "zoneLabelItem036",
  "renderMultiZoneLabels036",
  'card._pill(item.cx, item.cy, item.value, null)',
  'name + " · " + Math.round(pct) + "%"',
  "nm-multi-meta-zone",
  "nm-multi-meta-battery",
  "mdi:map-marker-radius",
  "mdi:battery",
  "entities.current_physical_zone",
  "c.show_status !== false",
  "c.show_zone !== false",
  "c.show_battery !== false",
  "c.show_position === true",
  "originalRenderFooter036",
  'this._footerEl.style.display = "none"',
  'scale(" + legendScale.toFixed(2) + ")',
]) {
  assert.ok(source.includes(token), `beta3 multi-mower UI is missing ${token}`);
}

assert.ok(
  source.includes("card._layoutZoneLabels(sourceItems, obstacles)"),
  "Multi mower labels must reuse the Single-view overlap layout",
);
assert.ok(
  source.includes("card._zoneLabelLeader(item)"),
  "Multi mower labels must reuse the Single-view leader-line behavior",
);
assert.ok(
  !source.includes("const zoneLabel036 ="),
  "old plain-text Multi mower zone labels must stay removed",
);
assert.ok(
  source.includes("hideCoreLayer036(card._footerEl, true)"),
  "Single footer must stay hidden while Multi mower mode is active",
);

console.log("0.3.6-beta3 multi-mower compact UI regression checks passed");
