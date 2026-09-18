import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");

// The temporary beta1 red debug presentation was intentionally superseded by
// the stable beta2 vendor/MQTT tail implementation. Keep regression coverage on
// the final behavior, not on the historical monkey-patch.
assert.ok(!source.includes("__navimower037Beta1VendorTrailDebug"), "obsolete beta1 debug patch must stay removed");
assert.ok(!source.includes("MATCH_RADIUS_M = 0.5"), "obsolete beta1 trail matcher must stay removed");
assert.ok(source.includes("backend_tail_authoritative"), "stable vendor-tail authority handling is required");
assert.ok(source.includes("stableVendorTailSegments"), "stable vendor/MQTT tail resolver is required");
assert.ok(source.includes('data-trail-source", "mqtt-tail"'), "final MQTT tail source tagging is required");
assert.ok(!source.includes('line.setAttribute("stroke", "#ff0000")'), "debug red trail presentation must stay removed");

console.log("0.3.7 vendor/MQTT final-behavior regression checks passed");
