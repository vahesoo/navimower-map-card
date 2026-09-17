import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const sourcePath = resolve(root, "src", "navimower-map-card.js");
let source = await readFile(sourcePath, "utf8");

const beta6Marker = "__navimower037Beta6FlickerFree";
if (!source.includes(beta6Marker)) {
  const patch = await readFile(resolve(root, "scripts", "runtime-v037-beta6.js.txt"), "utf8");
  source = `${source.trimEnd()}\n\n${patch.trim()}\n`;
  console.log("Applied beta6 flicker-free runtime patch");
}

const beta7Marker = "__navimower037Beta7StableCycle";
if (!source.includes(beta7Marker)) {
  const patch = await readFile(resolve(root, "scripts", "runtime-v037-beta7.js.txt"), "utf8");
  source = `${source.trimEnd()}\n\n${patch.trim()}\n`;
  console.log("Applied beta7 stable-cycle runtime patch");
}

const marker = /var NAVIMOWER_MAP_CARD_VERSION2 = "[^"]+";/;
if (!marker.test(source)) {
  throw new Error("Runtime version marker NAVIMOWER_MAP_CARD_VERSION2 was not found");
}
const next = source.replace(marker, `var NAVIMOWER_MAP_CARD_VERSION2 = "${pkg.version}";`);
const current = await readFile(sourcePath, "utf8");
if (next !== current) {
  await writeFile(sourcePath, next, "utf8");
  console.log(`Synced runtime version to ${pkg.version}`);
} else {
  console.log(`Runtime version already matches ${pkg.version}`);
}
