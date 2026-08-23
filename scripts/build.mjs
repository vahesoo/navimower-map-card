import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = resolve(root, "src");
const distDir = resolve(root, "dist");
const source = resolve(srcDir, "navimower-map-card.js");
const target = resolve(distDir, "navimower-map-card.js");

const sourceJs = (await readdir(srcDir)).filter((name) => name.endsWith(".js"));
if (sourceJs.length !== 1 || sourceJs[0] !== "navimower-map-card.js") {
  throw new Error(`src must contain exactly navimower-map-card.js; found: ${sourceJs.join(", ")}`);
}

const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
if (packageJson.version === "0.3.4-beta2") {
  let runtime = await readFile(source, "utf8");
  if (!runtime.includes("function patchCustomAreas0342()")) {
    const oldVersion = 'var NAVIMOWER_MAP_CARD_VERSION2 = "0.3.4-beta1";';
    if ((runtime.split(oldVersion).length - 1) !== 1) {
      throw new Error("Expected one 0.3.4-beta1 runtime version marker");
    }
    runtime = runtime.replace(oldVersion, 'var NAVIMOWER_MAP_CARD_VERSION2 = "0.3.4-beta2";');
    runtime += `

// 0.3.4-beta2: device-scoped Custom Area overlays from Navimower binary sensors.
function patchCustomAreas0342() {
  const Card = globalThis.customElements?.get?.("navimower-map-card");
  if (!Card || Card.__customAreas0342) return;
  Card.__customAreas0342 = true;
  const proto = Card.prototype;

  const originalStub = Card.getStubConfig.bind(Card);
  Card.getStubConfig = function customAreaStub0342() {
    return {
      ...originalStub(),
      show_custom_areas: true,
      custom_area_color: "#8e24aa",
      custom_area_fill_opacity: 0.14,
      custom_area_stroke_width: 3
    };
  };

  const originalForm = Card.getConfigForm.bind(Card);
  Card.getConfigForm = function customAreaForm0342() {
    const form = originalForm();
    const display = form?.schema?.find?.((item) => item.name === "display");
    const displayGrid = display?.schema?.find?.((item) => item.name === "display_grid");
    if (displayGrid?.schema && !displayGrid.schema.some((item) => item.name === "show_custom_areas")) {
      const gateIndex = displayGrid.schema.findIndex((item) => item.name === "show_gate_areas");
      displayGrid.schema.splice(gateIndex >= 0 ? gateIndex + 1 : displayGrid.schema.length, 0,
        { name: "show_custom_areas", selector: { boolean: {} } });
    }
    const appearance = form?.schema?.find?.((item) => item.name === "appearance");
    const appearanceGrid = appearance?.schema?.find?.((item) => item.name === "appearance_grid");
    if (appearanceGrid?.schema && !appearanceGrid.schema.some((item) => item.name === "custom_area_fill_opacity")) {
      appearanceGrid.schema.push(
        { name: "custom_area_fill_opacity", selector: { number: { min: 0, max: 1, step: 0.05, mode: "slider" } } },
        { name: "custom_area_stroke_width", selector: { number: { min: 1, max: 12, step: 1, mode: "box" } } },
        { name: "custom_area_color", selector: { text: { type: "color" } } }
      );
    }
    const baseCompute = form.computeLabel;
    const labels = {
      show_custom_areas: "Show custom areas",
      custom_area_color: "Custom area color",
      custom_area_fill_opacity: "Custom area fill opacity",
      custom_area_stroke_width: "Custom area border width"
    };
    form.computeLabel = (schema) => labels[schema?.name] || baseCompute?.(schema) || schema?.name || "";
    return form;
  };

  const originalSetConfig = proto.setConfig;
  proto.setConfig = function customAreaSetConfig0342(config) {
    const next = { ...config };
    if (next.show_custom_areas === undefined) next.show_custom_areas = true;
    if (next.custom_area_color === undefined) next.custom_area_color = next.gate_area_color || "#8e24aa";
    if (next.custom_area_fill_opacity === undefined) next.custom_area_fill_opacity = 0.14;
    if (next.custom_area_stroke_width === undefined) next.custom_area_stroke_width = 3;
    return originalSetConfig.call(this, next);
  };

  function customAreas(card) {
    if (!card?._hass || !Array.isArray(card._customAreaEntities0342)) return [];
    return card._customAreaEntities0342.map((entityId) => {
      const state = card._hass.states?.[entityId];
      const polygon = state?.attributes?.polygon;
      if (!Array.isArray(polygon) || polygon.length < 3) return null;
      const points = polygon
        .filter((point) => Array.isArray(point) && point.length >= 2)
        .map((point) => [Number(point[0]), Number(point[1])])
        .filter((point) => point.every(Number.isFinite));
      if (points.length < 3) return null;
      return { entityId, name: state.attributes?.name || state.attributes?.friendly_name || "Custom area", polygon: points };
    }).filter(Boolean);
  }

  function renderCustomAreas(card) {
    card._detailsEl?.querySelector?.(".nm-custom-areas")?.remove?.();
    card._labelsEl?.querySelector?.(".nm-custom-area-labels")?.remove?.();
    if (!card?._layout || !card?._config?.show_custom_areas) return;
    const areas = customAreas(card);
    if (!areas.length) return;
    const color = escapeHtml(card._config.custom_area_color || card._config.gate_area_color || "#8e24aa");
    const opacity = clamp(finiteNumber(card._config.custom_area_fill_opacity, 0.14), 0, 1);
    const width = clamp(finiteNumber(card._config.custom_area_stroke_width, 3), 1, 12);
    const shapes = [];
    const labels = [];
    for (const area of areas) {
      const points = card._pointString(area.polygon);
      shapes.push(\`<polygon points="\${points}" fill="\${color}" fill-opacity="\${opacity.toFixed(2)}" stroke="\${color}" stroke-width="\${width}" stroke-dasharray="10 6" vector-effect="non-scaling-stroke"/>\`);
      const cx = area.polygon.reduce((sum, point) => sum + card._layout.sx(point[0]), 0) / area.polygon.length;
      const cy = area.polygon.reduce((sum, point) => sum + card._layout.sy(point[1]), 0) / area.polygon.length;
      labels.push(card._label(cx, cy, area.name, 19));
    }
    if (card._detailsEl) card._detailsEl.insertAdjacentHTML("beforeend", \`<g class="nm-custom-areas">\${shapes.join("")}</g>\`);
    if (card._labelsEl) card._labelsEl.insertAdjacentHTML("beforeend", \`<g class="nm-custom-area-labels">\${labels.join("")}</g>\`);
  }

  const originalRegistryResolve = proto._resolveEntitiesFromRegistry;
  proto._resolveEntitiesFromRegistry = async function customAreaRegistry0342(mowerEntity, resolutionKey) {
    await originalRegistryResolve.call(this, mowerEntity, resolutionKey);
    try {
      if (resolutionKey !== this._resolutionKey || !this._hass?.callWS) return;
      const registry = await this._hass.callWS({ type: "config/entity_registry/list" });
      if (!Array.isArray(registry)) return;
      const mowerEntry = registry.find((entry) => entry.entity_id === mowerEntity);
      if (!mowerEntry?.device_id) return;
      const entities = registry
        .filter((entry) => entry.device_id === mowerEntry.device_id && !entry.disabled_by && String(entry.entity_id || "").startsWith("binary_sensor."))
        .map((entry) => entry.entity_id)
        .filter((entityId) => {
          const attrs = this._hass.states?.[entityId]?.attributes;
          return Array.isArray(attrs?.polygon) && attrs.polygon.length >= 3 && attrs?.source === "navimow_off_limit_import";
        });
      const signature = entities.join("|");
      if (signature !== (this._customAreaSignature0342 || "")) {
        this._customAreaEntities0342 = entities;
        this._customAreaSignature0342 = signature;
        this._staticRenderKey = null;
        this._renderStatic?.();
      }
    } catch (error) {
      console.debug("[Navimower Map Card] Custom Area auto-detection failed", error);
    }
  };

  const originalRenderStatic = proto._renderStatic;
  proto._renderStatic = function customAreaRenderStatic0342() {
    const result = originalRenderStatic.call(this);
    renderCustomAreas(this);
    return result;
  };
  const originalApplyStatic = proto._applyStaticLayers;
  proto._applyStaticLayers = function customAreaApplyStatic0342(entry) {
    const result = originalApplyStatic.call(this, entry);
    renderCustomAreas(this);
    return result;
  };
  console.info("[Navimower Map Card] 0.3.4-beta2 Custom Area overlays enabled");
}
if (globalThis.customElements) patchCustomAreas0342();
`;
    await writeFile(source, runtime, "utf8");
    console.log("Applied 0.3.4-beta2 Custom Area overlay transform");
  }

  const changelogPath = resolve(root, "CHANGELOG.md");
  let changelog = await readFile(changelogPath, "utf8");
  if (!changelog.includes("## 0.3.4-beta2 - 2026-08-23")) {
    const header = "# Changelog\n\n";
    if (!changelog.startsWith(header)) throw new Error("Unexpected changelog header");
    const section = `## 0.3.4-beta2 - 2026-08-23\n\n### Added\n\n- Render Navimower Custom Areas belonging to the selected mower device.\n- Auto-discover Custom Area binary sensors from the mower device registry and use their polygon/name attributes.\n- Add Visual Editor controls for showing/hiding Custom Areas, color, fill opacity, and border width.\n- Match the Gate Area visual language by default: purple fill and dashed border.\n\n`;
    changelog = header + section + changelog.slice(header.length);
    await writeFile(changelogPath, changelog, "utf8");
  }

  const readmePath = resolve(root, "README.md");
  let readme = await readFile(readmePath, "utf8");
  if (!readme.includes("Custom Area overlays are auto-discovered")) {
    readme += `\n\n### Custom Areas\n\nCustom Area overlays are auto-discovered from Navimower binary sensors attached to the selected mower device. Their polygons are shown with the Gate Area color language by default and can be enabled/disabled or styled in the Visual Editor with separate color, fill-opacity, and border-width controls.\n`;
    await writeFile(readmePath, readme, "utf8");
  }
}

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });
await copyFile(source, target);
console.log(`Built ${target}`);
