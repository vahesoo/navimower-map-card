import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

assert.equal(pkg.version, "0.3.7-beta27");

for (const needle of [
  "function continueTaskServiceAvailable(hass)",
  "function taskResumeContract(hass, frontend)",
  'source: "task_progress"',
  'source: "map_api"',
  'return continueTaskServiceAvailable(hass) && contract.available === true;',
  'const service = contract && continueTaskServiceAvailable(card._hass) ? "continue_task" : "resume";',
  'await card._hass.callService("navimower", service, resumeTarget(card));',
  'const resumeContract = typeof taskResumeContract === "function" ? taskResumeContract(card._hass, resumeFrontend) : null;',
  'const service = contract && continueTaskServiceAvailable(card._hass) ? "continue_task" : "resume";',
]) {
  assert.ok(source.includes(needle), `Missing beta27 Resume contract: ${needle}`);
}

for (const needle of [
  ".nm-controls:not(.nm-has-resume) .nm-control.nm-mow { grid-column: 1 / -1; }",
  ".nm-controls.nm-has-resume .nm-control.nm-resume,",
  ".nm-controls.nm-has-resume .nm-control.nm-mow { grid-column: auto;",
  "background: var(--primary-color, #03a9f4);",
  "box-shadow: none;",
  ".nm-multi-command-grid:not(.nm-has-resume) [data-multi-command=mow]{grid-column:1/-1}",
  ".nm-multi-command-grid [data-multi-command=mow],.nm-multi-command-grid [data-multi-command=resume]",
]) {
  assert.ok(source.includes(needle), `Missing beta27 primary control layout: ${needle}`);
}

assert.ok(
  !source.includes("box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary-color, #03a9f4) 45%, transparent);"),
  "legacy light-blue Mow outline must be removed",
);

for (const needle of [
  "Card.lidarSupportedEntities037",
  "rememberLidarFrontend",
  "frontend?.terrain_overlay?.supported",
  "rememberLidarCapability(card)",
  "Array.from(lidarSupportedEntities)",
]) {
  assert.ok(source.includes(needle), `Missing beta27 integration LiDAR capability contract: ${needle}`);
}

assert.ok(
  !source.includes('String(state?.attributes?.model_family || "").toLowerCase() === "i2_lidar"'),
  "LiDAR editor visibility must not infer capability from model_family",
);
assert.ok(
  !source.includes('autoMowerIcon032(state?.attributes?.model) === "i2_lidar"'),
  "LiDAR editor visibility must not infer capability from mower artwork model detection",
);

console.log("0.3.7-beta27 Resume, LiDAR capability, and control layout checks passed");
