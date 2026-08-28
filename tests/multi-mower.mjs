import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
assert.equal(pkg.version, "0.3.6-beta1", "multi-mower beta must use the expected prerelease version");

const source = readFileSync("src/navimower-map-card.js", "utf8");
const dist = readFileSync("dist/navimower-map-card.js", "utf8");
assert.equal(dist, source, "dist must remain the deterministic copy of src");

for (const token of [
  "// 0.3.6-beta1: opt-in multi-mower site view.",
  "multi_mower: false",
  "navimower-map-card:multi-mower:",
  'member_order === "west_to_east"',
  "display_order",
  "site_center",
  "svg_matrix",
  "map_api_path",
  "sessions_api_path",
  "session_render_api_path_template",
  "memberEntities036(member)?.notification",
  "nm-multi-button",
  "nm-multi-controls",
  "data-multi-schedule",
  "data-multi-command",
  "data-multi-session-key",
  "MOWER_ICON_SPECS_032",
  "autoMowerIcon032",
  'callService("navimower", "mark_notification_read"',
  'callService("navimower", "mark_all_notifications_read"',
  'callService("navimower", "resume"',
  'callService("lawn_mower", command',
]) {
  assert.ok(source.includes(token), `multi-mower runtime is missing ${token}`);
}

assert.ok(
  source.includes('saved === "1" ? true : saved === "0" ? false : asBool036(card?._config?.multi_mower, false)'),
  "multi-mower preference must be explicit and default to the configured false value",
);
assert.ok(
  !source.includes("_multi036Requested = siteAvailable036"),
  "site discovery must never automatically enable multi-mower mode",
);
assert.ok(
  source.includes('command === "mow"'),
  "multi-mower Mow must remain member-scoped",
);
assert.ok(
  source.includes('command === "dock"') && source.includes("Home command sent"),
  "multi-mower Home button must keep using the mower dock service",
);

console.log("0.3.6-beta1 multi-mower runtime contract checks passed");
