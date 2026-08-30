import { readFile, writeFile } from "node:fs/promises";

const sourcePath = new URL("../src/navimower-map-card.js", import.meta.url);
let source = await readFile(sourcePath, "utf8");
const marker = "// 0.3.6-beta6: OSM Multi stability and editor visibility.";
if (source.includes(marker)) {
  console.log("0.3.6-beta6 OSM fixes already applied");
  process.exit(0);
}
if (!source.includes("// 0.3.6-beta5: optional OpenStreetMap underlay.")) {
  throw new Error("Expected 0.3.6-beta5 OSM runtime was not found");
}

const oldSyncMulti = `  const syncMulti = (card) => {
    const layer = card?._multi036Layer;
    if (!layer) return false;
    if (!underlayEnabled(card) || layer.style.display === "none") {
      layer.querySelector?.(".nm-osm-underlay")?.remove?.();
      return false;
    }`;
const newSyncMulti = `  const syncMulti = (card) => {
    const multiLayer = card?._multi036Layer;
    if (!multiLayer || !card?._svgEl) return false;
    let layer = card._osm036MultiLayer;
    if (!layer || !layer.isConnected) {
      layer = document.createElementNS(SVG_NS, "g");
      layer.setAttribute("class", "nm-osm-multi-underlay-layer");
      layer.setAttribute("pointer-events", "none");
      card._svgEl.insertBefore(layer, multiLayer);
      card._osm036MultiLayer = layer;
    }
    if (!underlayEnabled(card) || multiLayer.style.display === "none") {
      layer.innerHTML = "";
      return false;
    }`;
if (!source.includes(oldSyncMulti)) throw new Error("beta5 syncMulti block was not found");
source = source.replace(oldSyncMulti, newSyncMulti);

const observerBlock = `    if (card?._multi036Layer && !card._osm036Observer) {
      const observer = new MutationObserver(() => {
        if (card._osm036Mutating) return;
        card._osm036Mutating = true;
        queueMicrotask(() => {
          syncCard(card);
          card._osm036Mutating = false;
        });
      });
      observer.observe(card._multi036Layer, { childList: true });
      card._osm036Observer = observer;
    }
`;
if (!source.includes(observerBlock)) throw new Error("beta5 self-observing Multi block was not found");
source = source.replace(observerBlock, "");

source += `\n\n${marker}\n(() => {\n  const Card = globalThis.customElements?.get?.("navimower-map-card");\n  if (!Card || Card.__navimower036Beta6Osm) return;\n  Card.__navimower036Beta6Osm = true;\n\n  const previousForm = Card.getConfigForm?.bind(Card);\n  Card.getConfigForm = (...args) => {\n    const form = previousForm?.(...args) || { schema: [] };\n    if (!Array.isArray(form.schema)) return form;\n    const names = new Set(["map_underlay", "osm_underlay_opacity"]);\n    const remove = (items) => {\n      for (const item of Array.isArray(items) ? items : []) {\n        if (!Array.isArray(item?.schema)) continue;\n        item.schema = item.schema.filter((child) => !names.has(child?.name));\n        remove(item.schema);\n      }\n    };\n    remove(form.schema);\n    form.schema = form.schema.filter((item) => item?.name !== "map_underlay_settings");\n    form.schema.push({\n      type: "expandable",\n      name: "map_underlay_settings",\n      title: "Map underlay",\n      flatten: true,\n      schema: [{\n        type: "grid",\n        name: "map_underlay_grid",\n        flatten: true,\n        column_min_width: "220px",\n        schema: [\n          { name: "map_underlay", selector: { select: { options: [\n            { value: "none", label: "None" },\n            { value: "openstreetmap", label: "OpenStreetMap" },\n          ] } } },\n          { name: "osm_underlay_opacity", selector: { number: { min: 0.1, max: 1, step: 0.05, mode: "slider" } } },\n        ],\n      }],\n    });\n    const baseLabel = typeof form.computeLabel === "function" ? form.computeLabel : null;\n    form.computeLabel = (schema, data) => schema?.name === "map_underlay" ? "Map underlay" : schema?.name === "osm_underlay_opacity" ? "OSM opacity" : baseLabel?.(schema, data) || schema?.name || "";\n    return form;\n  };\n\n  const proto = Card.prototype;\n  for (const method of ["_renderShell", "_ensureDom", "_applyViewBox"]) {\n    const previous = proto[method];\n    if (typeof previous !== "function") continue;\n    proto[method] = function beta6OsmRefresh(...args) {\n      const result = previous.apply(this, args);\n      if (this._osm036Observer) {\n        this._osm036Observer.disconnect?.();\n        this._osm036Observer = null;\n      }\n      return result;\n    };\n  }\n\n  console.info("[Navimower Map Card] 0.3.6-beta6 OSM Multi stability and editor visibility enabled");\n})();\n`;

await writeFile(sourcePath, source);
console.log("Applied 0.3.6-beta6 OSM Multi stability and editor visibility fixes");
