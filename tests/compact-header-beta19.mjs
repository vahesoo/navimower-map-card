import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/navimower-map-card.js", "utf8");

// Core header buttons are icon-only while keeping labels in accessibility/title metadata.
assert.match(
  source,
  /class="nm-history-button" aria-label="Open mowing history" title="Mowing history">\s*<ha-icon icon="mdi:history"><\/ha-icon>\s*<\/button>/,
);
assert.match(
  source,
  /class="nm-schedule-button" aria-label="Open mowing schedule" title="Mowing schedule">\s*<ha-icon icon="mdi:calendar-clock"><\/ha-icon>\s*<\/button>/,
);
assert.doesNotMatch(source, /<span>History<\/span>/);
assert.doesNotMatch(source, /<span>Schedule<\/span>/);

// Notification header label injection is disabled in the cumulative runtime.
assert.match(source, /button\?\.querySelector\?\.\("\.nm-notification-button-label"\)\?\.remove\?\.\(\)/);
assert.doesNotMatch(source, /label\.textContent = "Notifications"/);
assert.match(source, /\.nm-notification-button \{ width: 34px; min-width: 34px; height: 34px;/);

// Gate Area editor trigger lives in the header and uses an edit-vector icon.
assert.match(source, /icon="mdi:vector-square-edit"/);
assert.match(
  source,
  /const header = card\.querySelector\?\.\("\.nm-header-actions"\) \|\| card\.querySelector\?\.\("\.nm-header"\)/,
);
assert.match(source, /if \(settings\) settings\.before\(button\);/);
assert.doesNotMatch(source, /\.nm-gate19-button\{position:absolute/);

// Gate editor content remains map-local; only the trigger moved.
assert.match(source, /wrap\.appendChild\(menu\);/);
assert.match(source, /wrap\.appendChild\(panel\);/);
assert.match(source, /\.nm-gate19-menu\{position:absolute;top:10px;right:10px/);

// Compact icon sizing is consistent with other header actions.
assert.match(source, /\.nm-history-button, \.nm-schedule-button \{ width: 34px; height: 34px;/);
assert.match(source, /\.nm-gate19-button\{width:34px;height:34px;min-width:34px;/);
assert.match(source, /\.nm-gate19-button ha-icon\{--mdc-icon-size:22px\}/);

console.log("Compact header beta19: icon-only actions and header Gate Area editor trigger passed");
