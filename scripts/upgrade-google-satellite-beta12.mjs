import { readFile, writeFile } from "node:fs/promises";

const sourcePath = new URL("../src/navimower-map-card.js", import.meta.url);
let source = await readFile(sourcePath, "utf8");
const marker = "// 0.3.6-beta12: preserve Google Satellite detail after viewport metadata.";
if (source.includes(marker)) {
  console.log("0.3.6-beta12 Google Satellite sharpness fix already applied");
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
source += `\n\n${marker}\nconsole.info("[Navimower Map Card] 0.3.6-beta12 Google Satellite viewport sharpness fix enabled");\n`;

await writeFile(sourcePath, source, "utf8");
console.log("Applied 0.3.6-beta12 Google Satellite viewport sharpness fix");
