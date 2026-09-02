import { readFile, writeFile } from "node:fs/promises";

const sourcePath = new URL("../src/navimower-map-card.js", import.meta.url);
let source = await readFile(sourcePath, "utf8");
const marker = "// 0.3.6-beta11: unified map underlays, Estonia hybrid and Google Satellite.";
if (source.includes(marker)) {
  console.log("0.3.6-beta11 unified map underlays already applied");
  process.exit(0);
}
if (!source.includes("// 0.3.6-beta10: zoom-aware Estonia orthophoto detail and WGS84 ellipsoid underlay geodesy.")) {
  throw new Error("Expected 0.3.6-beta10 runtime was not found");
}

const oldUnderlayHelpers = `  const underlayProvider = (card) => String(card?._config?.map_underlay || "none").toLowerCase();
  const underlayEnabled = (card) => ["openstreetmap", "estonia_orthophoto"].includes(underlayProvider(card));
  const underlayOpacity = (card) => clamp(card?._config?.osm_underlay_opacity ?? DEFAULT_OPACITY, 0.1, 1);`;
const newUnderlayHelpers = `  const underlayProvider = (card) => String(card?._config?.map_underlay || "none").toLowerCase();
  const frontendUnderlayMetadata = (card) => {
    const multi = card?._multi036Site?.anchor_frontend?.map_underlays;
    if (multi && typeof multi === "object") return multi;
    const single = card?._mapPayload?.frontend?.map_underlays;
    return single && typeof single === "object" ? single : {};
  };
  const providerAvailable = (card, provider = underlayProvider(card)) => {
    if (provider === "openstreetmap") return true;
    const metadata = frontendUnderlayMetadata(card);
    if (provider === "google_satellite") {
      return metadata?.google_satellite?.available === true
        && Boolean(metadata?.google_satellite?.tile_api_path_template);
    }
    if (["estonia_orthophoto", "estonia_hybrid"].includes(provider)) {
      const advertised = metadata?.[provider]?.available;
      return advertised === undefined ? true : advertised === true;
    }
    return false;
  };
  const underlayEnabled = (card) => ["openstreetmap", "estonia_orthophoto", "estonia_hybrid", "google_satellite"].includes(underlayProvider(card))
    && providerAvailable(card);
  const underlayOpacity = (card) => clamp(card?._config?.underlay_opacity ?? card?._config?.osm_underlay_opacity ?? DEFAULT_OPACITY, 0.1, 1);
  const googleTileTemplate = (card) => String(frontendUnderlayMetadata(card)?.google_satellite?.tile_api_path_template || "");
  const googleMaxZoom = (card) => clamp(card?._googleSatelliteMaxZoom11 ?? DEFAULT_ZOOM, 15, DEFAULT_ZOOM);`;
if (!source.includes(oldUnderlayHelpers)) throw new Error("beta10 underlay helper contract was not found");
source = source.replace(oldUnderlayHelpers, newUnderlayHelpers);

