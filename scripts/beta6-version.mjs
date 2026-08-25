import { readFile, writeFile } from "node:fs/promises";
const path = new URL("../src/navimower-map-card.js", import.meta.url);
let source = await readFile(path, "utf8");
source = source.replace('var NAVIMOWER_MAP_CARD_VERSION2 = "0.3.4-beta5";', 'var NAVIMOWER_MAP_CARD_VERSION2 = "0.3.4-beta6";');
if (!source.includes('var NAVIMOWER_MAP_CARD_VERSION2 = "0.3.4-beta6";')) throw new Error("Expected beta5/beta6 runtime version marker");
await writeFile(path, source, "utf8");
