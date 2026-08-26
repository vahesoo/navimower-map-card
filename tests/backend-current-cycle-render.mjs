import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");

for (const needle of [
  "0.3.5-beta9: backend-owned current-cycle mowed-area render",
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

const markers = source.match(/0\.3\.5-beta9: backend-owned current-cycle mowed-area render/g) || [];
if (markers.length !== 1) {
  throw new Error(`Expected exactly one beta9 backend current-cycle patch, got ${markers.length}`);
}

const patchStart = source.indexOf("// 0.3.5-beta9: backend-owned current-cycle mowed-area render");
const patch = source.slice(patchStart);
if (patch.includes("loadVisibleRenders(this")) {
  throw new Error("Default current-cycle render must not fetch completed session archives");
}
if (patch.includes("daily_trails")) {
  throw new Error("Backend current-cycle render must not reconstruct cycle state from daily trails");
}
if (!patch.includes("return previousRenderHistory?.call(this);")) {
  throw new Error("Historical date views must retain the existing session archive renderer");
}

console.log("Backend current-cycle render regression checks passed");
