import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const sourcePath = resolve(root, "src", "navimower-map-card.js");
const patchPath = resolve(root, "scripts", "runtime-v037-beta1.js.txt");
const patchMarker = "// 0.3.7-beta1: vendor retained trail / MQTT tail source debug.";
let source = await readFile(sourcePath, "utf8");

if (!source.includes(patchMarker)) {
  const patch = (await readFile(patchPath, "utf8")).trim();
  source = `${source.trimEnd()}\n\n${patch}\n`;
  console.log("Applied 0.3.7-beta1 vendor/MQTT trail debug runtime patch");
}

const marker = /var NAVIMOWER_MAP_CARD_VERSION2 = "[^"]+";/;
if (!marker.test(source)) {
  throw new Error("Runtime version marker NAVIMOWER_MAP_CARD_VERSION2 was not found");
}
const next = source.replace(marker, `var NAVIMOWER_MAP_CARD_VERSION2 = "${pkg.version}";`);
if (next !== source) {
  await writeFile(sourcePath, next, "utf8");
  console.log(`Synced runtime version to ${pkg.version}`);
} else {
  console.log(`Runtime version already matches ${pkg.version}`);
}
