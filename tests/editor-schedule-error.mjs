import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");

for (const needle of [
  "0.3.5-beta11: real color defaults, combined schedule state and mower error pulse",
  'zone_fill_color: "#81c784"',
  'vf_off_color: "#2F80ED"',
  'gate_area_color: "#8e24aa"',
  'custom_area_color: "#8e24aa"',
  'field.default = COLOR_DEFAULTS[field.name]',
  'const { prefix: _prefix, ...rest } = text',
  'managedScheduleEnabled(card)',
  'snapshot.scheduleEnabled === true || managed',
  'button.classList.toggle("active", active)',
  'nm-mower-error-pulse',
  'mower.attributes?.activity',
]) {
  if (!source.includes(needle)) {
    throw new Error(`Missing beta11 editor/status contract: ${needle}`);
  }
}

const markers = source.match(/0\.3\.5-beta11: real color defaults, combined schedule state and mower error pulse/g) || [];
if (markers.length !== 1) {
  throw new Error(`Expected exactly one beta11 patch, got ${markers.length}`);
}

// The previous beta10 prefix workaround may remain in the historical source,
// but beta11 must explicitly remove it from every native color selector after
// all earlier editor patches have run.
if (!source.includes('field.selector = { ...field.selector, text: rest }')) {
  throw new Error("Beta11 must restore uniform native color selector layout");
}

console.log("Beta11 editor defaults, combined schedule state and mower error pulse checks passed");
