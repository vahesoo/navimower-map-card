import assert from "node:assert/strict";
import fs from "node:fs";

const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const source = fs.readFileSync(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");

assert.equal(pkg.version, "0.4.0-beta6");
assert.match(source, /Number\(this\._mapPayload\?\.contract\?\.version\) < 3/);
assert.match(source, /this\._mapPayload\?\.canonical\?\.cycles\?\.rows/);
assert.match(source, /Number\(payload\?\.contract\?\.version\) < 3/);
assert.match(source, /payload\?\.canonical\?\.cycles\?\.rows/);
assert.doesNotMatch(source, /_mapPayload\?\.zone_states/);
assert.doesNotMatch(source, /payload\?\.zone_states/);
assert.doesNotMatch(source, /zoneStates: payload\?\.zone_states/);
assert.match(source, /v0\.4\.0-beta6 loaded/);

console.log("beta6 canonical cleanup contract OK");