const tileMarkupPattern = /  const tileMarkup = \(bounds, screenPoint, opacity, provider = "openstreetmap"\) => \{[\s\S]*?\n  \};\n\n  const ensureAttribution/;
if (!tileMarkupPattern.test(source)) throw new Error("beta10 underlay tile renderer was not found");
const newTileMarkup = `  const tileMarkup = (bounds, screenPoint, opacity, provider = "openstreetmap", googleTemplate = "", googleZoom = DEFAULT_ZOOM) => {
    const providerMaxZoom = ["estonia_orthophoto", "estonia_hybrid"].includes(provider)
      ? 18
      : provider === "google_satellite" ? googleZoom : DEFAULT_ZOOM;
    const range = chooseTiles(bounds, providerMaxZoom);
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
        const transform = [a, b, c, d, nw.x, nw.y].map((value) => Number(value).toFixed(8)).join(" ");
        const tmsY = 2 ** range.zoom - 1 - y;
        const photoHref = "https://tiles.maaamet.ee/tm/tms/1.0.0/foto@GMC/" + range.zoom + "/" + x + "/" + tmsY + ".png?ASUTUS=NAVIMOWER&KESKKOND=LIVE&IS=NAVIMOWER_MAP_CARD";
        if (provider === "estonia_hybrid") {
          const hybridHref = "https://tiles.maaamet.ee/tm/tms/1.0.0/hybriid@GMC/" + range.zoom + "/" + x + "/" + tmsY + ".png?ASUTUS=NAVIMOWER&KESKKOND=LIVE&IS=NAVIMOWER_MAP_CARD";
          images.push('<image href="' + photoHref + '" x="0" y="0" width="256" height="256" preserveAspectRatio="none" opacity="' + opacity.toFixed(2) + '" transform="matrix(' + transform + ')"/>');
          images.push('<image href="' + hybridHref + '" x="0" y="0" width="256" height="256" preserveAspectRatio="none" opacity="' + opacity.toFixed(2) + '" transform="matrix(' + transform + ')"/>');
          continue;
        }
        if (provider === "google_satellite") {
          const proxyPath = String(googleTemplate || "")
            .replace("{z}", String(range.zoom))
            .replace("{x}", String(x))
            .replace("{y}", String(y));
          if (!proxyPath) continue;
          images.push('<image data-nm-google-path="' + proxyPath + '" data-nm-google-z="' + range.zoom + '" data-nm-google-x="' + x + '" data-nm-google-y="' + y + '" href="" x="0" y="0" width="256" height="256" preserveAspectRatio="none" opacity="' + opacity.toFixed(2) + '" transform="matrix(' + transform + ')"/>');
          continue;
        }
        const href = provider === "estonia_orthophoto"
          ? photoHref
          : "https://tile.openstreetmap.org/" + range.zoom + "/" + x + "/" + y + ".png";
        images.push('<image href="' + href + '" x="0" y="0" width="256" height="256" preserveAspectRatio="none" opacity="' + opacity.toFixed(2) + '" transform="matrix(' + transform + ')"/>');
      }
    }
    return images.join("");
  };

  const ensureAttribution`;
source = source.replace(tileMarkupPattern, newTileMarkup);

const attributionPattern = /  const ensureAttribution = \(card, visible\) => \{[\s\S]*?\n  \};\n\n  const insertOsmGroup/;
if (!attributionPattern.test(source)) throw new Error("beta10 underlay attribution renderer was not found");
source = source.replace(attributionPattern, `  const ensureAttribution = (card, visible) => {
    const wrap = card?.querySelector?.(".nm-wrap");
    if (!wrap) return;
    const provider = underlayProvider(card);
    let node = wrap.querySelector?.(".nm-osm-attribution");
    if (!node) {
      node = document.createElement("div");
      node.className = "nm-osm-attribution";
      Object.assign(node.style, {
        position: "absolute", right: "4px", bottom: "4px", zIndex: "8",
        padding: "2px 5px", borderRadius: "4px", fontSize: "10px", lineHeight: "1.2",
        background: "rgba(255,255,255,.78)", color: "#37474f",
      });
      wrap.appendChild(node);
    }
    if (node.dataset.provider !== provider) {
      node.dataset.provider = provider;
      if (["estonia_orthophoto", "estonia_hybrid"].includes(provider)) {
        node.innerHTML = '<a href="https://geoportaal.maaamet.ee/" target="_blank" rel="noopener noreferrer">Aluskaart: Maa- ja Ruumiamet</a>';
      } else if (provider === "google_satellite") {
        node.textContent = "Google Maps";
      } else {
        node.innerHTML = '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>';
      }
      const link = node.querySelector("a");
      if (link) link.style.cssText = "color:inherit;text-decoration:none";
    }
    node.hidden = !visible;
  };

  const insertOsmGroup`);

const oldInsertGroup = `  const insertOsmGroup = (layer, markup) => {
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
  };`;
const newInsertGroup = `  const insertOsmGroup = (layer, markup) => {
    if (!layer || !markup) {
      layer?.querySelector?.(".nm-osm-underlay")?.remove?.();
      return false;
    }
    const markupKey = fastHash(markup);
    const current = layer.querySelector?.(".nm-osm-underlay");
    if (current?.dataset?.underlayKey === markupKey) return true;
    current?.remove?.();
    const group = document.createElementNS(SVG_NS, "g");
    group.setAttribute("class", "nm-osm-underlay");
    group.setAttribute("pointer-events", "none");
    group.dataset.underlayKey = markupKey;
    group.innerHTML = markup;
    const first = layer.firstElementChild;
    if (first?.nextSibling) layer.insertBefore(group, first.nextSibling);
    else layer.appendChild(group);
    return true;
  };`;
