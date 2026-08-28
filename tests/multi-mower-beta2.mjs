import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
assert.equal(pkg.version, "0.3.6-beta2");

const source = readFileSync("src/navimower-map-card.js", "utf8");
const dist = readFileSync("dist/navimower-map-card.js", "utf8");
assert.equal(dist, source, "dist must remain the deterministic copy of src");

for (const token of [
  "// 0.3.6-beta2: multi-mower field-test fixes.",
  "card._multi036Requested = asBool036(card?._config?.multi_mower, false)",
  'const index = node.findIndex((item) => item?.name === "entity")',
  "nm-multi-live-trail",
  "liveTrailSegments036",
  "liveTrailSignature036",
  "siteRotation = Math.atan2(matrix[1], matrix[0])",
  "rootMowers",
  'source: "multi_site_frontend"',
  "primeMemberScheduler036",
  "card._beta2SchedulerIds = ids",
  "hideCoreLayer036(this._scheduleButtonEl, true)",
  "if (this._notificationDialogOpen) renderMultiNotifications036(this)",
]) {
  assert.ok(source.includes(token), `beta2 multi-mower fix is missing ${token}`);
}

assert.ok(
  !source.includes('saved === "1" ? true : saved === "0" ? false : asBool036(card?._config?.multi_mower, false)'),
  "Multi mower must be controlled by card config, not browser-local override state",
);
assert.ok(
  !source.includes("nm-multi-mower-name"),
  "floating mower-name SVG labels must stay removed",
);
assert.ok(
  source.indexOf("parts.push(dockMarkers.join(\"\"));") < source.indexOf("parts.push(rootMowers.join(\"\"));"),
  "mower artwork must render above dock markers",
);
assert.ok(
  !source.includes("second_mower_entity") && !source.includes("multi_mower_entity"),
  "Multi mower must keep automatic Site API membership instead of a second manual mower selector",
);

console.log("0.3.6-beta2 multi-mower field-test regression checks passed");
