import { readFile, writeFile } from "node:fs/promises";

const sourcePath = new URL("../src/navimower-map-card.js", import.meta.url);
let source = await readFile(sourcePath, "utf8");
const marker = "// 0.3.6-beta10: zoom-aware Estonia orthophoto detail and WGS84 ellipsoid underlay geodesy.";
if (source.includes(marker)) {
  console.log("0.3.6-beta10 Estonia orthophoto detail already applied");
  process.exit(0);
}
if (!source.includes("// 0.3.6-beta9: Estonia orthophoto editor availability and zoom fix.")) {
  throw new Error("Expected 0.3.6-beta9 runtime was not found");
}

const oldGeodesy = `  const offsetMeters = (lat0, lon0, lat, lon) => {
    const meanLat = ((lat0 + lat) / 2) * Math.PI / 180;
    return {
      east: (lon - lon0) * Math.PI / 180 * EARTH_RADIUS_M * Math.cos(meanLat),
      north: (lat - lat0) * Math.PI / 180 * EARTH_RADIUS_M,
    };
  };

  const offsetWgs84 = (lat0, lon0, east, north) => ({
    lat: lat0 + (north / EARTH_RADIUS_M) * 180 / Math.PI,
    lon: lon0 + (east / (EARTH_RADIUS_M * Math.cos(lat0 * Math.PI / 180))) * 180 / Math.PI,
  });`;

const newGeodesy = `  const UNDERLAY_WGS84_A_M = 6378137.0;
  const UNDERLAY_WGS84_F = 1 / 298.257223563;
  const UNDERLAY_WGS84_E2 = UNDERLAY_WGS84_F * (2 - UNDERLAY_WGS84_F);
  const underlayCurvatureRadii = (latitudeRad) => {
    const sinLat = Math.sin(latitudeRad);
    const denominator = 1 - UNDERLAY_WGS84_E2 * sinLat * sinLat;
    const root = Math.sqrt(denominator);
    return {
      meridional: UNDERLAY_WGS84_A_M * (1 - UNDERLAY_WGS84_E2) / (denominator * root),
      primeVertical: UNDERLAY_WGS84_A_M / root,
    };
  };
  const underlayShortestLonDeltaRad = (lon0, lon) => {
    const deltaDeg = ((lon - lon0 + 180) % 360 + 360) % 360 - 180;
    return deltaDeg * Math.PI / 180;
  };
  const offsetMeters = (lat0, lon0, lat, lon) => {
    const lat0Rad = lat0 * Math.PI / 180;
    const latRad = lat * Math.PI / 180;
    const meanLat = (lat0Rad + latRad) / 2;
    const radii = underlayCurvatureRadii(meanLat);
    return {
      east: underlayShortestLonDeltaRad(lon0, lon) * radii.primeVertical * Math.cos(meanLat),
      north: (latRad - lat0Rad) * radii.meridional,
    };
  };

  const offsetWgs84 = (lat0, lon0, east, north) => {
    const lat0Rad = lat0 * Math.PI / 180;
    let targetLat = lat0Rad;
    for (let index = 0; index < 3; index += 1) {
      const meanLat = (lat0Rad + targetLat) / 2;
      const radii = underlayCurvatureRadii(meanLat);
      targetLat = lat0Rad + north / radii.meridional;
    }
    const meanLat = (lat0Rad + targetLat) / 2;
    const radii = underlayCurvatureRadii(meanLat);
    const eastRadius = radii.primeVertical * Math.cos(meanLat);
    const targetLon = lon0 * Math.PI / 180 + east / eastRadius;
    let lon = targetLon * 180 / Math.PI;
    lon = ((lon + 180) % 360 + 360) % 360 - 180;
    return { lat: targetLat * 180 / Math.PI, lon };
  };`;

if (!source.includes(oldGeodesy)) {
  throw new Error("beta5 spherical underlay geodesy contract was not found");
}
source = source.replace(oldGeodesy, newGeodesy);

