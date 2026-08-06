import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  COLOR_FIELDS,
  SCHEDULE_CLOSE_DELAY_MS,
  extendColorConfigForm,
  normalizeColorEditorConfig,
  normalizeHexColor,
  scheduleSaveSucceeded,
} from "../src/navimower-map-card-v034.js";

assert.equal(SCHEDULE_CLOSE_DELAY_MS, 2500);
assert.equal(normalizeHexColor("abc"), "#AABBCC");
assert.equal(normalizeHexColor("#12abef"), "#12ABEF");
assert.equal(normalizeHexColor("#abcd"), null);
assert.equal(normalizeHexColor("", { allowBlank: true }), "");
assert.equal(normalizeHexColor("", { allowBlank: false }), null);

const initial = normalizeColorEditorConfig({
  zone_fill_color: "#81c784",
  zone_stroke_color: "#43a047",
  trail_color: "#43a047",
  off_limit_color: "#ff5a00",
  vf_off_color: "#2f80ed",
  channel_color: "#686868",
  gate_area_color: "#8e24aa",
  dock_color: "#37474f",
  map_background_color: "",
});
assert.equal(initial.zone_fill_color, "#81C784");
assert.equal(initial.map_background_color, "");
assert.equal(Object.keys(initial).some((key) => key.endsWith("_hex")), false);

const pickerChanged = normalizeColorEditorConfig({
  ...initial,
  zone_fill_color: "#123456",
}, initial);
assert.equal(pickerChanged.zone_fill_color, "#123456");

// The picker and text selector share this same configuration key. A value from
// either control therefore follows the same normalization path.
const manualChanged = normalizeColorEditorConfig({
  ...pickerChanged,
  zone_fill_color: "abc",
}, pickerChanged);
assert.equal(manualChanged.zone_fill_color, "#AABBCC");

const invalidManual = normalizeColorEditorConfig({
  ...manualChanged,
  zone_fill_color: "not-a-color",
}, manualChanged);
assert.equal(invalidManual.zone_fill_color, "#AABBCC");

const themeBackground = normalizeColorEditorConfig({
  ...invalidManual,
  map_background_color: "",
}, { ...invalidManual, map_background_color: "#112233" });
assert.equal(themeBackground.map_background_color, "");

const form = extendColorConfigForm({
  schema: [{
    name: "appearance_grid",
    schema: COLOR_FIELDS.map((field) => ({
      name: field.key,
      selector: { text: { type: "color" } },
    })),
  }],
  computeLabel: (schema) => `Original ${schema?.name}`,
});
const appearance = form.schema[0].schema;
for (const field of COLOR_FIELDS) {
  const pickerIndex = appearance.findIndex(
    (item) => item.name === field.key && item.navimower_hex !== true,
  );
  const manualIndex = appearance.findIndex(
    (item) => item.name === field.key && item.navimower_hex === true,
  );
  assert.equal(manualIndex, pickerIndex + 1);
  assert.equal(appearance[manualIndex].name, appearance[pickerIndex].name);
  assert.deepEqual(appearance[manualIndex].selector, { text: {} });
  assert.match(form.computeLabel(appearance[manualIndex]), /HEX/);
}
assert.equal(form.computeLabel({ name: "unrelated" }), "Original unrelated");

assert.equal(scheduleSaveSucceeded({
  _scheduleDraft: [{ _dirty: false, _saving: false }],
  _scheduleStatus: { mon: { kind: "saved" } },
}), true);
assert.equal(scheduleSaveSucceeded({
  _scheduleDraft: [{ _dirty: true, _saving: false }],
  _scheduleStatus: {},
}), false);
assert.equal(scheduleSaveSucceeded({
  _scheduleDraft: [{ _dirty: false, _saving: false }],
  _scheduleStatus: { mon: { kind: "error" } },
}), false);

for (const root of ["src", "dist"]) {
  const source = readFileSync(`${root}/navimower-map-card-v034.js`, "utf8");
  assert.match(source, /this\._scheduleDialogOpen = true/);
  assert.match(source, /this\._scheduleDialogOpen = false/);
  assert.match(source, /SCHEDULE_CLOSE_DELAY_MS/);
  assert.match(source, /navimower_hex/);
  assert.doesNotMatch(source, /concurrenc|semaphore|Promise\.allSettled/i);
}

console.log("0.3.0-beta5 color and schedule checks passed");
