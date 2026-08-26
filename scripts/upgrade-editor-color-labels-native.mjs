import { readFile, writeFile } from "node:fs/promises";

const sourcePath = process.env.NAVIMOWER_MAP_CARD_SOURCE || new URL("../src/navimower-map-card.js", import.meta.url);
let source = await readFile(sourcePath, "utf8");
const marker = "// 0.3.5-beta8: native-only color labels in the visual editor.";
if (source.includes(marker)) {
  console.log("Native-only color label patch already applied");
  process.exit(0);
}

if (!source.includes("0.3.5-beta7: non-overlapping color labels in the visual editor.")) {
  throw new Error("Expected beta7 visual editor color-label marker was not found");
}

const patch = `

${marker}
(() => {
  const Card = globalThis.customElements?.get?.("navimower-map-card");
  if (!Card || Card.__navimower035Beta8EditorNativeColorLabels) return;
  Card.__navimower035Beta8EditorNativeColorLabels = true;

  const previousGetConfigForm = Card.getConfigForm;
  if (typeof previousGetConfigForm !== "function") return;

  const LABELS = {
    custom_area_color: "Custom area color",
    zone_fill_color: "Zone fill color",
    zone_stroke_color: "Zone stroke color",
    trail_color: "Trail color",
    off_limit_color: "Off limit color",
    vf_off_color: "VF off color",
    channel_color: "Channel color",
    gate_area_color: "Gate area color",
    dock_color: "Dock color",
  };
  const COLOR_FIELDS = new Set(Object.keys(LABELS));

  function walk(items, callback) {
    for (const item of Array.isArray(items) ? items : []) {
      callback(item);
      if (Array.isArray(item?.schema)) walk(item.schema, callback);
    }
  }

  Card.getConfigForm = function beta8GetConfigForm(...args) {
    const form = previousGetConfigForm.apply(this, args);
    if (!form || !Array.isArray(form.schema)) return form;

    // beta7 moved the short name into the native color input's prefix/start
    // area. In practice that duplicates the normal small floating color label.
    // Keep only the native label above the swatch, matching the clean Trail and
    // Channel appearance the user preferred. Apply the same rule to custom
    // area color as well.
    walk(form.schema, (field) => {
      if (!COLOR_FIELDS.has(field?.name)) return;
      const text = field?.selector?.text;
      if (!text || text.type !== "color") return;
      const { prefix: _prefix, ...rest } = text;
      field.selector = {
        ...field.selector,
        text: rest,
      };
    });

    const baseComputeLabel = typeof form.computeLabel === "function" ? form.computeLabel : null;
    form.computeLabel = (schema, data) => {
      if (COLOR_FIELDS.has(schema?.name)) return LABELS[schema.name];
      return baseComputeLabel?.(schema, data) || schema?.name || "";
    };

    return form;
  };

  console.info("[Navimower Map Card] 0.3.5-beta8 native-only visual editor color labels enabled");
})();
`;

source += patch;
await writeFile(sourcePath, source, "utf8");
console.log("Applied native-only visual editor color labels patch");
