import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "src/navimower-map-card.js");
const target = resolve(root, "dist/navimower-map-card.js");

await mkdir(dirname(target), { recursive: true });
await copyFile(source, target);
console.log(`Built ${target}`);
