import { readFile, writeFile } from "node:fs/promises";

const sourcePath = new URL("../src/navimower-map-card.js", import.meta.url);
let source = await readFile(sourcePath, "utf8");
const marker = "// 0.3.6-beta9: Estonia orthophoto editor availability fallback.";
if (source.includes(marker)) {
  console.log("0.3.6-beta9 Estonia orthophoto editor fix already applied");
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
source += `\n\n${marker}\nconsole.info("[Navimower Map Card] 0.3.6-beta9 Estonia orthophoto editor availability fallback enabled");\n`;

await writeFile(sourcePath, source, "utf8");
console.log("Applied 0.3.6-beta9 Estonia orthophoto editor availability fix");
