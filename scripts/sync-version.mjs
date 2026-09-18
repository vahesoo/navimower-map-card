import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeRuntimeVersionLog } from "./runtime-logging.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const sourcePath = resolve(root, "src", "navimower-map-card.js");
const current = await readFile(sourcePath, "utf8");

const marker = /var NAVIMOWER_MAP_CARD_VERSION2 = "[^"]+";/;
if (!marker.test(current)) {
  throw new Error("Runtime version marker NAVIMOWER_MAP_CARD_VERSION2 was not found");
}

const versioned = current.replace(marker, `var NAVIMOWER_MAP_CARD_VERSION2 = "${pkg.version}";`);
const next = normalizeRuntimeVersionLog(versioned, pkg.version);
if (next !== current) {
  await writeFile(sourcePath, next, "utf8");
  console.log(`Synced runtime version and startup log to ${pkg.version}`);
} else {
  console.log(`Runtime version and startup log already match ${pkg.version}`);
}
