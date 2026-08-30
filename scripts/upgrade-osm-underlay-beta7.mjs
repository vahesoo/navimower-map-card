import { readFile, writeFile } from "node:fs/promises";

const sourcePath = new URL("../src/navimower-map-card.js", import.meta.url);
let source = await readFile(sourcePath, "utf8");
const marker = "// 0.3.6-beta7: OSM Multi visibility and ready-state sync.";
if (source.includes(marker)) {
  console.log("0.3.6-beta7 OSM visibility fix already applied");
  process.exit(0);
}
if (!source.includes("// 0.3.6-beta6: OSM Multi stability and editor visibility.")) {
  throw new Error("Expected 0.3.6-beta6 OSM runtime was not found");
}

const opaqueBackground = '    const parts = ["<rect x=\\"0\\" y=\\"0\\" width=\\"1000\\" height=\\"1000\\" fill=\\"" + esc(background) + "\\"/>"];';
const osmAwareBackground = '    const osmUnderlayActive036 = String(card?._config?.map_underlay || "none").toLowerCase() === "openstreetmap";\n    const parts = ["<rect x=\\"0\\" y=\\"0\\" width=\\"1000\\" height=\\"1000\\" fill=\\"" + (osmUnderlayActive036 ? "transparent" : esc(background)) + "\\"/>"];';
if (!source.includes(opaqueBackground)) throw new Error("Multi mower opaque background contract was not found");
source = source.replace(opaqueBackground, osmAwareBackground);

const previousStub = '  const previousStub = Card.getStubConfig?.bind(Card);';
const osmSyncHook = '  proto._syncOsmUnderlay036 = function beta7SyncOsmUnderlay() { syncCard(this); };\n\n  const previousStub = Card.getStubConfig?.bind(Card);';
if (!source.includes(previousStub)) throw new Error("beta5 OSM stub hook point was not found");
source = source.replace(previousStub, osmSyncHook);

const siteReady = '      if (multiActive036(card)) await refreshMembers036(card, true);';
const siteReadySync = '      if (multiActive036(card)) await refreshMembers036(card, true);\n      queueMicrotask(() => card._syncOsmUnderlay036?.());';
if (!source.includes(siteReady)) throw new Error("Multi mower site-ready hook point was not found");
source = source.replace(siteReady, siteReadySync);

source += `\n\n${marker}\n(() => {\n  const Card = globalThis.customElements?.get?.("navimower-map-card");\n  if (!Card || Card.__navimower036Beta7Osm) return;\n  Card.__navimower036Beta7Osm = true;\n\n  const proto = Card.prototype;\n  const previousSetConfig = proto.setConfig;\n  if (typeof previousSetConfig === "function") {\n    proto.setConfig = function beta7OsmSetConfig(config) {\n      const result = previousSetConfig.call(this, config);\n      queueMicrotask(() => this._syncOsmUnderlay036?.());\n      return result;\n    };\n  }\n\n  console.info("[Navimower Map Card] 0.3.6-beta7 OSM Multi visibility and ready-state sync enabled");\n})();\n`;

await writeFile(sourcePath, source, "utf8");
console.log("Applied 0.3.6-beta7 OSM Multi visibility and ready-state sync fix");
