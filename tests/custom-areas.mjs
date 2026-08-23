import { readFile } from "node:fs/promises";

const runtime = await readFile(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");
const required = [
  'NAVIMOWER_MAP_CARD_VERSION2 = "0.3.4-beta3"',
  "function patchCustomAreas0342()",
  "show_custom_areas",
  "custom_area_color",
  "custom_area_fill_opacity",
  "custom_area_stroke_width",
  "nm-custom-areas",
  "navimow_off_limit_import",
  'startsWith("binary_sensor.")',
  'stroke-dasharray="10 6"'
];
for (const needle of required) {
  if (!runtime.includes(needle)) throw new Error(`Missing Custom Area runtime guard: ${needle}`);
}
if (!runtime.includes('custom_area_color = next.gate_area_color || "#8e24aa"')) {
  throw new Error("Custom Area default must follow Gate Area color when configured");
}
console.log("Custom Area overlay regression checks passed");
