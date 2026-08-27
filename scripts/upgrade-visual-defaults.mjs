import { readFile, writeFile } from "node:fs/promises";

const sourcePath = process.env.NAVIMOWER_MAP_CARD_SOURCE || new URL("../src/navimower-map-card.js", import.meta.url);
let source = await readFile(sourcePath, "utf8");
const marker = "// 0.3.5-beta12: installation visual defaults and uniform stroke widths.";
if (source.includes(marker)) {
  console.log("Beta12 visual defaults patch already applied");
  process.exit(0);
}
if (!source.includes("0.3.5-beta11: real color defaults, combined schedule state and mower error pulse.")) {
  throw new Error("Expected beta11 marker was not found");
}

const patch = `

${marker}
(() => {
  const Card = globalThis.customElements?.get?.("navimower-map-card");
  if (!Card || Card.__navimower035Beta12VisualDefaults) return;
  Card.__navimower035Beta12VisualDefaults = true;

  const VISUAL_DEFAULTS = Object.freeze({
    map_background_color: "#ffffff",
    map_legend_opacity: 0.10,
    zone_label_font_size: 20,
    zone_label_opacity: 0.75,
    zone_fill_color: "#81c784",
    zone_fill_opacity: 0.20,
    zone_stroke_color: "#43a047",
    trail_color: "#43a047",
    trail_opacity: 0.50,
    off_limit_color: "#FF5A00",
    vf_off_color: "#2F80ED",
    channel_color: "#808080",
    gate_area_color: "#8e24aa",
    dock_color: "#37474f",
    custom_area_color: "#8e24aa",
    custom_area_fill_opacity: 0.10,
    mower_scale: 1.2,
    dock_scale: 1.1,
    zone_marker_scale: 1.1,
    zone_stroke_width: 1.5,
    off_limit_stroke_width: 1.5,
    vf_off_stroke_width: 1.5,
    channel_stroke_width: 1.5,
    gate_area_stroke_width: 1.5,
    dock_stroke_width: 1.5,
    custom_area_stroke_width: 1.5,
  });

  const COLOR_FIELDS = new Set([
    "map_background_color",
    "zone_fill_color",
    "zone_stroke_color",
    "trail_color",
    "off_limit_color",
    "vf_off_color",
    "channel_color",
    "gate_area_color",
    "dock_color",
    "custom_area_color",
  ]);

  const WIDTH_FIELDS = [
    "zone_stroke_width",
    "off_limit_stroke_width",
    "vf_off_stroke_width",
    "channel_stroke_width",
    "gate_area_stroke_width",
    "dock_stroke_width",
    "custom_area_stroke_width",
  ];

  const LABELS = {
    zone_stroke_width: "Zone border width",
    off_limit_stroke_width: "Off-limit border width",
    vf_off_stroke_width: "VF-off border width",
    channel_stroke_width: "Channel width",
    gate_area_stroke_width: "Gate area border width",
    dock_stroke_width: "Dock border width",
    custom_area_stroke_width: "Custom area border width",
  };

  function walk(items, callback) {
    for (const item of Array.isArray(items) ? items : []) {
      callback(item);
      if (Array.isArray(item?.schema)) walk(item.schema, callback);
    }
  }

  function findByName(items, name) {
    let match = null;
    walk(items, (item) => {
      if (!match && item?.name === name) match = item;
    });
    return match;
  }

  function widthSelector() {
    return { number: { min: 0.5, max: 6, step: 0.5, mode: "slider" } };
  }

  const previousStub = typeof Card.getStubConfig === "function" ? Card.getStubConfig.bind(Card) : null;
  if (previousStub) {
    Card.getStubConfig = function beta12StubConfig(...args) {
      return { ...previousStub(...args), ...VISUAL_DEFAULTS };
    };
  }

  const previousGetConfigForm = Card.getConfigForm;
  if (typeof previousGetConfigForm === "function") {
    Card.getConfigForm = function beta12GetConfigForm(...args) {
      const form = previousGetConfigForm.apply(this, args);
      if (!form || !Array.isArray(form.schema)) return form;

      walk(form.schema, (field) => {
        if (Object.prototype.hasOwnProperty.call(VISUAL_DEFAULTS, field?.name)) {
          field.default = VISUAL_DEFAULTS[field.name];
        }
        if (COLOR_FIELDS.has(field?.name)) {
          field.selector = {
            ...field.selector,
            text: { ...(field?.selector?.text || {}), type: "color" },
          };
        }
        if (WIDTH_FIELDS.includes(field?.name)) {
          field.selector = widthSelector();
        }
      });

      const appearance = findByName(form.schema, "appearance");
      const appearanceGrid = findByName(appearance?.schema || [], "appearance_grid")
        || (Array.isArray(appearance?.schema) ? appearance.schema.find((item) => item?.type === "grid") : null);
      if (appearanceGrid?.schema) {
        for (const name of WIDTH_FIELDS) {
          if (!findByName(form.schema, name)) {
            appearanceGrid.schema.push({ name, default: VISUAL_DEFAULTS[name], selector: widthSelector() });
          }
        }
      }

      const baseComputeLabel = typeof form.computeLabel === "function" ? form.computeLabel : null;
      form.computeLabel = (schema, data) => LABELS[schema?.name] || baseComputeLabel?.(schema, data) || schema?.name || "";
      return form;
    };
  }

  const proto = Card.prototype;
  const previousSetConfig = proto.setConfig;
  if (typeof previousSetConfig === "function") {
    proto.setConfig = function beta12SetConfig(config) {
      const next = { ...(config || {}) };
      for (const [key, value] of Object.entries(VISUAL_DEFAULTS)) {
        if (next[key] === undefined || next[key] === null || next[key] === "") next[key] = value;
      }
      return previousSetConfig.call(this, next);
    };
  }

  function finiteWidth(value, fallback = 1.5) {
    const parsed = Number(value);
    return Math.min(6, Math.max(0.5, Number.isFinite(parsed) ? parsed : fallback));
  }

  function directChildrenByTag(root, tagName) {
    if (!root?.children) return [];
    const expected = String(tagName).toLowerCase();
    return Array.from(root.children).filter((element) => String(element?.tagName || "").toLowerCase() === expected);
  }

  function syncStrokeWidths(card) {
    const details = card?._detailsEl;
    const config = card?._config;
    if (!details || !config) return;

    const zoneWidth = finiteWidth(config.zone_stroke_width);
    const offLimitWidth = finiteWidth(config.off_limit_stroke_width);
    const vfOffWidth = finiteWidth(config.vf_off_stroke_width);
    const channelWidth = finiteWidth(config.channel_stroke_width);
    const gateWidth = finiteWidth(config.gate_area_stroke_width);
    const dockWidth = finiteWidth(config.dock_stroke_width);

    for (const line of directChildrenByTag(details, "line")) {
      line.setAttribute("stroke-width", String(zoneWidth));
    }

    const polygons = directChildrenByTag(details, "polygon");
    const offLimitCount = Array.isArray(card?._layout?.offLimits) ? card._layout.offLimits.length : 0;
    const vfOffCount = config.show_vf_off_areas === false || !Array.isArray(card?._layout?.vfOff) ? 0 : card._layout.vfOff.length;
    polygons.slice(0, offLimitCount).forEach((element) => element.setAttribute("stroke-width", String(offLimitWidth)));
    polygons.slice(offLimitCount, offLimitCount + vfOffCount).forEach((element) => element.setAttribute("stroke-width", String(vfOffWidth)));

    for (const polyline of directChildrenByTag(details, "polyline")) {
      polyline.setAttribute("stroke-width", String(channelWidth));
    }
    for (const rect of directChildrenByTag(details, "rect")) {
      rect.setAttribute("stroke-width", String(gateWidth));
    }

    const dock = details.querySelector?.(".nm-dock-marker");
    dock?.querySelectorAll?.("[stroke]")?.forEach?.((element) => {
      if (String(element.getAttribute("stroke") || "").toLowerCase() !== "none") {
        element.setAttribute("stroke-width", String(dockWidth));
      }
    });
  }

  const previousStaticCacheKey = proto._staticCacheKey;
  if (typeof previousStaticCacheKey === "function") {
    proto._staticCacheKey = function beta12StaticCacheKey(...args) {
      const base = previousStaticCacheKey.apply(this, args);
      return [base, ...WIDTH_FIELDS.map((name) => this?._config?.[name] ?? VISUAL_DEFAULTS[name])].join("|");
    };
  }

  const previousApplyStaticLayers = proto._applyStaticLayers;
  if (typeof previousApplyStaticLayers === "function") {
    proto._applyStaticLayers = function beta12ApplyStaticLayers(...args) {
      const result = previousApplyStaticLayers.apply(this, args);
      syncStrokeWidths(this);
      return result;
    };
  }

  const previousRenderStatic = proto._renderStatic;
  if (typeof previousRenderStatic === "function") {
    proto._renderStatic = function beta12RenderStatic(...args) {
      const result = previousRenderStatic.apply(this, args);
      syncStrokeWidths(this);
      return result;
    };
  }

  console.info("[Navimower Map Card] 0.3.5-beta12 installation defaults and uniform stroke widths enabled");
})();
`;

source += patch;
await writeFile(sourcePath, source, "utf8");
console.log("Applied beta12 visual defaults and stroke width patch");
