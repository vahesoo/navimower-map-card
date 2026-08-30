import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/navimower-map-card.js", "utf8");

for (const token of [
  "// 0.3.6-beta6: OSM Multi stability and editor visibility.",
  "nm-osm-multi-underlay-layer",
  "card._svgEl.insertBefore(layer, multiLayer)",
  'name: "map_underlay_settings"',
  'title: "Map underlay"',
  'schema?.name === "map_underlay" ? "Map underlay"',
]) {
  assert.ok(source.includes(token), `beta6 OSM fix is missing ${token}`);
}

assert.ok(
  !source.includes('observer.observe(card._multi036Layer, { childList: true })'),
  "OSM must not observe and mutate the same Multi mower layer",
);
assert.ok(
  source.includes('const multiLayer = card?._multi036Layer;') && source.includes('layer.innerHTML = "";'),
  "Multi OSM must use an independent sibling layer and clear it safely",
);

console.log("0.3.6-beta6 OSM Multi stability/editor regression checks passed");