if (!source.includes(oldInsertGroup)) throw new Error("beta10 underlay group insertion contract was not found");
source = source.replace(oldInsertGroup, newInsertGroup);

const oldEstoniaGuard = `if (underlayProvider(card) === "estonia_orthophoto" && !inEstonia) {`;
const estoniaGuardCount = source.split(oldEstoniaGuard).length - 1;
if (estoniaGuardCount !== 2) throw new Error(`Expected two Estonia underlay guards, found ${estoniaGuardCount}`);
source = source.split(oldEstoniaGuard).join(`if (["estonia_orthophoto", "estonia_hybrid"].includes(underlayProvider(card)) && !inEstonia) {`);

const oldTileCall = `    }, underlayOpacity(card), underlayProvider(card));`;
const tileCallCount = source.split(oldTileCall).length - 1;
if (tileCallCount !== 2) throw new Error(`Expected two underlay tile calls, found ${tileCallCount}`);
source = source.split(oldTileCall).join(`    }, underlayOpacity(card), underlayProvider(card), googleTileTemplate(card), googleMaxZoom(card));`);

const oldStaticKey = `      return [previousStaticCacheKey.apply(this, args), this?._config?.map_underlay || "none", this?._config?.osm_underlay_opacity ?? DEFAULT_OPACITY].join("|");`;
const newStaticKey = `      return [previousStaticCacheKey.apply(this, args), this?._config?.map_underlay || "none", this?._config?.underlay_opacity ?? this?._config?.osm_underlay_opacity ?? DEFAULT_OPACITY].join("|");`;
if (!source.includes(oldStaticKey)) throw new Error("beta10 underlay static cache key contract was not found");
source = source.replace(oldStaticKey, newStaticKey);

const oldMultiBackgroundExpression = `["openstreetmap", "estonia_orthophoto"].includes(String(card?._config?.map_underlay || "none").toLowerCase())`;
const multiBackgroundCount = source.split(oldMultiBackgroundExpression).length - 1;
if (multiBackgroundCount !== 1) throw new Error(`Expected one Multi underlay background guard, found ${multiBackgroundCount}`);
source = source.replace(oldMultiBackgroundExpression, `["openstreetmap", "estonia_orthophoto", "estonia_hybrid", "google_satellite"].includes(String(card?._config?.map_underlay || "none").toLowerCase())`);

const oldDetailOpacity = `  const opacity10 = (card) => clamp10(finite10(card?._config?.osm_underlay_opacity, 0.55), 0.1, 1);`;
const newDetailOpacity = `  const opacity10 = (card) => clamp10(finite10(card?._config?.underlay_opacity ?? card?._config?.osm_underlay_opacity, 0.55), 0.1, 1);`;
if (!source.includes(oldDetailOpacity)) throw new Error("beta10 detail opacity contract was not found");
source = source.replace(oldDetailOpacity, newDetailOpacity);

const oldWmsSignature = `  const wmsUrl10 = (bounds, width, height) => {`;
const newWmsSignature = `  const wmsUrl10 = (bounds, width, height, provider = "estonia_orthophoto") => {`;
if (!source.includes(oldWmsSignature)) throw new Error("beta10 WMS URL signature was not found");
source = source.replace(oldWmsSignature, newWmsSignature);

const oldWmsLayer = `    params.set("LAYERS", "EESTIFOTO");`;
const newWmsLayer = `    params.set("LAYERS", provider === "estonia_hybrid" ? "EESTIFOTO,HYBRID" : "EESTIFOTO");`;
if (!source.includes(oldWmsLayer)) throw new Error("beta10 WMS layer contract was not found");
source = source.replace(oldWmsLayer, newWmsLayer);

const oldWmsCall = `    const url = wmsUrl10(bounds, size.width, size.height);`;
const newWmsCall = `    const url = wmsUrl10(bounds, size.width, size.height, provider10(card));`;
if (!source.includes(oldWmsCall)) throw new Error("beta10 WMS call contract was not found");
source = source.replace(oldWmsCall, newWmsCall);

const oldDetailGuard = `provider10(card) !== "estonia_orthophoto"`;
const detailGuardCount = source.split(oldDetailGuard).length - 1;
if (detailGuardCount !== 2) throw new Error(`Expected two beta10 detail provider guards, found ${detailGuardCount}`);
source = source.split(oldDetailGuard).join(`!["estonia_orthophoto", "estonia_hybrid"].includes(provider10(card))`);

