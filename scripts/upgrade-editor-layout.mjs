import { readFile, writeFile } from "node:fs/promises";

const sourcePath = process.env.NAVIMOWER_MAP_CARD_SOURCE || new URL("../src/navimower-map-card.js", import.meta.url);
let source = await readFile(sourcePath, "utf8");
const marker = "// 0.3.5-beta6: polished visual editor appearance layout.";
if (source.includes(marker)) {
  console.log("Visual editor layout patch already applied");
  process.exit(0);
}

if (!source.includes("0.3.5-beta5: resilient mower artwork visibility.")) {
  throw new Error("Expected beta5 runtime marker was not found");
}

const patch = `

${marker}
(() => {
  const Card = globalThis.customElements?.get?.("navimower-map-card");
  if (!Card || Card.__navimower035Beta6EditorLayout) return;
  Card.__navimower035Beta6EditorLayout = true;

  const previousGetConfigForm = Card.getConfigForm;
  if (typeof previousGetConfigForm !== "function") return;

  const CUSTOM_FIELDS = [
    "show_custom_areas",
    "custom_area_fill_opacity",
    "custom_area_stroke_width",
    "custom_area_color",
  ];
  const COLOR_FIELDS = [
    "map_background_color",
    "zone_fill_color",
    "zone_stroke_color",
    "trail_color",
    "off_limit_color",
    "vf_off_color",
    "channel_color",
    "gate_area_color",
    "dock_color",
  ];

  const LABELS = {
    show_custom_areas: "Show custom areas",
    custom_area_fill_opacity: "Fill opacity",
    custom_area_stroke_width: "Border width",
    custom_area_color: "Color",
    map_background_color: "Background",
    zone_fill_color: "Zone fill",
    zone_stroke_color: "Zone border",
    trail_color: "Mowed area",
    off_limit_color: "Off-limit",
    vf_off_color: "VF-off",
    channel_color: "Channel",
    gate_area_color: "Gate area",
    dock_color: "Dock",
  };

  function walk(items, callback) {
    for (const item of Array.isArray(items) ? items : []) {
      callback(item);
      if (Array.isArray(item?.schema)) walk(item.schema, callback);
    }
  }

  function find(items, name) {
    let match = null;
    walk(items, (item) => {
      if (!match && item?.name === name) match = item;
    });
    return match;
  }

  function collect(items, names) {
    const wanted = new Set(names);
    const found = new Map();
    walk(items, (item) => {
      if (wanted.has(item?.name) && !found.has(item.name)) found.set(item.name, item);
    });
    return found;
  }

  function remove(items, names) {
    const unwanted = new Set(names);
    for (const item of Array.isArray(items) ? items : []) {
      if (!Array.isArray(item?.schema)) continue;
      item.schema = item.schema.filter((child) => !unwanted.has(child?.name));
      remove(item.schema, names);
    }
  }

  function fallbackField(name) {
    if (name === "show_custom_areas") return { name, selector: { boolean: {} } };
    if (name === "custom_area_fill_opacity") {
      return { name, selector: { number: { min: 0, max: 1, step: 0.05, mode: "slider" } } };
    }
    if (name === "custom_area_stroke_width") {
      return { name, selector: { number: { min: 1, max: 12, step: 1, mode: "box" } } };
    }
    return { name, selector: { text: { type: "color" } } };
  }

  function makeGrid(name, fields) {
    return {
      type: "grid",
      name,
      flatten: true,
      // A slightly wider minimum makes the narrow Home Assistant editor fall
      // back to one clean column instead of squeezing color labels over swatches.
      column_min_width: "240px",
      schema: fields,
    };
  }

  Card.getConfigForm = function beta6GetConfigForm(...args) {
    const form = previousGetConfigForm.apply(this, args);
    if (!form || !Array.isArray(form.schema)) return form;

    // Every previous visual-editor extension has already run at this point.
    // Preserve their field definitions/selectors, but regroup the appearance
    // controls into stable sections instead of leaving everything in one grid.
    const captured = collect(form.schema, [...CUSTOM_FIELDS, ...COLOR_FIELDS]);
    remove(form.schema, [...CUSTOM_FIELDS, ...COLOR_FIELDS]);

    // Defensive cleanup in case an earlier editor extension created the target
    // sections before this patch is applied to a generated runtime.
    form.schema = form.schema.filter((item) => !["custom_area_appearance", "map_colors"].includes(item?.name));

    const customFields = CUSTOM_FIELDS.map((name) => captured.get(name) || fallbackField(name));
    const colorFields = COLOR_FIELDS.map((name) => captured.get(name) || fallbackField(name));
    const customSection = {
      type: "expandable",
      name: "custom_area_appearance",
      title: "Custom areas",
      flatten: true,
      schema: [makeGrid("custom_area_appearance_grid", customFields)],
    };
    const colorSection = {
      type: "expandable",
      name: "map_colors",
      title: "Colors",
      flatten: true,
      schema: [makeGrid("map_colors_grid", colorFields)],
    };

    const appearanceIndex = form.schema.findIndex((item) => item?.name === "appearance");
    const insertAt = appearanceIndex >= 0 ? appearanceIndex + 1 : form.schema.length;
    form.schema.splice(insertAt, 0, customSection, colorSection);

    const baseComputeLabel = typeof form.computeLabel === "function" ? form.computeLabel : null;
    form.computeLabel = (schema) => LABELS[schema?.name] || baseComputeLabel?.(schema) || schema?.name || "";

    return form;
  };

  console.info("[Navimower Map Card] 0.3.5-beta6 polished visual editor appearance layout enabled");
})();
`;

source += patch;
await writeFile(sourcePath, source, "utf8");
console.log("Applied polished visual editor appearance layout patch");
