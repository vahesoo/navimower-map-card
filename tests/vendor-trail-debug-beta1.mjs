import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");

assert.doesNotMatch(
  source,
  /0\.3\.7-beta1: vendor retained trail \/ MQTT tail source debug\.|MATCH_RADIUS_M = 0\.5|data-nm-vendor-trail-debug-style|vendorTrailDebugActiveSegments/,
  "temporary beta1 debug implementation must not remain in the consolidated runtime",
);
for (const marker of [
  "0.3.7-beta2: stable vendor backbone / MQTT tail and authenticated OSM tiles.",
  "backend_tail_authoritative",
  "appendLiveAfterAnchor",
  'data-trail-source", "mqtt-tail"',
]) {
  assert.ok(source.includes(marker), `stable vendor trail runtime is missing ${marker}`);
}

console.log("Retired beta1 trail-debug layer; stable vendor/MQTT behavior retained");
