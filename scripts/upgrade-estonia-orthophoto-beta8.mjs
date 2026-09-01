import { readFile, writeFile } from "node:fs/promises";

const sourcePath = new URL("../src/navimower-map-card.js", import.meta.url);
let source = await readFile(sourcePath, "utf8");
const marker = "// 0.3.6-beta8: Estonia orthophoto underlay.";
if (source.includes(marker)) {
  console.log("0.3.6-beta8 Estonia orthophoto underlay already applied");
  process.exit(0);
}
if (!source.includes("// 0.3.6-beta7: OSM Multi visibility and ready-state sync.")) {
  throw new Error("Expected 0.3.6-beta7 runtime was not found");
}

const oldUnderlayHelpers = '  const underlayEnabled = (card) => String(card?._config?.map_underlay || "none").toLowerCase() === "openstreetmap";\n  const underlayOpacity = (card) => clamp(card?._config?.osm_underlay_opacity ?? DEFAULT_OPACITY, 0.1, 1);';
const newUnderlayHelpers = `  const underlayProvider = (card) => String(card?._config?.map_underlay || "none").toLowerCase();
  const underlayEnabled = (card) => ["openstreetmap", "estonia_orthophoto"].includes(underlayProvider(card));
  const underlayOpacity = (card) => clamp(card?._config?.osm_underlay_opacity ?? DEFAULT_OPACITY, 0.1, 1);
  const isEstoniaLocation = (lat, lon) => {
    const latitude = finite(lat);
    const longitude = finite(lon);
    return latitude !== null && longitude !== null
      && latitude >= 57.3 && latitude <= 60.0
      && longitude >= 21.5 && longitude <= 28.3;
  };
  const markEstoniaAvailability = (card, lat, lon) => {
    const available = isEstoniaLocation(lat, lon);
    if (available) Card.__navimower036EstoniaSite = true;
    if (card) card._estoniaOrthophotoAvailable036 = available;
    return available;
  };`;
if (!source.includes(oldUnderlayHelpers)) throw new Error("beta5 underlay helper contract was not found");
source = source.replace(oldUnderlayHelpers, newUnderlayHelpers);

const oldTileSignature = '  const tileMarkup = (bounds, screenPoint, opacity) => {';
const newTileSignature = '  const tileMarkup = (bounds, screenPoint, opacity, provider = "openstreetmap") => {';
if (!source.includes(oldTileSignature)) throw new Error("beta5 tile markup signature was not found");
source = source.replace(oldTileSignature, newTileSignature);

const oldTileUrl = '        const href = "https://tile.openstreetmap.org/" + range.zoom + "/" + x + "/" + y + ".png";';
const newTileUrl = `        const tmsY = 2 ** range.zoom - 1 - y;
        const href = provider === "estonia_orthophoto"
          ? "https://tiles.maaamet.ee/tm/tms/1.0.0/foto@GMC/" + range.zoom + "/" + x + "/" + tmsY + ".png?ASUTUS=NAVIMOWER&KESKKOND=LIVE&IS=NAVIMOWER_MAP_CARD"
          : "https://tile.openstreetmap.org/" + range.zoom + "/" + x + "/" + y + ".png";`;
if (!source.includes(oldTileUrl)) throw new Error("OpenStreetMap tile URL contract was not found");
source = source.replace(oldTileUrl, newTileUrl);

