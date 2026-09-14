import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
assert.match(pkg.version, /^0\.3\.(?:6|7)(?:-beta\d+)?$/, "multi-mower regressions must stay valid across the 0.3.6+ series");

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
]) {
  assert.ok(source.includes(token), `missing multi-mower runtime marker: ${token}`);
}

console.log(`${pkg.version} multi-mower regression checks passed`);
