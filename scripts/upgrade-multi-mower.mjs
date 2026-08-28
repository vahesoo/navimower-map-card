import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "src", "navimower-map-card.js");
const patchPath = resolve(root, "scripts", "multi-mower-runtime-v036.js.txt");
const marker = "// 0.3.6-beta1: opt-in multi-mower site view.";

let source = await readFile(sourcePath, "utf8");
if (source.includes(marker)) {
  console.log("Multi-mower runtime patch already applied");
  process.exit(0);
}

const patch = (await readFile(patchPath, "utf8")).trim();
if (!patch.startsWith(marker)) {
  throw new Error("Multi-mower runtime patch marker is missing");
}

source = `${source.trimEnd()}\n\n${patch}\n`;
await writeFile(sourcePath, source, "utf8");
console.log("Applied 0.3.6-beta1 multi-mower runtime patch");