const attributionPattern = /  const ensureAttribution = \(card, visible\) => \{[\s\S]*?\n  \};\n\n  const insertOsmGroup/;
if (!attributionPattern.test(source)) throw new Error("beta5 attribution block was not found");
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
      node.innerHTML = provider === "estonia_orthophoto"
        ? '<a href="https://geoportaal.maaamet.ee/est/ruumiandmed/ortofotod-p99.html" target="_blank" rel="noopener noreferrer">Ortofoto, Maa- ja Ruumiamet</a>'
        : '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>';
      const link = node.querySelector("a");
      if (link) link.style.cssText = "color:inherit;text-decoration:none";
    }
    node.hidden = !visible;
  };

  const insertOsmGroup`);

const oldSingleGeo = `    const geo = georeference(card);
    if (!validGeoreference(geo) || !card._layout?.sx || !card._layout?.sy) {
      card._baseEl.querySelector?.(".nm-osm-underlay")?.remove?.();
      return false;
    }`;
const newSingleGeo = `    const geo = georeference(card);
    if (!validGeoreference(geo) || !card._layout?.sx || !card._layout?.sy) {
      card._baseEl.querySelector?.(".nm-osm-underlay")?.remove?.();
      return false;
    }
    const ref = geo?.reference || {};
    const inEstonia = markEstoniaAvailability(card, ref.latitude, ref.longitude);
    if (underlayProvider(card) === "estonia_orthophoto" && !inEstonia) {
      card._baseEl.querySelector?.(".nm-osm-underlay")?.remove?.();
      return false;
    }`;
if (!source.includes(oldSingleGeo)) throw new Error("Single mower georeference guard was not found");
source = source.replace(oldSingleGeo, newSingleGeo);

const oldMultiGeo = `    if (lat0 === null || lon0 === null || !layout || site?.status !== "validated") {
      layer.querySelector?.(".nm-osm-underlay")?.remove?.();
      return false;
    }`;
const newMultiGeo = `    if (lat0 === null || lon0 === null || !layout || site?.status !== "validated") {
      layer.querySelector?.(".nm-osm-underlay")?.remove?.();
      return false;
    }
    const inEstonia = markEstoniaAvailability(card, lat0, lon0);
    if (underlayProvider(card) === "estonia_orthophoto" && !inEstonia) {
      layer.querySelector?.(".nm-osm-underlay")?.remove?.();
      return false;
    }`;
if (!source.includes(oldMultiGeo)) throw new Error("Multi mower georeference guard was not found");
source = source.replace(oldMultiGeo, newMultiGeo);

const tileCall = '    }, underlayOpacity(card));';
const tileCallCount = source.split(tileCall).length - 1;
if (tileCallCount !== 2) throw new Error(`Expected exactly two underlay tile calls, found ${tileCallCount}`);
source = source.split(tileCall).join('    }, underlayOpacity(card), underlayProvider(card));');

const oldSyncStart = `  const syncCard = (card) => {
    if (!card?._config || typeof document === "undefined") return;`;
const newSyncStart = `  const syncCard = (card) => {
    if (!card?._config || typeof document === "undefined") return;
    const siteOrigin = card?._multi036Site?.origin || {};
    const singleRef = georeference(card)?.reference || {};
    if (finite(siteOrigin.latitude) !== null && finite(siteOrigin.longitude) !== null) {
      markEstoniaAvailability(card, siteOrigin.latitude, siteOrigin.longitude);
    } else if (finite(singleRef.latitude) !== null && finite(singleRef.longitude) !== null) {
      markEstoniaAvailability(card, singleRef.latitude, singleRef.longitude);
    }`;
if (!source.includes(oldSyncStart)) throw new Error("beta5 underlay sync start was not found");
source = source.replace(oldSyncStart, newSyncStart);

const oldFormStart = `  Card.getConfigForm = (...args) => {
    const form = previousForm?.(...args) || { schema: [] };
    const walkArrays = (items) => {`;
const newFormStart = `  Card.getConfigForm = (...args) => {
    const form = previousForm?.(...args) || { schema: [] };
    const rootHass = globalThis.document?.querySelector?.("home-assistant")?.hass;
    const country = String(rootHass?.config?.country || "").toUpperCase();
    const estoniaUnderlayAvailable = country === "EE" || Card.__navimower036EstoniaSite === true;
    const walkArrays = (items) => {`;
if (!source.includes(oldFormStart)) throw new Error("beta5 visual editor form hook was not found");
source = source.replace(oldFormStart, newFormStart);

const oldOptions = `            { name: "map_underlay", selector: { select: { options: [
              { value: "none", label: "None" },
              { value: "openstreetmap", label: "OpenStreetMap" },
            ] } } },`;
const newOptions = `            { name: "map_underlay", selector: { select: { options: [
              { value: "none", label: "None" },
              { value: "openstreetmap", label: "OpenStreetMap" },
              ...(estoniaUnderlayAvailable ? [{ value: "estonia_orthophoto", label: "Maa- ja Ruumiamet Ortofoto" }] : []),
            ] } } },`;
if (!source.includes(oldOptions)) throw new Error("beta5 visual editor underlay options were not found");
source = source.replace(oldOptions, newOptions);

const oldOpacityLabel = 'schema?.name === "osm_underlay_opacity" ? "OSM underlay opacity"';
const newOpacityLabel = 'schema?.name === "osm_underlay_opacity" ? "Map underlay opacity"';
if (!source.includes(oldOpacityLabel)) throw new Error("beta5 OSM opacity label was not found");
source = source.replace(oldOpacityLabel, newOpacityLabel);

const oldMultiBackground = `    const osmUnderlayActive036 = String(card?._config?.map_underlay || "none").toLowerCase() === "openstreetmap";
    const parts = ["<rect x=\\"0\\" y=\\"0\\" width=\\"1000\\" height=\\"1000\\" fill=\\"" + (osmUnderlayActive036 ? "transparent" : esc(background)) + "\\"/>"];`;
const newMultiBackground = `    const mapUnderlayActive036 = ["openstreetmap", "estonia_orthophoto"].includes(String(card?._config?.map_underlay || "none").toLowerCase());
    const parts = ["<rect x=\\"0\\" y=\\"0\\" width=\\"1000\\" height=\\"1000\\" fill=\\"" + (mapUnderlayActive036 ? "transparent" : esc(background)) + "\\"/>"];`;
if (!source.includes(oldMultiBackground)) throw new Error("beta7 Multi mower underlay background guard was not found");
source = source.replace(oldMultiBackground, newMultiBackground);

source += `\n\n${marker}\nconsole.info("[Navimower Map Card] 0.3.6-beta8 Estonia orthophoto underlay enabled");\n`;

await writeFile(sourcePath, source, "utf8");
console.log("Applied 0.3.6-beta8 Estonia orthophoto underlay");
