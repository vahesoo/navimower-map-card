import { readFile, writeFile } from "node:fs/promises";

const sourcePath = process.env.NAVIMOWER_MAP_CARD_SOURCE || new URL("../src/navimower-map-card.js", import.meta.url);
let source = await readFile(sourcePath, "utf8");
const marker = "// 0.3.5-beta7: non-overlapping color labels in the visual editor.";
if (source.includes(marker)) {
  console.log("Visual editor color-label patch already applied");
  process.exit(0);
}

if (!source.includes("0.3.5-beta6: polished visual editor appearance layout.")) {
  throw new Error("Expected beta6 visual editor layout marker was not found");
}

const patch = `

${marker}
(() => {
  const Card = globalThis.customElements?.get?.("navimower-map-card");
  if (!Card || Card.__navimower035Beta7EditorColorLabels) return;
  Card.__navimower035Beta7EditorColorLabels = true;

  const previousGetConfigForm = Card.getConfigForm;
  if (typeof previousGetConfigForm !== "function") return;

  const SWATCH_LABELS = {
    custom_area_color: "Custom area",
    zone_fill_color: "Zone fill",
    zone_stroke_color: "Zone border",
    trail_color: "Mowed area",
    off_limit_color: "Off-limit",
    vf_off_color: "VF-off",
    channel_color: "Channel",
    gate_area_color: "Gate area",
    dock_color: "Dock",
  };
  const SWATCH_FIELDS = new Set(Object.keys(SWATCH_LABELS));

  function walk(items, callback) {
    for (const item of Array.isArray(items) ? items : []) {
      callback(item);
      if (Array.isArray(item?.schema)) walk(item.schema, callback);
    }
  }

  Card.getConfigForm = function beta7GetConfigForm(...args) {
    const form = previousGetConfigForm.apply(this, args);
    if (!form || !Array.isArray(form.schema)) return form;

    // Home Assistant renders text[type=color] with a native color swatch. A
    // floating field label sits on top of that swatch, which is unreadable on
    // darker colors. Move the descriptive text into the input's start slot and
    // leave the floating label empty. This keeps the native picker and current
    // config value format while preventing any label/swatch overlap.
    walk(form.schema, (field) => {
      if (!SWATCH_FIELDS.has(field?.name)) return;
      const text = field?.selector?.text;
      if (!text || text.type !== "color") return;
      field.selector = {
        ...field.selector,
        text: {
          ...text,
          prefix: SWATCH_LABELS[field.name],
        },
      };
    });

    const baseComputeLabel = typeof form.computeLabel === "function" ? form.computeLabel : null;
    form.computeLabel = (schema, data) => {
      if (SWATCH_FIELDS.has(schema?.name)) return "";
      return baseComputeLabel?.(schema, data) || schema?.name || "";
    };

    return form;
  };

  console.info("[Navimower Map Card] 0.3.5-beta7 non-overlapping visual editor color labels enabled");
})();
`;

source += patch;
await writeFile(sourcePath, source, "utf8");
console.log("Applied non-overlapping visual editor color labels patch");
