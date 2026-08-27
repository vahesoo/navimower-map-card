import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");
const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");

const marker = "0.3.5-beta12: installation visual defaults and uniform stroke widths";
const markers = source.match(/0\.3\.5-beta12: installation visual defaults and uniform stroke widths/g) || [];
if (markers.length !== 1) throw new Error(`Expected exactly one beta12 visual defaults patch, got ${markers.length}`);

for (const needle of [
  'map_background_color: "#ffffff"',
  'map_legend_opacity: 0.10',
  'zone_label_font_size: 20',
  'zone_label_opacity: 0.75',
  'zone_fill_opacity: 0.20',
  'trail_opacity: 0.50',
  'channel_color: "#808080"',
  'gate_area_color: "#8e24aa"',
  'custom_area_color: "#8e24aa"',
  'custom_area_fill_opacity: 0.10',
  'mower_scale: 1.2',
  'dock_scale: 1.1',
  'zone_marker_scale: 1.1',
]) {
  if (!source.includes(needle)) throw new Error(`Missing beta12 visual default: ${needle}`);
}

const widths = [
  "zone_stroke_width",
  "off_limit_stroke_width",
  "vf_off_stroke_width",
  "channel_stroke_width",
  "gate_area_stroke_width",
  "dock_stroke_width",
  "custom_area_stroke_width",
];
for (const name of widths) {
  if (!source.includes(`${name}: 1.5`)) throw new Error(`Missing 1.5 px default for ${name}`);
  if (!source.includes(`config.${name}`) && !source.includes(`_config?.[name]`)) {
    throw new Error(`Width ${name} is not connected to runtime rendering/cache`);
  }
}

if (!source.includes('mode: "slider"')) throw new Error("Expected slider-based width controls");
if (!source.includes('custom_area_stroke_width: "Custom area border width"')) throw new Error("Custom area border width label missing");
if (!source.includes('syncStrokeWidths')) throw new Error("Static SVG stroke-width synchronization missing");

for (const needle of [
  "docs/images/navimower-map-card.jpg",
  "Current cycle",
  "current_cycle_render.mowed_area.path_d",
  "Navimower schedule",
  "Home Assistant **Device** page",
  "Custom area border width",
  "Schedule button is orange",
]) {
  if (!readme.includes(needle)) throw new Error(`README missing current feature documentation: ${needle}`);
}
if (/doodle/i.test(readme)) throw new Error("README still contains obsolete experimental map terminology");

console.log("Beta12 visual defaults, stroke widths and README regression checks passed");
