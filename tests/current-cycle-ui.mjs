import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");

for (const needle of [
  'daily_trails?.scope === "current_cycle"',
  '[data-history-offset="today"]',
  'button.textContent = "Current cycle"',
  "latest confirmed reset",
]) {
  if (!source.includes(needle)) {
    throw new Error(`Missing current-cycle UI contract: ${needle}`);
  }
}


if (!source.includes("this._historyDayOffset === null ? this._dailyTrailRecords() : null")) {
  throw new Error("Live current-cycle trail must stay separate from historical date views");
}

console.log("Current-cycle UI regression checks passed");
