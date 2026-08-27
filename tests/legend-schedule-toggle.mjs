import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const source = readFileSync("src/navimower-map-card.js", "utf8");
const upgrade = readFileSync("scripts/upgrade-legend-schedule-toggle.mjs", "utf8");

assert.equal(pkg.version, "0.3.5-beta13");
assert.match(source, /0\.3\.5-beta13: legend visibility follows map toggles and managed schedule gets an enable switch/);

// Legend entries must follow the same visibility toggles as the rendered map.
assert.match(source, /hasChannels && this\._config\.show_channels !== false/);
assert.match(source, /hasGateAreas && this\._config\.show_gate_areas !== false/);
assert.match(source, /this\._config\.show_custom_areas !== false && hasCustomAreas\(this\)/);
assert.match(source, /\[this\._config\.custom_area_color, "Custom area"\]/);
assert.match(source, /_mapPayload\?\.custom_areas/);
assert.match(source, /_customAreaEntities0342/);

// The managed scheduler dialog owns a direct switch control for pause/resume.
assert.match(source, /data-beta13-schedule-enable/);
assert.match(source, /data-beta13-enable-switch/);
assert.match(source, /<ha-switch/);
assert.match(source, /managedSwitch/);
assert.match(source, /callService\("switch", requested \? "turn_on" : "turn_off"/);
assert.match(source, /Turning on…/);
assert.match(source, /Turning off…/);

// Keep the patch deterministic and versioned through prepare-release.
assert.match(upgrade, /Expected beta12 marker was not found/);
assert.match(pkg.scripts["prepare-release"], /upgrade-legend-schedule-toggle\.mjs/);
assert.match(pkg.scripts.test, /legend-schedule-toggle\.mjs/);

console.log("beta13 legend visibility and managed schedule toggle regression checks passed");
