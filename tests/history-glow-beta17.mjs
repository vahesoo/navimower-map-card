import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/navimower-map-card.js", "utf8");

// Card editor controls stay user-configurable.
assert.match(source, /trail_color/);
assert.match(source, /trail_opacity/);
assert.match(source, /trail_color:\s*"Trail color"|trail_color:\s*"Mowed area"/);
assert.match(source, /trail_opacity/);

// Selected History is an overlay, not an isolation mode.
assert.doesNotMatch(
  source,
  /if \(card\?\._historySelectedSessionId\) \{\s*if \(card\._historyEl\) card\._historyEl\.innerHTML = "";/,
);
assert.match(
  source,
  /const currentView = \(card\) =>\s*card\._historyDayOffset === null \|\| card\._historyDayOffset === undefined;/,
);
assert.match(
  source,
  /if \(card\._historyDayOffset === null \|\| card\._historyDayOffset === undefined\) \{/,
);

// Single and Multi selected sessions use explicit glow overlays.
assert.match(source, /function archiveHighlightSvg\(/);
assert.match(source, /class="nm-session-selected nm-session-archive-glow"/);
assert.match(source, /const renderArchiveGlow036 = \(render, color\) =>/);
assert.match(source, /nm-multi-selected-session nm-session-selected/);
assert.match(source, /nm-multi-selected-session\.nm-session-pulse/);
assert.match(source, /classList\.add\("nm-session-pulse"\)/);

// Glow is attached to the actual SVG highlight layer.
assert.match(source, /\.nm-highlight \{ pointer-events: none; \}/);
assert.match(source, /\.nm-highlight \.nm-session-selected\.nm-session-pulse/);
assert.match(source, /filter: drop-shadow\(0 0 10px var\(--nm-highlight-color\)\)/);

// Base and highlight use the same configured trail tone; opacity remains on base layers.
assert.match(source, /archiveHighlightSvg\([\s\S]*this\._config\.trail_color/);
assert.match(source, /archiveSvg\([\s\S]*this\._config\.trail_color,[\s\S]*this\._config\.trail_opacity/);

console.log("History glow beta17: same tone, editor controls, persistent day geometry and Single/Multi glow overlay passed");
