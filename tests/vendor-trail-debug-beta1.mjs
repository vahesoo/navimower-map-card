import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");
for (const marker of [
  "0.3.7-beta1: vendor retained trail / MQTT tail source debug.",
  "backend_tail_authoritative",
  "data-trail-source",
  "#ff0000",
  "MATCH_RADIUS_M = 0.5",
]) {
  assert.ok(source.includes(marker), `missing vendor trail debug marker: ${marker}`);
}
assert.equal(
  (source.match(/0\.3\.7-beta1: vendor retained trail \/ MQTT tail source debug\./g) || []).length,
  1,
  "vendor trail beta patch must be applied exactly once",
);
console.log("0.3.7-beta1 vendor/MQTT trail debug checks passed");
