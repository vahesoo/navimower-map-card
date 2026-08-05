/*
 * Navimower Map Card 0.3.0-beta3 fixed-size zone markers.
 *
 * Keeps interactive zone pills at a constant on-screen size while zooming and
 * adds a visual-editor/YAML scale control for the whole marker.
 */

export const NAVIMOWER_MAP_CARD_V032_VERSION = "0.3.0-beta3";
export const ZONE_MARKER_SCALE_DEFAULT = 1;
export const ZONE_MARKER_SCALE_LIMITS = Object.freeze({ minimum: 0.5, maximum: 2.5 });

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function zoneMarkerScale(config = {}) {
  return clamp(
    finiteNumber(config?.zone_marker_scale, ZONE_MARKER_SCALE_DEFAULT),
    ZONE_MARKER_SCALE_LIMITS.minimum,
    ZONE_MARKER_SCALE_LIMITS.maximum,
  );
}

export function normalizeZoneMarkerConfig(config = {}) {
  return {
    ...(config || {}),
    zone_marker_scale: zoneMarkerScale(config),
  };
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

export function extendZoneMarkerConfigForm(form) {
  const next = form && typeof form === "object" ? form : { schema: [] };
  const appearanceGrid = findSchema(next, "appearance_grid");
  if (appearanceGrid && Array.isArray(appearanceGrid.schema)
      && !appearanceGrid.schema.some((field) => field?.name === "zone_marker_scale")) {
    const markerField = {
      name: "zone_marker_scale",
      selector: {
        number: {
          min: ZONE_MARKER_SCALE_LIMITS.minimum,
          max: ZONE_MARKER_SCALE_LIMITS.maximum,
          step: 0.1,
          mode: "slider",
        },
      },
    };
    const fontIndex = appearanceGrid.schema.findIndex(
      (field) => field?.name === "zone_label_font_size",
    );
    appearanceGrid.schema.splice(
      fontIndex >= 0 ? fontIndex + 1 : appearanceGrid.schema.length,
      0,
      markerField,
    );
  }

  const originalComputeLabel = typeof next.computeLabel === "function"
    ? next.computeLabel
    : null;
  next.computeLabel = (schema) => schema?.name === "zone_marker_scale"
    ? "Zone marker size"
    : originalComputeLabel?.(schema) || schema?.name || "";
  return next;
}

export function markerTransform(cx, cy, zoom) {
  const inverse = 1 / Math.max(1, finiteNumber(zoom, 1));
  return `translate(${Number(cx).toFixed(1)},${Number(cy).toFixed(1)}) scale(${inverse.toFixed(5)}) translate(${-Number(cx).toFixed(1)},${-Number(cy).toFixed(1)})`;
}

export function leaderEndpoint({ anchorX, anchorY, cx, cy, width, height, zoom }) {
  const dx = Number(anchorX) - Number(cx);
  const dy = Number(anchorY) - Number(cy);
  const inverse = 1 / Math.max(1, finiteNumber(zoom, 1));
  const halfWidth = Math.max(0, Number(width) * inverse / 2);
  const halfHeight = Math.max(0, Number(height) * inverse / 2);
  if (!Number.isFinite(dx) || !Number.isFinite(dy)
      || !Number.isFinite(halfWidth) || !Number.isFinite(halfHeight)) {
    return { x: Number(cx) || 0, y: Number(cy) || 0 };
  }
  if (Math.abs(dx) <= halfWidth && Math.abs(dy) <= halfHeight) {
    return { x: Number(cx), y: Number(cy) };
  }
  const tx = dx === 0 ? Number.POSITIVE_INFINITY : halfWidth / Math.abs(dx);
  const ty = dy === 0 ? Number.POSITIVE_INFINITY : halfHeight / Math.abs(dy);
  const ratio = Math.min(tx, ty);
  return {
    x: Number(cx) + dx * ratio,
    y: Number(cy) + dy * ratio,
  };
}

export function applyZoneMarkerScale(card) {
  const root = card?._labelsEl;
  if (!root?.querySelectorAll) return;
  const zoom = Math.max(1, finiteNumber(card?._view?.scale, 1));

  root.querySelectorAll(".nm-zone-label[data-marker-cx][data-marker-cy]").forEach((marker) => {
    const cx = finiteNumber(marker.dataset.markerCx, null);
    const cy = finiteNumber(marker.dataset.markerCy, null);
    const body = marker.querySelector?.(".nm-zone-marker-body");
    if (cx === null || cy === null || !body?.setAttribute) return;
    body.setAttribute("transform", markerTransform(cx, cy, zoom));
    body.querySelector?.("rect")?.setAttribute?.("vector-effect", "non-scaling-stroke");
  });

  root.querySelectorAll(".nm-zone-label-leader[data-marker-cx]").forEach((leader) => {
    const values = {
      anchorX: finiteNumber(leader.dataset.anchorX, null),
      anchorY: finiteNumber(leader.dataset.anchorY, null),
      cx: finiteNumber(leader.dataset.markerCx, null),
      cy: finiteNumber(leader.dataset.markerCy, null),
      width: finiteNumber(leader.dataset.markerWidth, null),
      height: finiteNumber(leader.dataset.markerHeight, null),
      zoom,
    };
    if (Object.values(values).slice(0, 6).some((value) => value === null)) return;
    const endpoint = leaderEndpoint(values);
    leader.setAttribute("x2", endpoint.x.toFixed(1));
    leader.setAttribute("y2", endpoint.y.toFixed(1));
    leader.setAttribute("vector-effect", "non-scaling-stroke");
  });
}

function wrapMarkerRefresh(proto, methodName) {
  const original = proto?.[methodName];
  if (typeof original !== "function") return;
  proto[methodName] = function zoneMarkerRefresh(...args) {
    const result = original.apply(this, args);
    applyZoneMarkerScale(this);
    return result;
  };
}

function patchCard() {
  const Card = globalThis.customElements?.get?.("navimower-map-card");
  if (!Card || Card.__navimowerV032Patched) return;
  Card.__navimowerV032Patched = true;

  const originalStubConfig = typeof Card.getStubConfig === "function"
    ? Card.getStubConfig.bind(Card)
    : null;
  Card.getStubConfig = function zoneMarkerStubConfig() {
    return normalizeZoneMarkerConfig(originalStubConfig?.() || {});
  };

  const originalConfigForm = typeof Card.getConfigForm === "function"
    ? Card.getConfigForm.bind(Card)
    : null;
  Card.getConfigForm = function zoneMarkerConfigForm() {
    return extendZoneMarkerConfigForm(originalConfigForm?.() || { schema: [] });
  };

  const proto = Card.prototype;
  const originalSetConfig = proto.setConfig;
  if (typeof originalSetConfig === "function") {
    proto.setConfig = function zoneMarkerSetConfig(config) {
      return originalSetConfig.call(this, normalizeZoneMarkerConfig(config));
    };
  }

  const originalStaticCacheKey = proto._staticCacheKey;
  if (typeof originalStaticCacheKey === "function") {
    proto._staticCacheKey = function zoneMarkerStaticCacheKey(...args) {
      return `${originalStaticCacheKey.apply(this, args)}|zone-marker:${zoneMarkerScale(this._config).toFixed(2)}`;
    };
  }

  const originalPillMetrics = proto._pillMetrics;
  if (typeof originalPillMetrics === "function") {
    proto._pillMetrics = function zoneMarkerPillMetrics(value) {
      const metrics = originalPillMetrics.call(this, value);
      const scale = zoneMarkerScale(this._config);
      return {
        fontSize: metrics.fontSize * scale,
        width: Math.min(984, metrics.width * scale),
        height: metrics.height * scale,
      };
    };
  }

  proto._pill = function fixedSizeZoneMarker(cx, cy, value, zoneId = null) {
    const { fontSize, width, height } = this._pillMetrics(value);
    const text = escapeHtml(value);
    const interactive = zoneId !== null && zoneId !== undefined;
    const opacity = clamp(finiteNumber(this._config?.zone_label_opacity, 1), 0, 1);
    const markerCx = Number(cx).toFixed(1);
    const markerCy = Number(cy).toFixed(1);
    const attrs = interactive
      ? ` class="nm-zone-label nm-zone-marker" data-zone-id="${escapeHtml(zoneId)}" role="button" tabindex="0" aria-label="Open details for ${text}"`
      : ` class="nm-zone-marker"`;
    const title = interactive ? "<title>Open zone details</title>" : "";
    const transform = markerTransform(cx, cy, this._view?.scale);
    return `<g${attrs} data-marker-cx="${markerCx}" data-marker-cy="${markerCy}" opacity="${opacity.toFixed(2)}">${title}<g class="nm-zone-marker-body" transform="${transform}"><rect x="${(cx - width / 2).toFixed(1)}" y="${(cy - height / 2).toFixed(1)}" width="${width.toFixed(1)}" height="${height.toFixed(1)}" rx="${(height / 2).toFixed(1)}" fill="#eceff1" fill-opacity=".94" stroke="#b0bec5" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
      <text x="${markerCx}" y="${(cy + fontSize * .34).toFixed(1)}" text-anchor="middle" font-family="sans-serif" font-size="${fontSize.toFixed(1)}" font-weight="600" fill="#37474f" pointer-events="none">${text}</text></g></g>`;
  };

  proto._zoneLabelLeader = function fixedSizeZoneMarkerLeader(item) {
    if (!item?.moved) return "";
    const endpoint = leaderEndpoint({
      anchorX: item.anchorX,
      anchorY: item.anchorY,
      cx: item.cx,
      cy: item.cy,
      width: item.width,
      height: item.height,
      zoom: this._view?.scale,
    });
    return `<line class="nm-zone-label-leader" data-anchor-x="${item.anchorX.toFixed(1)}" data-anchor-y="${item.anchorY.toFixed(1)}" data-marker-cx="${item.cx.toFixed(1)}" data-marker-cy="${item.cy.toFixed(1)}" data-marker-width="${item.width.toFixed(1)}" data-marker-height="${item.height.toFixed(1)}" x1="${item.anchorX.toFixed(1)}" y1="${item.anchorY.toFixed(1)}" x2="${endpoint.x.toFixed(1)}" y2="${endpoint.y.toFixed(1)}" stroke="#607d8b" stroke-width="2" stroke-opacity=".72" stroke-linecap="round" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
  };

  wrapMarkerRefresh(proto, "_ensureDom");
  wrapMarkerRefresh(proto, "_renderStatic");
  wrapMarkerRefresh(proto, "_applyStaticLayers");
  wrapMarkerRefresh(proto, "_renderMower");
  wrapMarkerRefresh(proto, "_renderShell");

  console.info("[Navimower Map Card] 0.3.0-beta3 fixed-size adjustable zone markers enabled");
}

if (globalThis.customElements) patchCard();
