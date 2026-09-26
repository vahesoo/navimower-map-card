import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

assert.match(pkg.version, /^0\.3\.7(?:-|$)/);

for (const needle of [
  "DISPLAY_GROUPS",
  'heading: "display_mower_group"',
  'heading: "display_map_group"',
  'heading: "display_history_group"',
  'heading: "display_header_group"',
  'fields: ["show_status", "show_zone", "show_battery", "show_position"]',
  '"show_zone_labels", "avoid_zone_label_overlap", "show_vf_off_areas", "show_gate_areas", "show_channels", "show_custom_areas", "show_map_legend"',
  'fields: ["show_session_legend", "history_days"]',
  'show_status: "Status"',
  'show_zone: "Physical zone"',
  'show_battery: "Battery"',
  'show_position: "X/Y position"',
  'show_zone_labels: "Zone labels"',
  'show_custom_areas: "Custom areas"',
  'show_history_button: "History"',
  'show_notifications_button: "Notifications"',
  'show_schedule_button: "Schedule"',
  'show_settings_button: "Quick settings"',
  'type: "constant", name: group.heading',
]) {
  assert.ok(source.includes(needle), `Missing beta24 editor grouping contract: ${needle}`);
}

for (const obsolete of [
  'show_status: "Show status"',
  'show_zone: "Show physical zone"',
  'show_battery: "Show battery"',
  'show_position: "Show X/Y position"',
  'show_zone_labels: "Show zone labels"',
  'show_history_button: "Show History button"',
  'show_notifications_button: "Show Notifications button"',
  'show_schedule_button: "Show Schedule button"',
  'show_settings_button: "Show Settings button"',
]) {
  assert.ok(!source.includes(obsolete), `Obsolete Show-prefixed editor label remains: ${obsolete}`);
}

for (const needle of [
  "Card.lidarSupportedEntities037",
  "rememberLidarFrontend",
  "frontend?.terrain_overlay?.supported",
  "Array.from(lidarSupportedEntities)",
  '{ field: "entity", operator: "in", value: lidarEntities }',
  '{ field: "multi_mower", operator: "eq", value: true }',
  '{ field: "terrain_overlay", operator: "in", value: ["terrain", "elevation"] }',
  'visible: lidarVisibility.length === 1',
]) {
  assert.ok(source.includes(needle), `Missing beta24 LiDAR editor visibility contract: ${needle}`);
}

console.log("Editor polish beta24 regression checks passed");
