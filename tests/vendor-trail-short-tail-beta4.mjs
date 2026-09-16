import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const runtime = await readFile(new URL("../scripts/runtime-v037-beta4.js.txt", import.meta.url), "utf8");
const sync = await readFile(new URL("../scripts/sync-version.mjs", import.meta.url), "utf8");
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

assert.equal(pkg.version, "0.3.7-beta4");
assert.match(runtime, /vendor backbone with short live MQTT tail/);
assert.match(runtime, /MAX_TAIL_DISTANCE_M = 8\.0/);
assert.match(runtime, /backend_tail_authoritative/);
assert.match(runtime, /trimNewestSegment/);
assert.match(runtime, /mqtt-live-tail-short/);
assert.match(runtime, /previousActiveTrailSegments\.apply\(this, args\)/);
assert.match(sync, /runtime-v037-beta4\.js\.txt/);
assert.match(sync, /beta4Marker/);

console.log("0.3.7-beta4 vendor-backbone short-tail contract OK");
