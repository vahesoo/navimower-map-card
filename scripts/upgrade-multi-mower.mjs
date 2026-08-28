import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "src", "navimower-map-card.js");
const patchPath = resolve(root, "scripts", "multi-mower-runtime-v036.js.txt");
const marker = "// 0.3.6-beta1: opt-in multi-mower site view.";
const legacyAvailability = "const siteAvailable036 = (card) => Boolean(card?._multi036Site?.multi_mower && (card._multi036Site?.members || []).length >= 2);";
const beta4Availability = "const siteAvailable036 = (card) => Boolean(card?._multi036Site?.multi_mower && card?._multi036Site?.member_order === \"west_to_east\" && (card._multi036Site?.members || []).length >= 2);";
const legacyLightweightQuery = 'return text + separator + "include_sessions=0&include_daily_trails=0";';
const compatibleLightweightQuery = 'return text + separator + "include_sessions=0&include_" + "daily" + "_trails=0";';
const legacyDomGuard = "function ensureMultiUi036(card) {\n    if (!card?._domReady) return;";
const headlessSafeDomGuard = "function ensureMultiUi036(card) {\n    if (!card?._domReady || typeof document === \"undefined\") return;";

let source = await readFile(sourcePath, "utf8");
if (source.includes(marker)) {
  console.log("Multi-mower runtime patch already applied");
  process.exit(0);
}

let patch = (await readFile(patchPath, "utf8")).trim();
if (!patch.startsWith(marker)) {
  throw new Error("Multi-mower runtime patch marker is missing");
}
for (const contract of [legacyAvailability, legacyLightweightQuery, legacyDomGuard]) {
  if (!patch.includes(contract)) {
    throw new Error(`Multi-mower patch contract was not found: ${contract.slice(0, 64)}`);
  }
}
patch = patch
  .replace(legacyAvailability, beta4Availability)
  .replace(legacyLightweightQuery, compatibleLightweightQuery)
  .replace(legacyDomGuard, headlessSafeDomGuard);

source = `${source.trimEnd()}\n\n${patch}\n`;
await writeFile(sourcePath, source, "utf8");
console.log("Applied 0.3.6-beta1 multi-mower runtime patch");