const runtime = `

${marker}
(() => {
  const Card = globalThis.customElements?.get?.("navimower-map-card");
  if (!Card || Card.__navimower036Beta11MapUnderlays) return;
  Card.__navimower036Beta11MapUnderlays = true;

  const proto = Card.prototype;
  const DEFAULT_OPACITY11 = 0.55;
  const DEFAULT_GOOGLE_ZOOM11 = 19;
  const MIN_GOOGLE_ZOOM11 = 15;
  const GOOGLE_FETCH_CONCURRENCY11 = 6;
  const GOOGLE_RETRY_MS11 = 15000;

  const finite11 = (value, fallback = null) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const clamp11 = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, finite11(value, minimum)));
  const apiPath11 = (path) => String(path || "").replace(/^\\/api\\//, "").replace(/^\\/+/, "");
  const provider11 = (card) => String(card?._config?.map_underlay || "none").toLowerCase();
  const frontend11 = (card) => card?._multi036Site?.anchor_frontend || card?._mapPayload?.frontend || {};
  const googleMetadata11 = (card) => frontend11(card)?.map_underlays?.google_satellite || {};
  const googleViewportPath11 = (card) => String(googleMetadata11(card)?.viewport_api_path || "");

  const activeUnderlayLayer11 = (card) => {
    const multiVisible = Boolean(card?._multi036Layer && card._multi036Layer.style.display !== "none");
    return multiVisible ? card?._osm036MultiLayer : card?._baseEl;
  };

  const tileBounds11 = (x, y, zoom) => {
    const n = 2 ** zoom;
    const lonLeft = x / n * 360 - 180;
    const lonRight = (x + 1) / n * 360 - 180;
    const latAt = (tileY) => Math.atan(Math.sinh(Math.PI * (1 - 2 * tileY / n))) * 180 / Math.PI;
    return { west: lonLeft, east: lonRight, north: latAt(y), south: latAt(y + 1) };
  };

  const cleanupGoogleObjectUrls11 = (card) => {
    const urls = card?._googleTileObjectUrls11;
    if (!(urls instanceof Map)) return;
    for (const [image, url] of urls.entries()) {
      if (image?.isConnected) continue;
      try { URL.revokeObjectURL(url); } catch (_error) { /* no-op */ }
      urls.delete(image);
    }
  };

  const rawGet11 = async (card, path) => {
    const hass = card?._hass;
    if (!hass || !path) throw new Error("Google Satellite backend is unavailable");
    const relative = apiPath11(path);
    if (typeof hass.callApiRaw === "function") return await hass.callApiRaw("GET", relative);
    if (typeof hass.fetchWithAuth === "function") return await hass.fetchWithAuth("/api/" + relative);
    throw new Error("Authenticated binary requests are unavailable");
  };

  const hydrateGoogleTiles11 = async (card) => {
    cleanupGoogleObjectUrls11(card);
    if (provider11(card) !== "google_satellite") return;
    const metadata = googleMetadata11(card);
    if (metadata?.available !== true) return;
    const layer = activeUnderlayLayer11(card);
    if (!layer) return;
    const images = Array.from(layer.querySelectorAll?.('image[data-nm-google-path]') || []);
    if (!images.length) return;
    if (!(card._googleTileObjectUrls11 instanceof Map)) card._googleTileObjectUrls11 = new Map();
    const now = Date.now();
    const pending = images.filter((image) => {
      if (image.getAttribute("data-nm-google-loaded") === "1") return false;
      if (image.getAttribute("data-nm-google-loading") === "1") return false;
      const errorAt = finite11(image.getAttribute("data-nm-google-error-at"), 0);
      return !errorAt || now - errorAt >= GOOGLE_RETRY_MS11;
    });
    let cursor = 0;
    const worker = async () => {
      while (cursor < pending.length) {
        const index = cursor;
        cursor += 1;
        const image = pending[index];
        const path = image?.getAttribute?.("data-nm-google-path") || "";
        if (!image || !path) continue;
        image.setAttribute("data-nm-google-loading", "1");
        try {
          const response = await rawGet11(card, path);
          if (!response?.ok) throw new Error("Google Satellite tile request failed");
          const blob = await response.blob();
          const objectUrl = URL.createObjectURL(blob);
          if (!image.isConnected || provider11(card) !== "google_satellite") {
            URL.revokeObjectURL(objectUrl);
            continue;
          }
          const previous = card._googleTileObjectUrls11.get(image);
          if (previous && previous !== objectUrl) URL.revokeObjectURL(previous);
          card._googleTileObjectUrls11.set(image, objectUrl);
          image.setAttribute("href", objectUrl);
          image.setAttribute("data-nm-google-loaded", "1");
          image.removeAttribute("data-nm-google-error-at");
        } catch (_error) {
          image.setAttribute("data-nm-google-error-at", String(Date.now()));
        } finally {
          image.removeAttribute("data-nm-google-loading");
        }
      }
    };
    const workers = Array.from({ length: Math.min(GOOGLE_FETCH_CONCURRENCY11, pending.length) }, () => worker());
    await Promise.all(workers);
  };

  const viewportBounds11 = (images) => {
    const tiles = [];
    for (const image of images) {
      const zoom = finite11(image.getAttribute("data-nm-google-z"));
      const x = finite11(image.getAttribute("data-nm-google-x"));
      const y = finite11(image.getAttribute("data-nm-google-y"));
      if ([zoom, x, y].some((value) => value === null)) continue;
      tiles.push({ zoom, ...tileBounds11(x, y, zoom) });
    }
    if (!tiles.length) return null;
    const zoom = Math.round(tiles[0].zoom);
    return {
      zoom,
      north: Math.max(...tiles.map((tile) => tile.north)),
      south: Math.min(...tiles.map((tile) => tile.south)),
      east: Math.max(...tiles.map((tile) => tile.east)),
      west: Math.min(...tiles.map((tile) => tile.west)),
    };
  };

  const syncGoogleViewport11 = async (card) => {
    if (provider11(card) !== "google_satellite") return;
    const metadata = googleMetadata11(card);
    const viewportPath = googleViewportPath11(card);
    const layer = activeUnderlayLayer11(card);
    if (metadata?.available !== true || !viewportPath || !layer || typeof card?._hass?.callApi !== "function") return;
    const images = Array.from(layer.querySelectorAll?.('image[data-nm-google-path]') || []);
    const bounds = viewportBounds11(images);
    if (!bounds) return;
    const key = [viewportPath, bounds.zoom, bounds.north.toFixed(6), bounds.south.toFixed(6), bounds.east.toFixed(6), bounds.west.toFixed(6)].join("|");
    if (card._googleViewportKey11 === key || card._googleViewportPendingKey11 === key) return;
    card._googleViewportPendingKey11 = key;
    const params = new URLSearchParams({
      zoom: String(bounds.zoom),
      north: bounds.north.toFixed(8),
      south: bounds.south.toFixed(8),
      east: bounds.east.toFixed(8),
      west: bounds.west.toFixed(8),
    });
    try {
      const payload = await card._hass.callApi("GET", apiPath11(viewportPath + "?" + params.toString()));
      card._googleViewportKey11 = key;
      const attribution = card.querySelector?.(".nm-osm-attribution");
      if (attribution && attribution.dataset.provider === "google_satellite") {
        const copyright = String(payload?.copyright || "").trim();
        attribution.textContent = copyright ? "Google Maps · " + copyright : "Google Maps";
      }
      const maxZoomRects = Array.isArray(payload?.maxZoomRects) ? payload.maxZoomRects : [];
      const reportedZooms = maxZoomRects
        .map((item) => finite11(item?.maxZoom ?? item?.max_zoom))
        .filter((value) => value !== null);
      if (reportedZooms.length) {
        const nextZoom = clamp11(Math.floor(Math.min(...reportedZooms)), MIN_GOOGLE_ZOOM11, DEFAULT_GOOGLE_ZOOM11);
        const currentZoom = clamp11(card._googleSatelliteMaxZoom11 ?? DEFAULT_GOOGLE_ZOOM11, MIN_GOOGLE_ZOOM11, DEFAULT_GOOGLE_ZOOM11);
        if (nextZoom !== currentZoom) {
          card._googleSatelliteMaxZoom11 = nextZoom;
          queueMicrotask(() => card._syncOsmUnderlay036?.());
        }
      }
    } catch (_error) {
      card._googleViewportKey11 = null;
    } finally {
      card._googleViewportPendingKey11 = null;
    }
  };

  const refreshGoogle11 = async (card) => {
    cleanupGoogleObjectUrls11(card);
    if (provider11(card) !== "google_satellite") {
      card._googleViewportKey11 = null;
      card._googleViewportPendingKey11 = null;
      return;
    }
    await Promise.all([
      hydrateGoogleTiles11(card),
      syncGoogleViewport11(card),
    ]);
  };

  const scheduleGoogle11 = (card, delay = 0) => {
    if (!card) return;
    if (card._googleRefreshTimer11) return;
    card._googleRefreshTimer11 = setTimeout(() => {
      card._googleRefreshTimer11 = null;
      refreshGoogle11(card).catch(() => {});
    }, Math.max(0, delay));
  };

  const previousSync = proto._syncOsmUnderlay036;
  if (typeof previousSync === "function") {
    proto._syncOsmUnderlay036 = function beta11MapUnderlaySync(...args) {
      const result = previousSync.apply(this, args);
      scheduleGoogle11(this, 0);
      return result;
    };
  }

  const previousSetConfig = proto.setConfig;
  if (typeof previousSetConfig === "function") {
    proto.setConfig = function beta11MapUnderlaySetConfig(config) {
      const next = { ...(config || {}) };
      if (next.underlay_opacity === undefined && next.osm_underlay_opacity !== undefined) {
        next.underlay_opacity = next.osm_underlay_opacity;
      }
      if (next.underlay_opacity === undefined) next.underlay_opacity = DEFAULT_OPACITY11;
      const result = previousSetConfig.call(this, next);
      scheduleGoogle11(this, 0);
      return result;
    };
  }

  for (const method of ["_renderStatic", "_applyStaticLayers", "_ensureDom", "_applyViewBox"]) {
    const previous = proto[method];
    if (typeof previous !== "function") continue;
    proto[method] = function beta11MapUnderlayRefresh(...args) {
      const result = previous.apply(this, args);
      scheduleGoogle11(this, method === "_applyViewBox" ? 80 : 0);
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
        scheduleGoogle11(this, 0);
      },
    });
  }

  const previousStub = Card.getStubConfig?.bind(Card);
  Card.getStubConfig = (...args) => {
    const config = { ...(previousStub?.(...args) || {}) };
    const legacyOpacity = config.osm_underlay_opacity;
    delete config.osm_underlay_opacity;
    if (config.map_underlay === undefined) config.map_underlay = "none";
    if (config.underlay_opacity === undefined) config.underlay_opacity = legacyOpacity ?? DEFAULT_OPACITY11;
    return config;
  };

  const previousForm = Card.getConfigForm?.bind(Card);
  Card.getConfigForm = (...args) => {
    const form = previousForm?.(...args) || { schema: [] };
    if (!Array.isArray(form.schema)) return form;
    const fieldNames = new Set(["map_underlay", "osm_underlay_opacity", "underlay_opacity"]);
    const strip = (items) => (Array.isArray(items) ? items : []).filter((item) => {
      if (item?.name === "map_underlay_settings" || fieldNames.has(item?.name)) return false;
      if (Array.isArray(item?.schema)) item.schema = strip(item.schema);
      return true;
    });
    form.schema = strip(form.schema);
    form.schema.push({
      type: "expandable",
      name: "map_underlay_settings",
      title: "Map underlay",
      flatten: true,
      schema: [{
        type: "grid",
        name: "map_underlay_grid",
        flatten: true,
        column_min_width: "220px",
        schema: [
          { name: "map_underlay", selector: { select: { options: [
            { value: "none", label: "None" },
            { value: "openstreetmap", label: "OpenStreetMap" },
            { value: "estonia_orthophoto", label: "Ortofoto" },
            { value: "estonia_hybrid", label: "Hübriid" },
            { value: "google_satellite", label: "Google Satellite" },
          ] } } },
          { name: "underlay_opacity", selector: { number: { min: 0.1, max: 1, step: 0.05, mode: "slider" } } },
        ],
      }],
    });
    const baseLabel = typeof form.computeLabel === "function" ? form.computeLabel : null;
    form.computeLabel = (schema, data) => schema?.name === "map_underlay"
      ? "Map underlay"
      : schema?.name === "underlay_opacity"
        ? "Underlay opacity"
        : baseLabel?.(schema, data) || schema?.name || "";
    return form;
  };

  console.info("[Navimower Map Card] 0.3.6-beta11 unified map underlays enabled");
})();
`;

source += runtime;
await writeFile(sourcePath, source, "utf8");
console.log("Applied 0.3.6-beta11 unified map underlays");
