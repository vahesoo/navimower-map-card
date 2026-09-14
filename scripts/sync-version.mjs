import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const sourcePath = resolve(root, "src", "navimower-map-card.js");
const beta1PatchPath = resolve(root, "scripts", "runtime-v037-beta1.js.txt");
const beta2PatchPath = resolve(root, "scripts", "runtime-v037-beta2.js.txt");
const beta3PatchPath = resolve(root, "scripts", "runtime-v037-beta3.js.txt");
const beta1Marker = "// 0.3.7-beta1: vendor retained trail / MQTT tail source debug.";
const beta2Marker = "// 0.3.7-beta2: stable vendor backbone / MQTT tail and authenticated OSM tiles.";
const beta3Marker = "// 0.3.7-beta3: selectable LiDAR terrain overlay.";
let source = await readFile(sourcePath, "utf8");

if (!source.includes(beta1Marker)) {
  const patch = (await readFile(beta1PatchPath, "utf8")).trim();
  source = `${source.trimEnd()}\n\n${patch}\n`;
  console.log("Applied 0.3.7-beta1 vendor/MQTT trail debug runtime patch");
}

// 0.3.7-beta2 must not issue direct SVG image requests to the public OSM tile
// service. The runtime recognises this local fragment marker and hydrates the
// image through the authenticated Navimower Map API instead.
const directOsmExpression = '"https://tile.openstreetmap.org/" + range.zoom + "/" + x + "/" + y + ".png"';
const proxiedOsmExpression = '"#nm-osm-" + range.zoom + "-" + x + "-" + y';
const directOsmCount = source.split(directOsmExpression).length - 1;
if (directOsmCount) {
  source = source.split(directOsmExpression).join(proxiedOsmExpression);
  console.log(`Replaced ${directOsmCount} direct OpenStreetMap tile URL expression(s)`);
} else if (!source.includes(proxiedOsmExpression)) {
  throw new Error("OpenStreetMap tile renderer contract was not found");
}

if (!source.includes(beta2Marker)) {
  const patch = (await readFile(beta2PatchPath, "utf8")).trim();
  source = `${source.trimEnd()}\n\n${patch}\n`;
  console.log("Applied 0.3.7-beta2 stable trail / OSM proxy runtime patch");
}

if (!source.includes(beta3Marker)) {
  if (!source.includes(beta2Marker)) {
    throw new Error("Expected 0.3.7-beta2 runtime before applying LiDAR beta3");
  }
  const patch = (await readFile(beta3PatchPath, "utf8")).trim();
  source = `${source.trimEnd()}\n\n${patch}\n`;
  console.log("Applied 0.3.7-beta3 selectable LiDAR terrain overlay runtime patch");
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
