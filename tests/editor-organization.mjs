import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");

for (const needle of [
  "0.3.5-beta10: organized editor groups and configurable header buttons",
  '"show_history_button"',
  '"show_notifications_button"',
  '"show_schedule_button"',
  '"show_settings_button"',
  'custom_area_fill_opacity',
  'custom_area_stroke_width',
  'custom_area_color',
  'SAFE_SWATCH_LABELS',
  'vf_off_color: "VF off"',
  'gate_area_color: "Gate area"',
  'custom_area_color: "Custom area"',
  'card._historyDayOffset = null',
  'card._notificationButtonEl.style.display',
  'card._scheduleButtonEl.style.display',
  'settings.style.display',
]) {
  if (!source.includes(needle)) {
    throw new Error(`Missing beta10 editor/header contract: ${needle}`);
  }
}

const markers = source.match(/0\.3\.5-beta10: organized editor groups and configurable header buttons/g) || [];
if (markers.length !== 1) {
  throw new Error(`Expected exactly one beta10 editor organization patch, got ${markers.length}`);
}

for (const needle of [
  "DISPLAY_GROUPS",
  'display_mower_group: "Mower information"',
  'display_map_group: "Map elements"',
  'display_history_group: "History"',
  'display_header_group: "Header buttons"',
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
  if (!source.includes(needle)) {
    throw new Error(`Missing organized Displayed information contract: ${needle}`);
  }
}
if (!source.includes('form.schema.find((item) => item?.name === "display")')) {
  throw new Error("Displayed information must be rebuilt as the explicit display section");
}
if (!source.includes('sectionContaining(form.schema, "trail_opacity")')) {
  throw new Error("Custom-area opacity/border controls must join Appearance");
}
if (!source.includes('form.schema.find((item) => item?.name === "map_colors")')) {
  throw new Error("Custom-area color must join Colors");
}

console.log("Editor organization and header visibility regression checks passed");
