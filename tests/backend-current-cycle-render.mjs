import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");

for (const needle of [
  "renderBackendCurrentCycle",
  "current_cycle_render",
  'current?.scope !== "current_cycle"',
  'this._historyDayOffset !== null',
  'current?.mowed_area',
  'archiveSvg(',
  '"current-cycle"',
  'button.textContent = "Current cycle"',
  "latest confirmed reset",
]) {
  if (!source.includes(needle)) {
    throw new Error(`Missing backend current-cycle render contract: ${needle}`);
  }
}

if (source.includes("__navimower035Beta9CurrentCycleRender")) {
  throw new Error("Backend current-cycle rendering must stay folded into the canonical history pipeline");
}

const patchStart = source.indexOf("const renderBackendCurrentCycle");
const patchEnd = source.indexOf("const zoneProgress", patchStart);
const patch = source.slice(patchStart, patchEnd > patchStart ? patchEnd : undefined);
if (patch.includes("loadVisibleRenders(this")) {
  throw new Error("Default current-cycle render must not fetch completed session archives");
}
if (patch.includes("daily_trails")) {
  throw new Error("Backend current-cycle render must not reconstruct cycle state from daily trails");
}
if (!source.includes("return previousRenderHistory.apply(this, args);")) {
  throw new Error("Historical date views must retain the existing session archive renderer");
}

console.log("Backend current-cycle render regression checks passed");
