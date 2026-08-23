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
if (packageJson.version === "0.3.4-beta3") {
  let runtime = await readFile(source, "utf8");
  const oldVersion = 'var NAVIMOWER_MAP_CARD_VERSION2 = "0.3.4-beta2";';
  const newVersion = 'var NAVIMOWER_MAP_CARD_VERSION2 = "0.3.4-beta3";';
  const oldFilter = `.map((entry) => entry.entity_id)\n        .filter((entityId) => {\n          const attrs = this._hass.states?.[entityId]?.attributes;\n          return Array.isArray(attrs?.polygon) && attrs.polygon.length >= 3 && attrs?.source === "navimow_off_limit_import";\n        });`;
  const newFilter = `.filter((entry) => String(entry.unique_id || "").includes("_custom_area_"))\n        .map((entry) => entry.entity_id);`;
  const oldApply = `  const originalApplyStatic = proto._applyStaticLayers;\n  proto._applyStaticLayers = function customAreaApplyStatic0342(entry) {\n    const result = originalApplyStatic.call(this, entry);\n    renderCustomAreas(this);\n    return result;\n  };\n  console.info("[Navimower Map Card] 0.3.4-beta2 Custom Area overlays enabled");`;
  const newApply = `  const originalApplyStatic = proto._applyStaticLayers;\n  proto._applyStaticLayers = function customAreaApplyStatic0342(entry) {\n    const result = originalApplyStatic.call(this, entry);\n    renderCustomAreas(this);\n    return result;\n  };\n  const hassDescriptor = Object.getOwnPropertyDescriptor(proto, "hass");\n  if (hassDescriptor?.set && hassDescriptor?.get) {\n    Object.defineProperty(proto, "hass", {\n      configurable: true,\n      get: hassDescriptor.get,\n      set(value) {\n        hassDescriptor.set.call(this, value);\n        if (this._customAreaEntities0342?.length && this._config?.show_custom_areas) renderCustomAreas(this);\n      }\n    });\n  }\n  console.info("[Navimower Map Card] 0.3.4-beta3 robust Custom Area discovery enabled");`;

  const oldCount = runtime.split(oldVersion).length - 1;
  const newCount = runtime.split(newVersion).length - 1;
  if (oldCount === 1 && newCount === 0) {
    if ((runtime.split(oldFilter).length - 1) !== 1) throw new Error("Expected beta2 state-dependent Custom Area discovery filter");
    if ((runtime.split(oldApply).length - 1) !== 1) throw new Error("Expected beta2 Custom Area apply hook");
    runtime = runtime.replace(oldVersion, newVersion).replace(oldFilter, newFilter).replace(oldApply, newApply);
  } else if (oldCount === 0 && newCount === 1) {
    if ((runtime.split(newFilter).length - 1) !== 1) throw new Error("Expected beta3 Custom Area unique-id discovery filter");
    if ((runtime.split('console.info("[Navimower Map Card] 0.3.4-beta3 robust Custom Area discovery enabled");').length - 1) !== 1) throw new Error("Expected beta3 Custom Area apply hook");
  } else {
    throw new Error(`Unexpected runtime version markers: beta2=${oldCount}, beta3=${newCount}`);
  }

  await writeFile(source, runtime, "utf8");
  const changelogPath = resolve(root, "CHANGELOG.md");
  let changelog = await readFile(changelogPath, "utf8");
  if (!changelog.includes("## 0.3.4-beta3 - 2026-08-23")) changelog = changelog.replace("# Changelog\n\n", "# Changelog\n\n## 0.3.4-beta3 - 2026-08-23\n\n### Fixed\n\n- Discover Custom Area entities from their device-scoped Navimower unique IDs instead of requiring polygon attributes to already exist during the one-time Entity Registry lookup.\n- Re-render Custom Area overlays as Home Assistant state updates arrive, avoiding an empty map when the card initializes before Custom Area state attributes are ready.\n\n");
  await writeFile(changelogPath, changelog, "utf8");
}
await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });
await copyFile(source, target);
console.log(`Built ${target}`);
