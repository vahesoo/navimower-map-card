import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

assert.match(pkg.version, /^0\.3\.7(?:-beta28)?$/, "beta28 feature contract must remain on beta28 or stable 0.3.7");

assert.ok(source.includes("var ZOOM_AUTO_RESET_MS = 30_000;"));
assert.ok(source.includes("zoom_auto_reset: true"));
assert.ok(source.includes('zoom_auto_reset: "Auto-reset zoom after 30 seconds"'));
assert.ok(source.includes('{ name: "zoom_auto_reset", selector: { boolean: {} } }'));
assert.ok(source.includes("this._config.zoom_auto_reset = normalizeBoolean"));
assert.ok(source.includes("_scheduleZoomReset()"));
assert.ok(source.includes("if (!this._initialViewApplied) this._applyInitialView(false);"));
assert.ok(
  !source.includes("this._initialViewApplied = false;\n    this._applyInitialView(false);\n    this._mapPostV030?.(sourcePayload);"),
  "Map payload refresh must not reset the user viewport",
);

assert.ok(source.includes(".nm-highlight .nm-session-selected.nm-session-pulse"));
assert.ok(source.includes(".nm-multi-selected-session.nm-session-pulse"));
assert.ok(source.includes('.classList.add("nm-session-pulse")'));
assert.ok(
  !source.includes(".nm-highlight .nm-session-selected {\n          animation: nm-session-glow-pulse"),
  "Single selected-session overlay must not auto-pulse after rerender",
);
assert.ok(
  !source.includes('".nm-multi-selected-session{animation:nm-multi-session-pulse'),
  "Multi selected-session overlay must not auto-pulse after rerender",
);

for (const text of [
  'title: "Quick settings"',
  'button.title = "Quick settings"',
  'button.setAttribute("aria-label", "Open quick settings")',
  '>Quick settings</div>',
  'show_settings_button: "Quick settings"',
]) {
  assert.ok(source.includes(text), "Missing Quick settings UI contract: " + text);
}
assert.ok(source.includes("show_settings_button"));
assert.ok(source.includes("settings_entity_"));

console.log("beta28 History pulse, 30 s zoom auto-reset and Quick settings contracts passed");
