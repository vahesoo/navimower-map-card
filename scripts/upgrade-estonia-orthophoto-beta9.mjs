import { readFile, writeFile } from "node:fs/promises";

const sourcePath = new URL("../src/navimower-map-card.js", import.meta.url);
let source = await readFile(sourcePath, "utf8");
const marker = "// 0.3.6-beta9: Estonia orthophoto editor availability and zoom fix.";
if (source.includes(marker)) {
  console.log("0.3.6-beta9 Estonia orthophoto fixes already applied");
  process.exit(0);
}
if (!source.includes("// 0.3.6-beta8: Estonia orthophoto underlay.")) {
  throw new Error("Expected 0.3.6-beta8 runtime was not found");
}

const oldEligibility = `    const rootHass = globalThis.document?.querySelector?.("home-assistant")?.hass;
    const country = String(rootHass?.config?.country || "").toUpperCase();
    const estoniaUnderlayAvailable = country === "EE" || Card.__navimower036EstoniaSite === true;`;

const newEligibility = `    const rootHass = globalThis.document?.querySelector?.("home-assistant")?.hass;
    const haConfig = rootHass?.config || {};
    const country = String(haConfig.country || "").toUpperCase();
    const homeLatitude = finite(haConfig.latitude);
    const homeLongitude = finite(haConfig.longitude);
    const homeInEstonia = homeLatitude !== null && homeLongitude !== null
      && isEstoniaLocation(homeLatitude, homeLongitude);
    const haTimeZone = String(haConfig.time_zone || "");
    let browserTimeZone = "";
    try {
      browserTimeZone = String(Intl.DateTimeFormat().resolvedOptions().timeZone || "");
    } catch (_error) {
      browserTimeZone = "";
    }
    const estoniaUnderlayAvailable = country === "EE"
      || homeInEstonia
      || haTimeZone === "Europe/Tallinn"
      || browserTimeZone === "Europe/Tallinn"
      || Card.__navimower036EstoniaSite === true;`;

if (!source.includes(oldEligibility)) {
  throw new Error("beta8 Estonia editor availability contract was not found");
}
source = source.replace(oldEligibility, newEligibility);

const oldChooseTilesStart = `  const chooseTiles = (bounds) => {
    if (!bounds) return null;
    for (let zoom = DEFAULT_ZOOM; zoom >= 15; zoom -= 1) {`;
const newChooseTilesStart = `  const chooseTiles = (bounds, maxZoom = DEFAULT_ZOOM) => {
    if (!bounds) return null;
    for (let zoom = Math.min(DEFAULT_ZOOM, maxZoom); zoom >= 15; zoom -= 1) {`;
if (!source.includes(oldChooseTilesStart)) {
  throw new Error("underlay tile zoom selector contract was not found");
}
source = source.replace(oldChooseTilesStart, newChooseTilesStart);

const oldRangeSelection = `    const range = chooseTiles(bounds);`;
const newRangeSelection = `    const range = chooseTiles(bounds, provider === "estonia_orthophoto" ? 18 : DEFAULT_ZOOM);`;
if (!source.includes(oldRangeSelection)) {
  throw new Error("underlay tile range selection contract was not found");
}
source = source.replace(oldRangeSelection, newRangeSelection);

source += `\n\n${marker}\nconsole.info("[Navimower Map Card] 0.3.6-beta9 Estonia orthophoto editor availability and zoom fixes enabled");\n`;

await writeFile(sourcePath, source, "utf8");
console.log("Applied 0.3.6-beta9 Estonia orthophoto editor availability and zoom fixes");
