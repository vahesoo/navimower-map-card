import { readFile, writeFile } from "node:fs/promises";

const sourcePath = new URL("../src/navimower-map-card.js", import.meta.url);
let source = await readFile(sourcePath, "utf8");
const marker = "// 0.3.6-beta5: optional OpenStreetMap underlay.";
if (source.includes(marker)) {
  console.log("0.3.6-beta5 OSM underlay already applied");
  process.exit(0);
}
if (!source.includes("0.3.6-beta4: strict member schedule and clickable multi-zone labels.")) {
  throw new Error("Expected 0.3.6-beta4 runtime was not found");
}

const patch = `

${marker}
(() => {
  const Card = globalThis.customElements?.get?.("navimower-map-card");
  if (!Card || Card.__navimower036Beta5Osm) return;
  Card.__navimower036Beta5Osm = true;

  const proto = Card.prototype;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const EARTH_RADIUS_M = 6378137;
  const DEFAULT_OPACITY = 0.55;
  const DEFAULT_ZOOM = 19;
  const MAX_TILES = 36;

  const finite = (value, fallback = null) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, finite(value, minimum)));
  const underlayEnabled = (card) => String(card?._config?.map_underlay || "none").toLowerCase() === "openstreetmap";
  const underlayOpacity = (card) => clamp(card?._config?.osm_underlay_opacity ?? DEFAULT_OPACITY, 0.1, 1);

  const georeference = (card) => card?._mapPayload?.georeference || card?._mapPayload?.map?.georeference || null;
  const validGeoreference = (value) => {
    if (!value || typeof value !== "object") return false;
    const ref = value.reference || {};
    const complete = [ref.local_x, ref.local_y, ref.latitude, ref.longitude, value.rotation_rad].every((item) => finite(item) !== null);
    if (!complete) return false;
    return value.status === "validated" || value?.validation?.valid === true;
  };

  const offsetMeters = (lat0, lon0, lat, lon) => {
    const meanLat = ((lat0 + lat) / 2) * Math.PI / 180;
    return {
      east: (lon - lon0) * Math.PI / 180 * EARTH_RADIUS_M * Math.cos(meanLat),
      north: (lat - lat0) * Math.PI / 180 * EARTH_RADIUS_M,
    };
  };

  const offsetWgs84 = (lat0, lon0, east, north) => ({
    lat: lat0 + (north / EARTH_RADIUS_M) * 180 / Math.PI,
    lon: lon0 + (east / (EARTH_RADIUS_M * Math.cos(lat0 * Math.PI / 180))) * 180 / Math.PI,
  });

  const localToWgs84 = (geo, x, y) => {
    if (!validGeoreference(geo)) return null;
    const ref = geo.reference || {};
    const rotation = finite(geo.rotation_rad, 0);
    const dx = Number(x) - Number(ref.local_x);
    const dy = Number(y) - Number(ref.local_y);
    const east = dx * Math.cos(rotation) + dy * Math.sin(rotation);
    const north = -dx * Math.sin(rotation) + dy * Math.cos(rotation);
    return offsetWgs84(Number(ref.latitude), Number(ref.longitude), east, north);
  };

  const wgs84ToLocal = (geo, lat, lon) => {
    if (!validGeoreference(geo)) return null;
    const ref = geo.reference || {};
    const rotation = finite(geo.rotation_rad, 0);
    const { east, north } = offsetMeters(Number(ref.latitude), Number(ref.longitude), lat, lon);
    const dx = east * Math.cos(rotation) - north * Math.sin(rotation);
    const dy = east * Math.sin(rotation) + north * Math.cos(rotation);
    return { x: Number(ref.local_x) + dx, y: Number(ref.local_y) + dy };
  };

  const tilePoint = (lat, lon, zoom) => {
    const n = 2 ** zoom;
    const safeLat = clamp(lat, -85.05112878, 85.05112878);
    const latRad = safeLat * Math.PI / 180;
    return {
      x: (lon + 180) / 360 * n,
      y: (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n,
    };
  };

  const tileBounds = (x, y, zoom) => {
    const n = 2 ** zoom;
    const lonLeft = x / n * 360 - 180;
    const lonRight = (x + 1) / n * 360 - 180;
    const latAt = (tileY) => Math.atan(Math.sinh(Math.PI * (1 - 2 * tileY / n))) * 180 / Math.PI;
    return { west: lonLeft, east: lonRight, north: latAt(y), south: latAt(y + 1) };
  };

  const chooseTiles = (bounds) => {
    if (!bounds) return null;
    for (let zoom = DEFAULT_ZOOM; zoom >= 15; zoom -= 1) {
      const nw = tilePoint(bounds.north, bounds.west, zoom);
      const se = tilePoint(bounds.south, bounds.east, zoom);
      const minX = Math.floor(Math.min(nw.x, se.x));
      const maxX = Math.floor(Math.max(nw.x, se.x));
      const minY = Math.floor(Math.min(nw.y, se.y));
      const maxY = Math.floor(Math.max(nw.y, se.y));
      const count = (maxX - minX + 1) * (maxY - minY + 1);
      if (count <= MAX_TILES || zoom === 15) return { zoom, minX, maxX, minY, maxY };
    }
    return null;
  };

  const mapPoints = (map) => {
    const points = [];
    const add = (value) => {
      for (const point of Array.isArray(value) ? value : []) {
        if (Array.isArray(point) && finite(point[0]) !== null && finite(point[1]) !== null) points.push([Number(point[0]), Number(point[1])]);
      }
    };
    for (const zone of map?.zones || []) add(zone?.polygon);
    for (const polygon of map?.off_limit_areas || []) add(polygon);
    for (const polygon of map?.vf_off_areas || []) add(polygon);
    for (const channel of map?.channels || []) add(channel?.points);
    const station = map?.station;
    if (finite(station?.x) !== null && finite(station?.y) !== null) points.push([Number(station.x), Number(station.y)]);
    return points;
  };

  const paddedBounds = (items, paddingM = 18) => {
    if (!items.length) return null;
    let north = Math.max(...items.map((item) => item.lat));
    let south = Math.min(...items.map((item) => item.lat));
    let east = Math.max(...items.map((item) => item.lon));
    let west = Math.min(...items.map((item) => item.lon));
    const centerLat = (north + south) / 2;
    const dLat = paddingM / EARTH_RADIUS_M * 180 / Math.PI;
    const dLon = paddingM / (EARTH_RADIUS_M * Math.max(0.01, Math.cos(centerLat * Math.PI / 180))) * 180 / Math.PI;
    north += dLat; south -= dLat; east += dLon; west -= dLon;
    return { north, south, east, west };
  };

  const tileMarkup = (bounds, screenPoint, opacity) => {
    const range = chooseTiles(bounds);
    if (!range) return "";
    const images = [];
    for (let y = range.minY; y <= range.maxY; y += 1) {
      for (let x = range.minX; x <= range.maxX; x += 1) {
        const box = tileBounds(x, y, range.zoom);
        const nw = screenPoint(box.north, box.west);
        const ne = screenPoint(box.north, box.east);
        const sw = screenPoint(box.south, box.west);
        if (![nw, ne, sw].every((point) => point && finite(point.x) !== null && finite(point.y) !== null)) continue;
        const a = (ne.x - nw.x) / 256;
        const b = (ne.y - nw.y) / 256;
        const c = (sw.x - nw.x) / 256;
        const d = (sw.y - nw.y) / 256;
        const href = "https://tile.openstreetmap.org/" + range.zoom + "/" + x + "/" + y + ".png";
        images.push('<image href="' + href + '" x="0" y="0" width="256" height="256" preserveAspectRatio="none" opacity="' + opacity.toFixed(2) + '" transform="matrix(' + [a,b,c,d,nw.x,nw.y].map((v) => Number(v).toFixed(8)).join(" ") + ')"/>');
      }
    }
    return images.join("");
  };

  const ensureAttribution = (card, visible) => {
    const wrap = card?.querySelector?.(".nm-wrap");
    if (!wrap) return;
    let node = wrap.querySelector?.(".nm-osm-attribution");
    if (!node) {
      node = document.createElement("div");
      node.className = "nm-osm-attribution";
      node.innerHTML = '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>';
      Object.assign(node.style, {
        position: "absolute", right: "4px", bottom: "4px", zIndex: "8",
        padding: "2px 5px", borderRadius: "4px", fontSize: "10px", lineHeight: "1.2",
        background: "rgba(255,255,255,.78)", color: "#37474f",
      });
      node.querySelector("a").style.cssText = "color:inherit;text-decoration:none";
      wrap.appendChild(node);
    }
    node.hidden = !visible;
  };

  const insertOsmGroup = (layer, markup) => {
    layer?.querySelector?.(".nm-osm-underlay")?.remove?.();
    if (!layer || !markup) return false;
    const group = document.createElementNS(SVG_NS, "g");
    group.setAttribute("class", "nm-osm-underlay");
    group.setAttribute("pointer-events", "none");
    group.innerHTML = markup;
    const first = layer.firstElementChild;
    if (first?.nextSibling) layer.insertBefore(group, first.nextSibling);
    else layer.appendChild(group);
    return true;
  };

  const syncSingle = (card) => {
    if (!card?._baseEl) return false;
    if (!underlayEnabled(card)) {
      card._baseEl.querySelector?.(".nm-osm-underlay")?.remove?.();
      return false;
    }
    const geo = georeference(card);
    if (!validGeoreference(geo) || !card._layout?.sx || !card._layout?.sy) {
      card._baseEl.querySelector?.(".nm-osm-underlay")?.remove?.();
      return false;
    }
    const gps = mapPoints(card?._mapPayload?.map || {}).map(([x, y]) => localToWgs84(geo, x, y)).filter(Boolean);
    const bounds = paddedBounds(gps);
    const markup = tileMarkup(bounds, (lat, lon) => {
      const local = wgs84ToLocal(geo, lat, lon);
      return local ? { x: card._layout.sx(local.x), y: card._layout.sy(local.y) } : null;
    }, underlayOpacity(card));
    return insertOsmGroup(card._baseEl, markup);
  };

  const siteLayout = (site) => {
    const box = site?.combined_svg_bounds;
    if (!box || [box.min_x, box.min_y, box.max_x, box.max_y].some((value) => finite(value) === null)) return null;
    const width = Math.max(1, Number(box.max_x) - Number(box.min_x));
    const height = Math.max(1, Number(box.max_y) - Number(box.min_y));
    const padding = 55;
    const scale = Math.min((1000 - padding * 2) / width, (1000 - padding * 2) / height);
    return {
      scale,
      offsetX: (1000 - width * scale) / 2 - Number(box.min_x) * scale,
      offsetY: (1000 - height * scale) / 2 - Number(box.min_y) * scale,
      box,
    };
  };

  const syncMulti = (card) => {
    const layer = card?._multi036Layer;
    if (!layer) return false;
    if (!underlayEnabled(card) || layer.style.display === "none") {
      layer.querySelector?.(".nm-osm-underlay")?.remove?.();
      return false;
    }
    const site = card?._multi036Site;
    const origin = site?.origin || {};
    const lat0 = finite(origin.latitude);
    const lon0 = finite(origin.longitude);
    const layout = siteLayout(site);
    if (lat0 === null || lon0 === null || !layout || site?.status !== "validated") {
      layer.querySelector?.(".nm-osm-underlay")?.remove?.();
      return false;
    }
    const siteBox = site?.combined_site_bounds;
    if (!siteBox || [siteBox.min_east, siteBox.max_east, siteBox.min_north, siteBox.max_north].some((value) => finite(value) === null)) return false;
    const corners = [
      offsetWgs84(lat0, lon0, Number(siteBox.min_east), Number(siteBox.min_north)),
      offsetWgs84(lat0, lon0, Number(siteBox.min_east), Number(siteBox.max_north)),
      offsetWgs84(lat0, lon0, Number(siteBox.max_east), Number(siteBox.min_north)),
      offsetWgs84(lat0, lon0, Number(siteBox.max_east), Number(siteBox.max_north)),
    ];
    const bounds = paddedBounds(corners);
    const markup = tileMarkup(bounds, (lat, lon) => {
      const { east, north } = offsetMeters(lat0, lon0, lat, lon);
      return { x: layout.offsetX + east * layout.scale, y: layout.offsetY - north * layout.scale };
    }, underlayOpacity(card));
    return insertOsmGroup(layer, markup);
  };

  const syncCard = (card) => {
    if (!card?._config || typeof document === "undefined") return;
    const multiVisible = Boolean(card?._multi036Layer && card._multi036Layer.style.display !== "none");
    const visible = multiVisible ? syncMulti(card) : syncSingle(card);
    ensureAttribution(card, underlayEnabled(card) && visible);
    if (card?._multi036Layer && !card._osm036Observer) {
      const observer = new MutationObserver(() => {
        if (card._osm036Mutating) return;
        card._osm036Mutating = true;
        queueMicrotask(() => {
          syncCard(card);
          card._osm036Mutating = false;
        });
      });
      observer.observe(card._multi036Layer, { childList: true });
      card._osm036Observer = observer;
    }
  };

  const previousStub = Card.getStubConfig?.bind(Card);
  Card.getStubConfig = (...args) => ({ ...(previousStub?.(...args) || {}), map_underlay: "none", osm_underlay_opacity: DEFAULT_OPACITY });

  const previousForm = Card.getConfigForm?.bind(Card);
  Card.getConfigForm = (...args) => {
    const form = previousForm?.(...args) || { schema: [] };
    const walkArrays = (items) => {
      if (!Array.isArray(items)) return false;
      const index = items.findIndex((item) => item?.name === "map_background_color");
      if (index >= 0) {
        if (!items.some((item) => item?.name === "map_underlay")) {
          items.splice(index + 1, 0,
            { name: "map_underlay", selector: { select: { options: [
              { value: "none", label: "None" },
              { value: "openstreetmap", label: "OpenStreetMap" },
            ] } } },
            { name: "osm_underlay_opacity", selector: { number: { min: 0.1, max: 1, step: 0.05, mode: "slider" } } },
          );
        }
        return true;
      }
      for (const item of items) if (walkArrays(item?.schema)) return true;
      return false;
    };
    walkArrays(form.schema);
    const baseLabel = typeof form.computeLabel === "function" ? form.computeLabel : null;
    form.computeLabel = (schema, data) => schema?.name === "map_underlay" ? "Map underlay" : schema?.name === "osm_underlay_opacity" ? "OSM underlay opacity" : baseLabel?.(schema, data) || schema?.name || "";
    return form;
  };

  const previousSetConfig = proto.setConfig;
  if (typeof previousSetConfig === "function") {
    proto.setConfig = function beta5OsmSetConfig(config) {
      const next = { ...(config || {}) };
      if (next.map_underlay === undefined) next.map_underlay = "none";
      if (next.osm_underlay_opacity === undefined) next.osm_underlay_opacity = DEFAULT_OPACITY;
      const result = previousSetConfig.call(this, next);
      queueMicrotask(() => syncCard(this));
      return result;
    };
  }

  const previousStaticCacheKey = proto._staticCacheKey;
  if (typeof previousStaticCacheKey === "function") {
    proto._staticCacheKey = function beta5OsmStaticKey(...args) {
      return [previousStaticCacheKey.apply(this, args), this?._config?.map_underlay || "none", this?._config?.osm_underlay_opacity ?? DEFAULT_OPACITY].join("|");
    };
  }

  for (const method of ["_renderStatic", "_applyStaticLayers", "_ensureDom", "_applyViewBox"]) {
    const previous = proto[method];
    if (typeof previous !== "function") continue;
    proto[method] = function beta5OsmWrapped(...args) {
      const result = previous.apply(this, args);
      queueMicrotask(() => syncCard(this));
      return result;
    };
  }

  const hassDescriptor = Object.getOwnPropertyDescriptor(proto, "hass");
  if (hassDescriptor?.set) {
    Object.defineProperty(proto, "hass", {
      configurable: true,
      get: hassDescriptor.get,
      set(value) {
        hassDescriptor.set.call(this, value);
        queueMicrotask(() => syncCard(this));
      },
    });
  }

  console.info("[Navimower Map Card] 0.3.6-beta5 optional OpenStreetMap underlay enabled");
})();
`;

source += patch;
await writeFile(sourcePath, source, "utf8");
console.log("Applied 0.3.6-beta5 OpenStreetMap underlay");
