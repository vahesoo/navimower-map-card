import { readFile, writeFile } from "node:fs/promises";

const sourcePath = new URL("../src/navimower-map-card.js", import.meta.url);
let source = await readFile(sourcePath, "utf8");
const marker = "// 0.3.6-beta12: Google Satellite sharpness and provider-frame normalization.";
if (source.includes(marker)) {
  console.log("0.3.6-beta12 Google Satellite fixes already applied");
  process.exit(0);
}
if (!source.includes("// 0.3.6-beta11: unified map underlays, Estonia hybrid and Google Satellite.")) {
  throw new Error("Expected 0.3.6-beta11 runtime was not found");
}

const oldZoomBlock = `      const maxZoomRects = Array.isArray(payload?.maxZoomRects) ? payload.maxZoomRects : [];
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
      }`;

const newZoomBlock = `      const maxZoomRects = Array.isArray(payload?.maxZoomRects) ? payload.maxZoomRects : [];
      const reportedZooms = maxZoomRects
        .map((item) => finite11(item?.maxZoom ?? item?.max_zoom))
        .filter((value) => value !== null);
      if (reportedZooms.length) {
        // maxZoomRects are overlapping availability regions, not independent
        // viewport-wide caps. A low-resolution fallback rectangle may overlap a
        // high-resolution imagery rectangle, so taking the minimum collapses a
        // sharp z19 view to a much coarser zoom as soon as attribution arrives.
        const centerLat = (bounds.north + bounds.south) / 2;
        const centerLon = (bounds.east + bounds.west) / 2;
        const centerZooms = maxZoomRects
          .filter((item) => {
            const north = finite11(item?.north);
            const south = finite11(item?.south);
            const east = finite11(item?.east);
            const west = finite11(item?.west);
            if ([north, south, east, west].some((value) => value === null)) return false;
            const latitudeInside = centerLat <= north && centerLat >= south;
            const longitudeInside = west <= east
              ? centerLon >= west && centerLon <= east
              : centerLon >= west || centerLon <= east;
            return latitudeInside && longitudeInside;
          })
          .map((item) => finite11(item?.maxZoom ?? item?.max_zoom))
          .filter((value) => value !== null);
        const candidates = centerZooms.length ? centerZooms : reportedZooms;
        const nextZoom = clamp11(Math.floor(Math.max(...candidates)), MIN_GOOGLE_ZOOM11, DEFAULT_GOOGLE_ZOOM11);
        const currentZoom = clamp11(card._googleSatelliteMaxZoom11 ?? DEFAULT_GOOGLE_ZOOM11, MIN_GOOGLE_ZOOM11, DEFAULT_GOOGLE_ZOOM11);
        card._googleSatelliteViewportZoomRange11 = {
          min: Math.min(...reportedZooms),
          max: Math.max(...reportedZooms),
          selected: nextZoom,
        };
        if (nextZoom !== currentZoom) {
          card._googleSatelliteMaxZoom11 = nextZoom;
          queueMicrotask(() => card._syncOsmUnderlay036?.());
        }
      }`;

if (!source.includes(oldZoomBlock)) {
  throw new Error("beta11 Google viewport zoom block was not found");
}
source = source.replace(oldZoomBlock, newZoomBlock);

const syncSingleMarker = `  const syncSingle = (card) => {`;
if (!source.includes(syncSingleMarker)) throw new Error("beta11 single underlay renderer was not found");
const frameHelpers = `  const googleDynamicFrameOffset12 = (card) => {
    if (underlayProvider(card) !== "google_satellite") return null;
    const frame = georeference(card)?.cartographic_frame;
    const east = finite(frame?.east_m);
    const north = finite(frame?.north_m);
    if (frame?.applied !== true || east === null || north === null) return null;
    return { east, north };
  };

  const googleDynamicGeoreference12 = (card, geo) => {
    const frameOffset = googleDynamicFrameOffset12(card);
    if (!frameOffset || !validGeoreference(geo)) return geo;
    const ref = geo?.reference || {};
    const restored = offsetWgs84(
      Number(ref.latitude),
      Number(ref.longitude),
      -frameOffset.east,
      -frameOffset.north,
    );
    if (!restored || finite(restored.lat) === null || finite(restored.lon) === null) return geo;
    card._googleSatelliteFrameCorrection11 = {
      mode: "inverse_active_cartographic_translation",
      east_m: -frameOffset.east,
      north_m: -frameOffset.north,
    };
    return {
      ...geo,
      reference: {
        ...ref,
        latitude: restored.lat,
        longitude: restored.lon,
      },
    };
  };

  const googleDynamicSiteOrigin12 = (card, origin) => {
    const frameOffset = googleDynamicFrameOffset12(card);
    const latitude = finite(origin?.latitude);
    const longitude = finite(origin?.longitude);
    if (!frameOffset || latitude === null || longitude === null) return origin;
    const restored = offsetWgs84(
      latitude,
      longitude,
      -frameOffset.east,
      -frameOffset.north,
    );
    if (!restored || finite(restored.lat) === null || finite(restored.lon) === null) return origin;
    card._googleSatelliteFrameCorrection11 = {
      mode: "inverse_active_cartographic_translation",
      east_m: -frameOffset.east,
      north_m: -frameOffset.north,
    };
    return { ...origin, latitude: restored.lat, longitude: restored.lon };
  };

`;
source = source.replace(syncSingleMarker, frameHelpers + syncSingleMarker);

const singlePattern = /  const syncSingle = \(card\) => \{[\s\S]*?\n  \};\n\n  const siteLayout/;
const singleMatch = source.match(singlePattern)?.[0];
if (!singleMatch) throw new Error("single underlay block was not found");
if (!singleMatch.includes("    const geo = georeference(card);")) throw new Error("single georeference contract was not found");
const updatedSingle = singleMatch.replace(
  "    const geo = georeference(card);",
  "    const activeGeo = georeference(card);\n    const geo = googleDynamicGeoreference12(card, activeGeo);",
);
source = source.replace(singleMatch, updatedSingle);

const multiPattern = /  const syncMulti = \(card\) => \{[\s\S]*?\n  \};\n\n  const syncCard/;
const multiMatch = source.match(multiPattern)?.[0];
if (!multiMatch) throw new Error("multi underlay block was not found");
if (!multiMatch.includes("    const origin = site?.origin || {};")) throw new Error("multi site-origin contract was not found");
const updatedMulti = multiMatch.replace(
  "    const origin = site?.origin || {};",
  "    const origin = googleDynamicSiteOrigin12(card, site?.origin || {});",
);
source = source.replace(multiMatch, updatedMulti);

source += `\n\n${marker}\nconsole.info("[Navimower Map Card] 0.3.6-beta12 Google Satellite sharpness and provider-frame normalization enabled");\n`;

await writeFile(sourcePath, source, "utf8");
console.log("Applied 0.3.6-beta12 Google Satellite sharpness and provider-frame fixes");
