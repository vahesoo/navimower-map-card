/*
 * Navimower Map Card 0.3.0-beta2 outline controls.
 *
 * Adds visual-editor and YAML controls for map-geometry outline widths and
 * keeps those widths constant on screen while the SVG view is zoomed.
 */

export const NAVIMOWER_MAP_CARD_V031_VERSION = "0.3.0-beta2";

export const OUTLINE_DEFAULTS = Object.freeze({
  zone_stroke_width: 2.5,
  off_limit_stroke_width: 5,
  vf_off_stroke_width: 5,
  channel_stroke_width: 5,
  gate_area_stroke_width: 3,
  dock_stroke_width: 3,
});

const OUTLINE_LIMITS = Object.freeze({ minimum: 0.5, maximum: 12 });

const OUTLINE_LABELS = Object.freeze({
  zone_stroke_width: "Zone border width",
  off_limit_stroke_width: "Off-limit border width",
  vf_off_stroke_width: "VF-off border width",
  channel_stroke_width: "Channel line width",
  gate_area_stroke_width: "Gate area border width",
  dock_stroke_width: "Dock border width",
});

const OUTLINE_FIELDS = Object.freeze([
  "zone_stroke_width",
  "off_limit_stroke_width",
  "vf_off_stroke_width",
  "channel_stroke_width",
  "gate_area_stroke_width",
  "dock_stroke_width",
]);

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function outlineWidth(value, fallback) {
  return clamp(
    finiteNumber(value, fallback),
    OUTLINE_LIMITS.minimum,
    OUTLINE_LIMITS.maximum,
  );
}

export function normalizeOutlineConfig(config = {}) {
  const normalized = { ...(config || {}) };
  for (const field of OUTLINE_FIELDS) {
    normalized[field] = outlineWidth(normalized[field], OUTLINE_DEFAULTS[field]);
  }
  return normalized;
}

function findSchema(node, name) {
  if (!node || typeof node !== "object") return null;
  if (node.name === name) return node;
  const children = Array.isArray(node.schema) ? node.schema : [];
  for (const child of children) {
    const match = findSchema(child, name);
    if (match) return match;
  }
  return null;
}

function outlineField(name) {
  return {
    name,
    selector: {
      number: {
        min: OUTLINE_LIMITS.minimum,
        max: OUTLINE_LIMITS.maximum,
        step: 0.5,
        mode: "slider",
        unit_of_measurement: "px",
      },
    },
  };
}

export function extendConfigForm(form) {
  const next = form && typeof form === "object" ? form : { schema: [] };
  const appearanceGrid = findSchema(next, "appearance_grid");
  if (appearanceGrid && Array.isArray(appearanceGrid.schema)) {
    const existing = new Set(appearanceGrid.schema.map((field) => field?.name));
    const fields = OUTLINE_FIELDS
      .filter((name) => !existing.has(name))
      .map(outlineField);
    if (fields.length) {
      const colorIndex = appearanceGrid.schema.findIndex(
        (field) => field?.name === "map_background_color",
      );
      appearanceGrid.schema.splice(
        colorIndex >= 0 ? colorIndex : appearanceGrid.schema.length,
        0,
        ...fields,
      );
    }
  }

  const originalComputeLabel = typeof next.computeLabel === "function"
    ? next.computeLabel
    : null;
  next.computeLabel = (schema) => OUTLINE_LABELS[schema?.name]
    || originalComputeLabel?.(schema)
    || schema?.name
    || "";
  return next;
}

function setNonScalingStroke(element, width) {
  if (!element?.setAttribute) return;
  element.setAttribute("vector-effect", "non-scaling-stroke");
  element.setAttribute("stroke-width", String(width));
}

function applyToSelector(root, selector, width) {
  if (!root?.querySelectorAll) return;
  root.querySelectorAll(selector).forEach((element) => {
    setNonScalingStroke(element, width);
  });
}

export function applyOutlineSettings(card) {
  const root = card?._detailsEl;
  if (!root?.querySelectorAll) return;
  const config = normalizeOutlineConfig(card?._config || {});

  // Zone edges are the only line elements in the details layer. Label leader
  // lines live in the separate label layer and are intentionally unchanged.
  applyToSelector(root, "line", config.zone_stroke_width);
  applyToSelector(root, 'polygon[fill-opacity=".08"]', config.off_limit_stroke_width);
  applyToSelector(root, 'polygon[fill-opacity=".06"]', config.vf_off_stroke_width);
  applyToSelector(root, 'polyline[stroke-dasharray="12 8"]', config.channel_stroke_width);
  applyToSelector(root, 'rect[stroke-dasharray="10 6"]', config.gate_area_stroke_width);
  applyToSelector(root, ".nm-dock-marker rect", config.dock_stroke_width);
}

function wrapOutlineRefresh(proto, methodName) {
  const original = proto?.[methodName];
  if (typeof original !== "function") return;
  proto[methodName] = function outlinedRefresh(...args) {
    const result = original.apply(this, args);
    applyOutlineSettings(this);
    return result;
  };
}

function patchCard() {
  const Card = globalThis.customElements?.get?.("navimower-map-card");
  if (!Card || Card.__navimowerV031Patched) return;
  Card.__navimowerV031Patched = true;

  const originalStubConfig = typeof Card.getStubConfig === "function"
    ? Card.getStubConfig.bind(Card)
    : null;
  Card.getStubConfig = function outlinedStubConfig() {
    return normalizeOutlineConfig(originalStubConfig?.() || {});
  };

  const originalConfigForm = typeof Card.getConfigForm === "function"
    ? Card.getConfigForm.bind(Card)
    : null;
  Card.getConfigForm = function outlinedConfigForm() {
    return extendConfigForm(originalConfigForm?.() || { schema: [] });
  };

  const proto = Card.prototype;
  const originalSetConfig = proto.setConfig;
  if (typeof originalSetConfig === "function") {
    proto.setConfig = function outlinedSetConfig(config) {
      return originalSetConfig.call(this, normalizeOutlineConfig(config));
    };
  }

  wrapOutlineRefresh(proto, "_ensureDom");
  wrapOutlineRefresh(proto, "_renderStatic");
  wrapOutlineRefresh(proto, "_applyStaticLayers");

  console.info("[Navimower Map Card] 0.3.0-beta2 adjustable non-scaling outlines enabled");
}

if (globalThis.customElements) patchCard();
