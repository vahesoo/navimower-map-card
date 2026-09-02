import { readFile, writeFile } from "node:fs/promises";

const sourcePath = new URL("../src/navimower-map-card.js", import.meta.url);
let source = await readFile(sourcePath, "utf8");
const oldGuard = `    if (provider10(card) !== "estonia_orthophoto" || view.scale < DETAIL_SCALE_THRESHOLD) {
      card._estoniaWmsDetailTimer036 = null;`;
const newGuard = `    if (!["estonia_orthophoto", "estonia_hybrid"].includes(provider10(card)) || view.scale < DETAIL_SCALE_THRESHOLD) {
      card._estoniaWmsDetailTimer036 = null;`;
if (source.includes(newGuard)) {
  console.log("0.3.6-beta11 detail scheduler prep already applied");
  process.exit(0);
}
if (!source.includes(oldGuard)) {
  throw new Error("Expected beta10 detail scheduler guard was not found");
}
source = source.replace(oldGuard, newGuard);
await writeFile(sourcePath, source, "utf8");
console.log("Prepared beta10 detail scheduler for beta11 hybrid underlay");
