import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = resolve(root, "src");
const distDir = resolve(root, "dist");
const source = resolve(srcDir, "navimower-map-card.js");
const target = resolve(distDir, "navimower-map-card.js");
const sourceJs = (await readdir(srcDir)).filter((name) => name.endsWith(".js"));
if (sourceJs.length !== 1 || sourceJs[0] !== "navimower-map-card.js") throw new Error(`src must contain exactly navimower-map-card.js; found: ${sourceJs.join(", ")}`);
const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
if (packageJson.version === "0.3.4-beta4") {
  let runtime = await readFile(source, "utf8");
  const oldVersion = 'var NAVIMOWER_MAP_CARD_VERSION2 = "0.3.4-beta3";';
  const newVersion = 'var NAVIMOWER_MAP_CARD_VERSION2 = "0.3.4-beta4";';
  const oldAreas = `  function customAreas(card) {\n    if (!card?._hass || !Array.isArray(card._customAreaEntities0342)) return [];\n    return card._customAreaEntities0342.map((entityId) => {\n      const state = card._hass.states?.[entityId];\n      const polygon = state?.attributes?.polygon;\n      if (!Array.isArray(polygon) || polygon.length < 3) return null;\n      const points = polygon\n        .filter((point) => Array.isArray(point) && point.length >= 2)\n        .map((point) => [Number(point[0]), Number(point[1])])\n        .filter((point) => point.every(Number.isFinite));\n      if (points.length < 3) return null;\n      return { entityId, name: state.attributes?.name || state.attributes?.friendly_name || "Custom area", polygon: points };\n    }).filter(Boolean);\n  }`;
  const newAreas = `  function customAreas(card) {\n    const apiAreas = Array.isArray(card?._mapPayload?.custom_areas) ? card._mapPayload.custom_areas : [];\n    const normalizedApiAreas = apiAreas.map((area, index) => {\n      const polygon = area?.polygon;\n      if (!Array.isArray(polygon) || polygon.length < 3) return null;\n      const points = polygon\n        .filter((point) => Array.isArray(point) && point.length >= 2)\n        .map((point) => [Number(point[0]), Number(point[1])])\n        .filter((point) => point.every(Number.isFinite));\n      if (points.length < 3) return null;\n      return { entityId: null, name: area?.name || area?.slug || \`Custom area \${index + 1}\`, polygon: points };\n    }).filter(Boolean);\n    if (normalizedApiAreas.length || apiAreas.length) return normalizedApiAreas;\n    if (!card?._hass || !Array.isArray(card._customAreaEntities0342)) return [];\n    return card._customAreaEntities0342.map((entityId) => {\n      const state = card._hass.states?.[entityId];\n      const polygon = state?.attributes?.polygon;\n      if (!Array.isArray(polygon) || polygon.length < 3) return null;\n      const points = polygon\n        .filter((point) => Array.isArray(point) && point.length >= 2)\n        .map((point) => [Number(point[0]), Number(point[1])])\n        .filter((point) => point.every(Number.isFinite));\n      if (points.length < 3) return null;\n      return { entityId, name: state.attributes?.name || state.attributes?.friendly_name || "Custom area", polygon: points };\n    }).filter(Boolean);\n  }`;
  const oldLog = 'console.info("[Navimower Map Card] 0.3.4-beta3 robust Custom Area discovery enabled");';
  const newLog = 'console.info("[Navimower Map Card] 0.3.4-beta4 Map API Custom Areas enabled");';
  const oldCount = runtime.split(oldVersion).length - 1;
  const newCount = runtime.split(newVersion).length - 1;
  if (oldCount === 1 && newCount === 0) {
    if ((runtime.split(oldAreas).length - 1) !== 1) throw new Error("Expected beta3 Custom Area resolver");
    if ((runtime.split(oldLog).length - 1) !== 1) throw new Error("Expected beta3 Custom Area log marker");
    runtime = runtime.replace(oldVersion, newVersion).replace(oldAreas, newAreas).replace(oldLog, newLog);
  } else if (oldCount === 0 && newCount === 1) {
    if ((runtime.split(newAreas).length - 1) !== 1) throw new Error("Expected beta4 Map API Custom Area resolver");
    if ((runtime.split(newLog).length - 1) !== 1) throw new Error("Expected beta4 Custom Area log marker");
  } else {
    throw new Error(`Unexpected runtime version markers: beta3=${oldCount}, beta4=${newCount}`);
  }
  await writeFile(source, runtime, "utf8");
  const changelogPath = resolve(root, "CHANGELOG.md");
  let changelog = await readFile(changelogPath, "utf8");
  if (!changelog.includes("## 0.3.4-beta4 - 2026-08-23")) changelog = changelog.replace("# Changelog\n\n", "# Changelog\n\n## 0.3.4-beta4 - 2026-08-23\n\n### Changed\n\n- Prefer persistent `custom_areas` geometry delivered directly by Navimower 0.4.3-beta34+ Map API.\n- Keep the beta3 device-scoped binary-sensor discovery as a compatibility fallback for older integration builds.\n\n");
  await writeFile(changelogPath, changelog, "utf8");
}
await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });
await copyFile(source, target);
console.log(`Built ${target}`);
