import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "src", "navimower-map-card.js");
const patchPath = resolve(root, "scripts", "runtime-v037-beta6.js.txt");
const marker = "__navimower037Beta6FlickerFree";

const [source, patch] = await Promise.all([
  readFile(sourcePath, "utf8"),
  readFile(patchPath, "utf8"),
]);

if (source.includes(marker)) {
  console.log("beta6 flicker-free runtime patch already present");
} else {
  await writeFile(sourcePath, `${source.trimEnd()}\n\n${patch.trim()}\n`, "utf8");
  console.log("Applied beta6 flicker-free runtime patch");
}
