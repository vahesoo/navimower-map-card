import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const files = [
  "navimower-map-card.js",
  "navimower-map-card-core.js",
  "navimower-map-card-v030.js",
  "navimower-map-card-v031.js",
  "navimower-map-card-v032.js",
  "navimower-map-card-v033.js",
  "navimower-map-card-v034.js",
];

await mkdir(resolve(root, "dist"), { recursive: true });
for (const filename of files) {
  const source = resolve(root, "src", filename);
  const target = resolve(root, "dist", filename);
  await copyFile(source, target);
  console.log(`Built ${target}`);
}
