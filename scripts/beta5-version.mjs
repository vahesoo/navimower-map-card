import { readFile, writeFile } from "node:fs/promises";

const path = new URL("../src/navimower-map-card.js", import.meta.url);
let source = await readFile(path, "utf8");
const oldMarker = 'var NAVIMOWER_MAP_CARD_VERSION2 = "0.3.4-beta4";';
const newMarker = 'var NAVIMOWER_MAP_CARD_VERSION2 = "0.3.4-beta5";';
if (source.includes(oldMarker)) source = source.replace(oldMarker, newMarker);
else if (!source.includes(newMarker)) throw new Error("Expected beta4 or beta5 runtime version marker");
await writeFile(path, source, "utf8");
