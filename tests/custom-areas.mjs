import { readFile } from "node:fs/promises";

const runtime = await readFile(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");
const required = [
  "function patchCustomAreas0342()",
  "show_custom_areas",
  "custom_area_color",
  "custom_area_fill_opacity",
  "custom_area_stroke_width",
  "nm-custom-areas",
  "_mapPayload?.custom_areas",
  'includes("_custom_area_")',
  'startsWith("binary_sensor.")',
  'stroke-dasharray="10 6"'
];
for (const needle of required) {
  if (!runtime.includes(needle)) throw new Error(`Missing Custom Area runtime guard: ${needle}`);
}
if (!/custom_area_color\s*=\s*\w+\.gate_area_color\s*\|\|\s*"#8e24aa"/.test(runtime)) {
  throw new Error("Custom Area default must follow Gate Area color when configured");
}
console.log("Custom Area overlay regression checks passed");
