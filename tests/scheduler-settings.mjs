import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");
for (const needle of [
  "schedule_view_mode",
  "Automatic",
  "Navimower",
  "Native",
  "set_schedule_queue",
  "data-queue-up",
  "data-queue-down",
  "data-queue-add",
  "0.3.4-beta8: native Home Assistant Settings rows and single-dialog flow",
  "globalThis.loadCardHelpers",
  "helpers.createRowElement",
  "data-beta8-settings-root",
  "nm-native-row-wrap",
  "_beta8SettingsOpen",
  "event.stopImmediatePropagation()",
  "this._beta5SettingsOpen = false",
  "this._beta6SettingsOpen = false",
]) {
  if (!source.includes(needle)) throw new Error(`Missing scheduler/settings runtime feature: ${needle}`);
}

const beta8Markers = source.match(/0\.3\.4-beta8: native Home Assistant Settings rows and single-dialog flow/g) || [];
if (beta8Markers.length !== 1) {
  throw new Error(`Expected exactly one beta8 Settings runtime patch, got ${beta8Markers.length}`);
}

console.log("Scheduler/settings regression checks passed");
