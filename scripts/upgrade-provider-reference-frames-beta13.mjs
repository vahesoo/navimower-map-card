import { readFile, writeFile } from "node:fs/promises";

const sourcePath = new URL("../src/navimower-map-card.js", import.meta.url);
let source = await readFile(sourcePath, "utf8");
const marker = "// 0.3.6-beta13: integration-owned provider reference frames.";
if (source.includes(marker)) {
  console.log("0.3.6-beta13 provider reference frames already applied");
  process.exit(0);
}
if (!source.includes("// 0.3.6-beta12: Google Satellite sharpness and provider-frame normalization.")) {
  throw new Error("Expected 0.3.6-beta12 runtime was not found");
}

const syncMarker = "  const syncSingle = (card) => {";
if (!source.includes(syncMarker)) throw new Error("Underlay single renderer was not found");

const helpers = `  const providerFrontend13 = (card) => card?._multi036Site?.anchor_frontend || card?._mapPayload?.frontend || {};

  const providerFrameName13 = (card) => {
    const provider = underlayProvider(card);
    const advertised = providerFrontend13(card)?.map_underlays?.[provider]?.reference_frame;
    if (advertised) return String(advertised);
    if (["openstreetmap", "google_satellite"].includes(provider)) return "web_wgs84";
    if (["estonia_orthophoto", "estonia_hybrid"].includes(provider)) return "regional_cartographic";
    return "active";
  };

  const providerGeoreference13 = (card, activeGeo) => {
    const frontend = providerFrontend13(card);
    const frames = frontend?.georeference_frames;
    const frameName = providerFrameName13(card);
    const frame = frames && typeof frames === "object" ? frames[frameName] : null;
    const candidate = frame?.georeference;
    if (frame?.available === true && validGeoreference(candidate)) {
      card._underlayReferenceFrame13 = {
        provider: underlayProvider(card),
        frame: frameName,
        source: frame?.source || null,
        fallback: false,
      };
      return candidate;
    }

    // Compatibility while integration/card are updated in either order: beta12
    // already knows how to reconstruct Google's dynamic frame from beta22's
    // active cartographic transform. Once beta23 frames exist, an unavailable
    // preferred frame intentionally falls back to active rather than inventing
    // a provider/model offset in JavaScript.
    const hasFrames = Boolean(frames && typeof frames === "object" && Object.keys(frames).length);
    if (!hasFrames && underlayProvider(card) === "google_satellite") {
      card._underlayReferenceFrame13 = {
        provider: "google_satellite",
        frame: frameName,
        source: "beta12_compatibility_fallback",
        fallback: true,
      };
      return googleDynamicGeoreference12(card, activeGeo);
    }

    card._underlayReferenceFrame13 = {
      provider: underlayProvider(card),
      frame: frameName,
      source: frame?.source || "active_fallback",
      fallback: true,
    };
    return activeGeo;
  };

  const providerSiteOrigin13 = (card, site) => {
    const frameName = providerFrameName13(card);
    const origins = site?.underlay_origins;
    const candidate = origins && typeof origins === "object" ? origins[frameName] : null;
    const latitude = finite(candidate?.latitude);
    const longitude = finite(candidate?.longitude);
    if (candidate?.available === true && latitude !== null && longitude !== null) {
      card._underlayReferenceFrame13 = {
        provider: underlayProvider(card),
        frame: frameName,
        source: candidate?.source || null,
        fallback: false,
      };
      return { latitude, longitude };
    }

    const hasOrigins = Boolean(origins && typeof origins === "object" && Object.keys(origins).length);
    if (!hasOrigins && underlayProvider(card) === "google_satellite") {
      return googleDynamicSiteOrigin12(card, site?.origin || {});
    }
    return site?.origin || {};
  };

`;
source = source.replace(syncMarker, helpers + syncMarker);

const oldSingle = `    const activeGeo = georeference(card);\n    const geo = googleDynamicGeoreference12(card, activeGeo);`;
const newSingle = `    const activeGeo = georeference(card);\n    const geo = providerGeoreference13(card, activeGeo);`;
if (!source.includes(oldSingle)) throw new Error("beta12 single Google frame hook was not found");
source = source.replace(oldSingle, newSingle);

const oldMulti = `    const origin = googleDynamicSiteOrigin12(card, site?.origin || {});`;
const newMulti = `    const origin = providerSiteOrigin13(card, site);`;
if (!source.includes(oldMulti)) throw new Error("beta12 Multi Google frame hook was not found");
source = source.replace(oldMulti, newMulti);

source += `\n\n${marker}\nconsole.info("[Navimower Map Card] 0.3.6-beta13 integration-owned provider reference frames enabled");\n`;

await writeFile(sourcePath, source, "utf8");
console.log("Applied 0.3.6-beta13 provider reference frames");
