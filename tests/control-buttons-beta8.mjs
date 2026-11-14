import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync("src/navimower-map-card.js", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
assert.equal(pkg.version, "0.4.0-beta9");

// Both single-mower and multi-mower always show all four controls.
// No hidden Resume button even when the backend returns unavailable.
assert.match(src, /function mowerControlMode\(state\)/);
assert.match(src, /item\.hidden = false;/);
assert.match(src, /card\._controlsEl\.classList\.add\("nm-has-resume"\);/);
assert.match(src, /item\.disabled = !usable;/);
assert.match(src, /mow: kind === "docked" \|\| kind === "returning"/);
assert.match(src, /pause: kind === "mowing"/);
assert.match(src, /dock: kind === "mowing" \|\| kind === "paused"/);
assert.match(src, /"nm-multi-command-grid nm-has-resume"/);
assert.match(src, /const canMow = controlMode === "docked" \|\| controlMode === "returning"/);
assert.match(src, /const canPause = controlMode === "mowing"/);
assert.match(src, /const canDock = controlMode === "mowing" \|\| controlMode === "paused"/);
assert.match(src, /!canResume \|\| unavailable \? " disabled"/);
assert.match(src, /!canMow \|\| unavailable \? " disabled"/);
assert.match(src, /!canPause \|\| unavailable \? " disabled"/);
assert.match(src, /!canDock \|\| unavailable \? " disabled"/);
assert.match(src, /"navimower", service, resumeTarget\(card\)/);
assert.ok(src.includes("var(--disabled-color"));
console.log("beta8: controls always shown, command permissions follow mower state");
