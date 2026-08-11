import { copyFile, mkdir, readdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = resolve(root, "src");
const distDir = resolve(root, "dist");
const source = resolve(srcDir, "navimower-map-card.js");
const target = resolve(distDir, "navimower-map-card.js");

const sourceJs = (await readdir(srcDir)).filter((name) => name.endsWith(".js"));
if (sourceJs.length !== 1 || sourceJs[0] !== "navimower-map-card.js") {
  throw new Error(`src must contain exactly navimower-map-card.js; found: ${sourceJs.join(", ")}`);
}

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });
await copyFile(source, target);
console.log(`Built ${target}`);