const patch = `

${marker}
(() => {
  const Card = globalThis.customElements?.get?.("navimower-map-card");
  if (!Card || Card.__navimower036Beta10EstoniaDetail) return;
  Card.__navimower036Beta10EstoniaDetail = true;

  const proto = Card.prototype;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const WGS84_A_M = 6378137.0;
  const WGS84_F = 1 / 298.257223563;
  const WGS84_E2 = WGS84_F * (2 - WGS84_F);
  const DETAIL_SCALE_THRESHOLD = 1.08;
  const DETAIL_DEBOUNCE_MS = 180;
  const DETAIL_BOUNDS_PADDING = 0.08;
  const MAX_WMS_PIXELS = 1600;

  const finite10 = (value, fallback = null) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const clamp10 = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
  const provider10 = (card) => String(card?._config?.map_underlay || "none").toLowerCase();
  const opacity10 = (card) => clamp10(finite10(card?._config?.osm_underlay_opacity, 0.55), 0.1, 1);
  const georeference10 = (card) => card?._mapPayload?.georeference || card?._mapPayload?.map?.georeference || null;
  const validGeoreference10 = (value) => {
    if (!value || typeof value !== "object") return false;
    const ref = value.reference || {};
    const complete = [ref.local_x, ref.local_y, ref.latitude, ref.longitude, value.rotation_rad].every((item) => finite10(item) !== null);
    if (!complete) return false;
    return value.status === "validated" || value?.validation?.valid === true;
  };

  const radii10 = (latitudeRad) => {
    const sinLat = Math.sin(latitudeRad);
    const denominator = 1 - WGS84_E2 * sinLat * sinLat;
    const root = Math.sqrt(denominator);
    return {
      meridional: WGS84_A_M * (1 - WGS84_E2) / (denominator * root),
      primeVertical: WGS84_A_M / root,
    };
  };
  const shortestLon10 = (lon0, lon) => {
    const deltaDeg = ((lon - lon0 + 180) % 360 + 360) % 360 - 180;
    return deltaDeg * Math.PI / 180;
  };
  const offsetMeters10 = (lat0, lon0, lat, lon) => {
    const lat0Rad = lat0 * Math.PI / 180;
    const latRad = lat * Math.PI / 180;
    const meanLat = (lat0Rad + latRad) / 2;
    const radii = radii10(meanLat);
    return {
      east: shortestLon10(lon0, lon) * radii.primeVertical * Math.cos(meanLat),
      north: (latRad - lat0Rad) * radii.meridional,
    };
  };
  const offsetWgs8410 = (lat0, lon0, east, north) => {
    const lat0Rad = lat0 * Math.PI / 180;
    let targetLat = lat0Rad;
    for (let index = 0; index < 3; index += 1) {
      const meanLat = (lat0Rad + targetLat) / 2;
      targetLat = lat0Rad + north / radii10(meanLat).meridional;
    }
    const meanLat = (lat0Rad + targetLat) / 2;
    const eastRadius = radii10(meanLat).primeVertical * Math.cos(meanLat);
    const targetLon = lon0 * Math.PI / 180 + east / eastRadius;
    let lon = targetLon * 180 / Math.PI;
    lon = ((lon + 180) % 360 + 360) % 360 - 180;
    return { lat: targetLat * 180 / Math.PI, lon };
  };

  const localToWgs8410 = (geo, x, y) => {
    if (!validGeoreference10(geo)) return null;
    const ref = geo.reference || {};
    const rotation = finite10(geo.rotation_rad, 0);
    const dx = Number(x) - Number(ref.local_x);
    const dy = Number(y) - Number(ref.local_y);
    const east = dx * Math.cos(rotation) + dy * Math.sin(rotation);
    const north = -dx * Math.sin(rotation) + dy * Math.cos(rotation);
    return offsetWgs8410(Number(ref.latitude), Number(ref.longitude), east, north);
  };
  const wgs84ToLocal10 = (geo, lat, lon) => {
    if (!validGeoreference10(geo)) return null;
    const ref = geo.reference || {};
    const rotation = finite10(geo.rotation_rad, 0);
    const offset = offsetMeters10(Number(ref.latitude), Number(ref.longitude), lat, lon);
    const dx = offset.east * Math.cos(rotation) - offset.north * Math.sin(rotation);
    const dy = offset.east * Math.sin(rotation) + offset.north * Math.cos(rotation);
    return { x: Number(ref.local_x) + dx, y: Number(ref.local_y) + dy };
  };

  const viewBounds10 = (card) => {
    const view = card?._view || {};
    const scale = Math.max(0.05, finite10(view.scale, 1));
    const span = 1000 / scale;
    const cx = finite10(view.cx, 500);
    const cy = finite10(view.cy, 500);
    return {
      scale,
      left: cx - span / 2,
      right: cx + span / 2,
      top: cy - span / 2,
      bottom: cy + span / 2,
    };
  };
  const geoBounds10 = (points) => {
    if (!Array.isArray(points) || !points.length) return null;
    let north = Math.max(...points.map((point) => Number(point.lat)));
    let south = Math.min(...points.map((point) => Number(point.lat)));
    let east = Math.max(...points.map((point) => Number(point.lon)));
    let west = Math.min(...points.map((point) => Number(point.lon)));
    if (![north, south, east, west].every(Number.isFinite)) return null;
    const latPad = Math.max((north - south) * DETAIL_BOUNDS_PADDING, 0.000005);
    const lonPad = Math.max((east - west) * DETAIL_BOUNDS_PADDING, 0.000005);
    north += latPad;
    south -= latPad;
    east += lonPad;
    west -= lonPad;
    return { north, south, east, west };
  };
  const requestSize10 = (card) => {
    const rect = card?._svgEl?.getBoundingClientRect?.() || card?.getBoundingClientRect?.() || {};
    const dpr = clamp10(finite10(globalThis.devicePixelRatio, 1), 1, 2.5);
    const width = clamp10(Math.round(Math.max(512, finite10(rect.width, 800) * dpr)), 512, MAX_WMS_PIXELS);
    const height = clamp10(Math.round(Math.max(512, finite10(rect.height, 800) * dpr)), 512, MAX_WMS_PIXELS);
    return { width, height };
  };
  const wmsUrl10 = (bounds, width, height) => {
    const params = new URLSearchParams();
    params.set("SERVICE", "WMS");
    params.set("REQUEST", "GetMap");
    params.set("VERSION", "1.1.1");
    params.set("LAYERS", "EESTIFOTO");
    params.set("STYLES", "");
    params.set("FORMAT", "image/png");
    params.set("TRANSPARENT", "FALSE");
    params.set("SRS", "EPSG:4326");
    params.set("BBOX", [bounds.west, bounds.south, bounds.east, bounds.north].map((value) => Number(value).toFixed(8)).join(","));
    params.set("WIDTH", String(width));
    params.set("HEIGHT", String(height));
    params.set("ASUTUS", "NAVIMOWER");
    params.set("KESKKOND", "LIVE");
    params.set("IS", "NAVIMOWER_MAP_CARD");
    return "https://kaart.maaamet.ee/wms/alus-geo?" + params.toString();
  };

  const clearDetail10 = (layer) => {
    layer?.querySelectorAll?.(".nm-estonia-wms-detail,.nm-estonia-wms-detail-pending")?.forEach?.((node) => node.remove());
  };
  const installDetail10 = (layer, bounds, screenPoint, card) => {
    if (!layer || !bounds || typeof screenPoint !== "function") return false;
    const size = requestSize10(card);
    const nw = screenPoint(bounds.north, bounds.west);
    const ne = screenPoint(bounds.north, bounds.east);
    const sw = screenPoint(bounds.south, bounds.west);
    if (![nw, ne, sw].every((point) => point && finite10(point.x) !== null && finite10(point.y) !== null)) return false;
    const a = (ne.x - nw.x) / size.width;
    const b = (ne.y - nw.y) / size.width;
    const c = (sw.x - nw.x) / size.height;
    const d = (sw.y - nw.y) / size.height;
    const url = wmsUrl10(bounds, size.width, size.height);
    const key = url + "|" + opacity10(card).toFixed(2);
    const current = layer.querySelector?.(".nm-estonia-wms-detail");
    const pending = layer.querySelector?.(".nm-estonia-wms-detail-pending");
    if (current?.dataset?.wmsKey === key || pending?.dataset?.wmsKey === key) return true;
    pending?.remove?.();

    const group = document.createElementNS(SVG_NS, "g");
    group.setAttribute("class", "nm-estonia-wms-detail-pending");
    group.setAttribute("pointer-events", "none");
    group.dataset.wmsKey = key;
    const image = document.createElementNS(SVG_NS, "image");
    image.setAttribute("href", url);
    image.setAttribute("x", "0");
    image.setAttribute("y", "0");
    image.setAttribute("width", String(size.width));
    image.setAttribute("height", String(size.height));
    image.setAttribute("preserveAspectRatio", "none");
    image.setAttribute("opacity", opacity10(card).toFixed(2));
    image.setAttribute("transform", "matrix(" + [a, b, c, d, nw.x, nw.y].map((value) => Number(value).toFixed(10)).join(" ") + ")");
    group.appendChild(image);

    const base = layer.querySelector?.(".nm-osm-underlay");
    const anchor = current || base;
    if (anchor?.parentNode === layer) anchor.after(group);
    else if (layer.firstElementChild?.nextSibling) layer.insertBefore(group, layer.firstElementChild.nextSibling);
    else layer.appendChild(group);

    image.addEventListener("load", () => {
      if (!group.isConnected) return;
      layer.querySelectorAll?.(".nm-estonia-wms-detail")?.forEach?.((node) => node.remove());
      group.setAttribute("class", "nm-estonia-wms-detail");
    }, { once: true });
    image.addEventListener("error", () => group.remove(), { once: true });
    return true;
  };

  const singleVisibleBounds10 = (card, geo) => {
    const layout = card?._layout;
    if (!layout?.sx || !layout?.sy) return null;
    const sx0 = finite10(layout.sx(0));
    const sx1 = finite10(layout.sx(1));
    const sy0 = finite10(layout.sy(0));
    const sy1 = finite10(layout.sy(1));
    if ([sx0, sx1, sy0, sy1].some((value) => value === null) || Math.abs(sx1 - sx0) < 1e-9 || Math.abs(sy1 - sy0) < 1e-9) return null;
    const localAt = (screenX, screenY) => ({
      x: (screenX - sx0) / (sx1 - sx0),
      y: (screenY - sy0) / (sy1 - sy0),
    });
    const view = viewBounds10(card);
    const localCorners = [
      localAt(view.left, view.top),
      localAt(view.right, view.top),
      localAt(view.left, view.bottom),
      localAt(view.right, view.bottom),
    ];
    return geoBounds10(localCorners.map((point) => localToWgs8410(geo, point.x, point.y)).filter(Boolean));
  };
  const syncSingle10 = (card) => {
    const layer = card?._baseEl;
    if (!layer) return false;
    const view = viewBounds10(card);
    if (provider10(card) !== "estonia_orthophoto" || view.scale < DETAIL_SCALE_THRESHOLD) {
      clearDetail10(layer);
      return false;
    }
    const geo = georeference10(card);
    if (!validGeoreference10(geo) || !card?._layout?.sx || !card?._layout?.sy) {
      clearDetail10(layer);
      return false;
    }
    const bounds = singleVisibleBounds10(card, geo);
    if (!bounds) return false;
    return installDetail10(layer, bounds, (lat, lon) => {
      const local = wgs84ToLocal10(geo, lat, lon);
      return local ? { x: card._layout.sx(local.x), y: card._layout.sy(local.y) } : null;
    }, card);
  };

  const siteLayout10 = (site) => {
    const box = site?.combined_svg_bounds;
    if (!box || [box.min_x, box.min_y, box.max_x, box.max_y].some((value) => finite10(value) === null)) return null;
    const width = Math.max(1, Number(box.max_x) - Number(box.min_x));
    const height = Math.max(1, Number(box.max_y) - Number(box.min_y));
    const padding = 55;
    const scale = Math.min((1000 - padding * 2) / width, (1000 - padding * 2) / height);
    return {
      scale,
      offsetX: (1000 - width * scale) / 2 - Number(box.min_x) * scale,
      offsetY: (1000 - height * scale) / 2 - Number(box.min_y) * scale,
    };
  };
  const multiVisibleBounds10 = (card, lat0, lon0, layout) => {
    const view = viewBounds10(card);
    const siteAt = (screenX, screenY) => ({
      east: (screenX - layout.offsetX) / layout.scale,
      north: (layout.offsetY - screenY) / layout.scale,
    });
    const corners = [
      siteAt(view.left, view.top),
      siteAt(view.right, view.top),
      siteAt(view.left, view.bottom),
      siteAt(view.right, view.bottom),
    ];
    return geoBounds10(corners.map((point) => offsetWgs8410(lat0, lon0, point.east, point.north)));
  };
  const syncMulti10 = (card) => {
    const layer = card?._multi036Layer;
    if (!layer || layer.style.display === "none") return false;
    const view = viewBounds10(card);
    if (provider10(card) !== "estonia_orthophoto" || view.scale < DETAIL_SCALE_THRESHOLD) {
      clearDetail10(layer);
      return false;
    }
    const site = card?._multi036Site;
    const origin = site?.origin || {};
    const lat0 = finite10(origin.latitude);
    const lon0 = finite10(origin.longitude);
    const layout = siteLayout10(site);
    if (lat0 === null || lon0 === null || !layout || site?.status !== "validated") {
      clearDetail10(layer);
      return false;
    }
    const bounds = multiVisibleBounds10(card, lat0, lon0, layout);
    if (!bounds) return false;
    return installDetail10(layer, bounds, (lat, lon) => {
      const offset = offsetMeters10(lat0, lon0, lat, lon);
      return { x: layout.offsetX + offset.east * layout.scale, y: layout.offsetY - offset.north * layout.scale };
    }, card);
  };

  const syncDetail10 = (card) => {
    if (!card || typeof document === "undefined") return;
    const multiVisible = Boolean(card?._multi036Layer && card._multi036Layer.style.display !== "none");
    if (multiVisible) {
      clearDetail10(card?._baseEl);
      syncMulti10(card);
    } else {
      clearDetail10(card?._multi036Layer);
      syncSingle10(card);
    }
  };
  const scheduleDetail10 = (card, delay = DETAIL_DEBOUNCE_MS) => {
    if (!card) return;
    if (card._estoniaWmsDetailTimer036) clearTimeout(card._estoniaWmsDetailTimer036);
    const view = viewBounds10(card);
    if (provider10(card) !== "estonia_orthophoto" || view.scale < DETAIL_SCALE_THRESHOLD) {
      card._estoniaWmsDetailTimer036 = null;
      syncDetail10(card);
      return;
    }
    card._estoniaWmsDetailTimer036 = setTimeout(() => {
      card._estoniaWmsDetailTimer036 = null;
      syncDetail10(card);
    }, Math.max(0, delay));
  };

  const previousSetConfig10 = proto.setConfig;
  if (typeof previousSetConfig10 === "function") {
    proto.setConfig = function beta10EstoniaDetailSetConfig(config) {
      const result = previousSetConfig10.call(this, config);
      scheduleDetail10(this, 0);
      return result;
    };
  }

  for (const method of ["_renderStatic", "_applyStaticLayers", "_ensureDom", "_applyViewBox"]) {
    const previous = proto[method];
    if (typeof previous !== "function") continue;
    proto[method] = function beta10EstoniaDetailWrapped(...args) {
      const result = previous.apply(this, args);
      scheduleDetail10(this, method === "_applyViewBox" ? DETAIL_DEBOUNCE_MS : 0);
      return result;
    };
  }

  console.info("[Navimower Map Card] 0.3.6-beta10 zoom-aware Maa- ja Ruumiamet WMS detail enabled");
})();
`;

source += patch;
await writeFile(sourcePath, source, "utf8");
console.log("Applied 0.3.6-beta10 zoom-aware Estonia orthophoto detail and WGS84 ellipsoid underlay geodesy");
