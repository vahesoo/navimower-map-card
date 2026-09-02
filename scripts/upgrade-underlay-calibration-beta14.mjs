import { readFile, writeFile } from "node:fs/promises";

const sourcePath = new URL("../src/navimower-map-card.js", import.meta.url);
let source = await readFile(sourcePath, "utf8");
const marker = "// 0.3.6-beta14: manual underlay position and rotation calibration.";
if (source.includes(marker)) {
  console.log("0.3.6-beta14 underlay calibration already applied");
  process.exit(0);
}
if (!source.includes("// 0.3.6-beta13: integration-owned provider reference frames.")) {
  throw new Error("Expected 0.3.6-beta13 runtime was not found");
}

const runtime = `

${marker}
(() => {
  const Card = globalThis.customElements?.get?.("navimower-map-card");
  if (!Card || Card.__navimower036Beta14UnderlayCalibration) return;
  Card.__navimower036Beta14UnderlayCalibration = true;

  const proto = Card.prototype;
  const OFFSET_MIN14 = -5;
  const OFFSET_MAX14 = 5;
  const ROTATION_MIN14 = -5;
  const ROTATION_MAX14 = 5;
  const STEP14 = 0.1;

  const finite14 = (value, fallback = null) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const clamp14 = (value, minimum, maximum, fallback = 0) =>
    Math.min(maximum, Math.max(minimum, finite14(value, fallback)));
  const provider14 = (card) => String(card?._config?.map_underlay || "none").toLowerCase();
  const adjustment14 = (card) => ({
    east: clamp14(card?._config?.underlay_east_offset, OFFSET_MIN14, OFFSET_MAX14, 0),
    north: clamp14(card?._config?.underlay_north_offset, OFFSET_MIN14, OFFSET_MAX14, 0),
    rotation: clamp14(card?._config?.underlay_rotation, ROTATION_MIN14, ROTATION_MAX14, 0),
  });

  const activeGeoreference14 = (card) => card?._mapPayload?.georeference || card?._mapPayload?.map?.georeference || null;
  const validGeoreference14 = (value) => {
    if (!value || typeof value !== "object") return false;
    const ref = value.reference || {};
    return [ref.local_x, ref.local_y, value.rotation_rad].every((item) => finite14(item) !== null);
  };

  const mapPoints14 = (map) => {
    const points = [];
    const add = (value) => {
      for (const point of Array.isArray(value) ? value : []) {
        if (Array.isArray(point) && finite14(point[0]) !== null && finite14(point[1]) !== null) {
          points.push([Number(point[0]), Number(point[1])]);
        }
      }
    };
    for (const zone of map?.zones || []) add(zone?.polygon);
    for (const polygon of map?.off_limit_areas || []) add(polygon);
    for (const polygon of map?.vf_off_areas || []) add(polygon);
    for (const channel of map?.channels || []) add(channel?.points);
    const station = map?.station;
    if (finite14(station?.x) !== null && finite14(station?.y) !== null) {
      points.push([Number(station.x), Number(station.y)]);
    }
    return points;
  };

  const svgCenter14 = (card) => {
    const viewBox = card?._svgEl?.viewBox?.baseVal;
    if (viewBox && finite14(viewBox.width) !== null && finite14(viewBox.height) !== null) {
      return {
        x: Number(viewBox.x) + Number(viewBox.width) / 2,
        y: Number(viewBox.y) + Number(viewBox.height) / 2,
      };
    }
    return { x: 500, y: 500 };
  };

  const singleCenter14 = (card) => {
    const layout = card?._layout;
    if (!layout?.sx || !layout?.sy) return svgCenter14(card);
    const screen = mapPoints14(card?._mapPayload?.map || {})
      .map(([x, y]) => ({ x: finite14(layout.sx(x)), y: finite14(layout.sy(y)) }))
      .filter((point) => point.x !== null && point.y !== null);
    if (!screen.length) return svgCenter14(card);
    return {
      x: (Math.min(...screen.map((point) => point.x)) + Math.max(...screen.map((point) => point.x))) / 2,
      y: (Math.min(...screen.map((point) => point.y)) + Math.max(...screen.map((point) => point.y))) / 2,
    };
  };

  const siteLayout14 = (site) => {
    const box = site?.combined_svg_bounds;
    if (!box || [box.min_x, box.min_y, box.max_x, box.max_y].some((value) => finite14(value) === null)) return null;
    const width = Math.max(1, Number(box.max_x) - Number(box.min_x));
    const height = Math.max(1, Number(box.max_y) - Number(box.min_y));
    const padding = 55;
    const scale = Math.min((1000 - padding * 2) / width, (1000 - padding * 2) / height);
    return {
      scale,
      offsetX: (1000 - width * scale) / 2 - Number(box.min_x) * scale,
      offsetY: (1000 - height * scale) / 2 - Number(box.min_y) * scale,
      centerX: 500,
      centerY: 500,
    };
  };

  const singleTranslation14 = (card, east, north) => {
    const layout = card?._layout;
    const geo = activeGeoreference14(card);
    if (!layout?.sx || !layout?.sy || !validGeoreference14(geo)) return { x: 0, y: 0 };
    const ref = geo.reference || {};
    const rotation = Number(geo.rotation_rad);
    const dx = east * Math.cos(rotation) - north * Math.sin(rotation);
    const dy = east * Math.sin(rotation) + north * Math.cos(rotation);
    const x0 = finite14(layout.sx(Number(ref.local_x)));
    const y0 = finite14(layout.sy(Number(ref.local_y)));
    const x1 = finite14(layout.sx(Number(ref.local_x) + dx));
    const y1 = finite14(layout.sy(Number(ref.local_y) + dy));
    if ([x0, y0, x1, y1].some((value) => value === null)) return { x: 0, y: 0 };
    return { x: x1 - x0, y: y1 - y0 };
  };

  const multiTranslation14 = (card, east, north) => {
    const layout = siteLayout14(card?._multi036Site);
    if (!layout) return { x: 0, y: 0 };
    return { x: east * layout.scale, y: -north * layout.scale };
  };

  const transformMatrix14 = (center, translation, rotationDeg) => {
    const radians = rotationDeg * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const a = cos;
    const b = sin;
    const c = -sin;
    const d = cos;
    const e = translation.x + center.x - a * center.x - c * center.y;
    const f = translation.y + center.y - b * center.x - d * center.y;
    return [a, b, c, d, e, f].map((value) => Number(value).toFixed(10)).join(" ");
  };

  const adjustmentNodes14 = (layer) => Array.from(layer?.querySelectorAll?.(
    ".nm-osm-underlay,.nm-estonia-wms-detail,.nm-estonia-wms-detail-pending"
  ) || []);

  const applyLayer14 = (card, layer, multi = false) => {
    if (!layer) return;
    const nodes = adjustmentNodes14(layer);
    if (!nodes.length) return;
    const correction = adjustment14(card);
    if (provider14(card) === "none" || (Math.abs(correction.east) < 1e-9 && Math.abs(correction.north) < 1e-9 && Math.abs(correction.rotation) < 1e-9)) {
      for (const node of nodes) {
        node.removeAttribute("transform");
        delete node.dataset.nmUnderlayCalibration14;
      }
      return;
    }
    const center = multi ? { x: 500, y: 500 } : singleCenter14(card);
    const translation = multi
      ? multiTranslation14(card, correction.east, correction.north)
      : singleTranslation14(card, correction.east, correction.north);
    const matrix = transformMatrix14(center, translation, correction.rotation);
    for (const node of nodes) {
      node.setAttribute("transform", "matrix(" + matrix + ")");
      node.dataset.nmUnderlayCalibration14 = JSON.stringify({
        east_m: correction.east,
        north_m: correction.north,
        rotation_deg_clockwise: correction.rotation,
      });
    }
  };

  const ensureObserver14 = (card, key, layer, multi) => {
    if (!layer || typeof MutationObserver === "undefined") return;
    const current = card?.[key];
    if (current?.target === layer) return;
    current?.observer?.disconnect?.();
    const observer = new MutationObserver(() => scheduleAdjustment14(card, 0));
    observer.observe(layer, { childList: true, subtree: true });
    card[key] = { observer, target: layer, multi };
  };

  const applyAdjustment14 = (card) => {
    if (!card || typeof document === "undefined") return;
    applyLayer14(card, card?._baseEl, false);
    applyLayer14(card, card?._osm036MultiLayer, true);
    applyLayer14(card, card?._multi036Layer, true);
    ensureObserver14(card, "_underlayCalibrationBaseObserver14", card?._baseEl, false);
    ensureObserver14(card, "_underlayCalibrationMultiBaseObserver14", card?._osm036MultiLayer, true);
    ensureObserver14(card, "_underlayCalibrationMultiDetailObserver14", card?._multi036Layer, true);
  };

  const scheduleAdjustment14 = (card, delay = 0) => {
    if (!card) return;
    if (card._underlayCalibrationTimer14) clearTimeout(card._underlayCalibrationTimer14);
    card._underlayCalibrationTimer14 = setTimeout(() => {
      card._underlayCalibrationTimer14 = null;
      applyAdjustment14(card);
    }, Math.max(0, delay));
  };

  const previousSync = proto._syncOsmUnderlay036;
  if (typeof previousSync === "function") {
    proto._syncOsmUnderlay036 = function beta14UnderlayCalibrationSync(...args) {
      const result = previousSync.apply(this, args);
      scheduleAdjustment14(this, 0);
      return result;
    };
  }

  const previousSetConfig = proto.setConfig;
  if (typeof previousSetConfig === "function") {
    proto.setConfig = function beta14UnderlayCalibrationSetConfig(config) {
      const next = { ...(config || {}) };
      next.underlay_east_offset = clamp14(next.underlay_east_offset, OFFSET_MIN14, OFFSET_MAX14, 0);
      next.underlay_north_offset = clamp14(next.underlay_north_offset, OFFSET_MIN14, OFFSET_MAX14, 0);
      next.underlay_rotation = clamp14(next.underlay_rotation, ROTATION_MIN14, ROTATION_MAX14, 0);
      const result = previousSetConfig.call(this, next);
      scheduleAdjustment14(this, 0);
      return result;
    };
  }

  for (const method of ["_renderStatic", "_applyStaticLayers", "_renderShell", "_ensureDom", "_applyViewBox"]) {
    const previous = proto[method];
    if (typeof previous !== "function") continue;
    proto[method] = function beta14UnderlayCalibrationRefresh(...args) {
      const result = previous.apply(this, args);
      scheduleAdjustment14(this, method === "_applyViewBox" ? 80 : 0);
      return result;
    };
  }

  const previousStub = Card.getStubConfig?.bind(Card);
  Card.getStubConfig = (...args) => ({
    ...(previousStub?.(...args) || {}),
    underlay_east_offset: 0,
    underlay_north_offset: 0,
    underlay_rotation: 0,
  });

  const previousForm = Card.getConfigForm?.bind(Card);
  Card.getConfigForm = (...args) => {
    const form = previousForm?.(...args) || { schema: [] };
    if (!Array.isArray(form.schema)) return form;
    const adjustmentNames = new Set(["underlay_east_offset", "underlay_north_offset", "underlay_rotation"]);
    let underlayGrid = null;
    const walk = (items) => {
      for (const item of Array.isArray(items) ? items : []) {
        if (Array.isArray(item?.schema)) {
          item.schema = item.schema.filter((child) => !adjustmentNames.has(child?.name));
          if (item?.name === "map_underlay_grid") underlayGrid = item;
          walk(item.schema);
        }
      }
    };
    walk(form.schema);
    if (underlayGrid?.schema) {
      underlayGrid.schema.push(
        { name: "underlay_east_offset", selector: { number: { min: OFFSET_MIN14, max: OFFSET_MAX14, step: STEP14, mode: "slider", unit_of_measurement: "m" } } },
        { name: "underlay_north_offset", selector: { number: { min: OFFSET_MIN14, max: OFFSET_MAX14, step: STEP14, mode: "slider", unit_of_measurement: "m" } } },
        { name: "underlay_rotation", selector: { number: { min: ROTATION_MIN14, max: ROTATION_MAX14, step: STEP14, mode: "slider", unit_of_measurement: "°" } } },
      );
    }
    const baseLabel = typeof form.computeLabel === "function" ? form.computeLabel : null;
    form.computeLabel = (schema, data) => schema?.name === "underlay_east_offset"
      ? "East offset"
      : schema?.name === "underlay_north_offset"
        ? "North offset"
        : schema?.name === "underlay_rotation"
          ? "Rotation"
          : baseLabel?.(schema, data) || schema?.name || "";
    return form;
  };

  console.info("[Navimower Map Card] 0.3.6-beta14 manual underlay calibration enabled");
})();
`;

source += runtime;
await writeFile(sourcePath, source, "utf8");
console.log("Applied 0.3.6-beta14 manual underlay calibration");
