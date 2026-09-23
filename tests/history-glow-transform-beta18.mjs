import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/navimower-map-card.js", "utf8");

// Single History glow must not combine the map matrix and CSS filter on the same
// SVG group. Chrome can rasterize CSS drop-shadow in the wrong coordinate space
// when a negative-Y SVG matrix lives on the filtered group.
const singleGlowReturn = source.match(
  /return `<g class="nm-session-selected nm-session-archive-glow"[^\n]+<g class="nm-session-glow-geometry" transform="\$\{matrix\.value\}">/,
);
assert.ok(singleGlowReturn, "Single History glow must use an inner transformed geometry group");

const outerTag = singleGlowReturn[0].split('><g class="nm-session-glow-geometry"')[0];
assert.doesNotMatch(outerTag, /transform=/, "filtered outer glow group must stay in screen space");
assert.match(
  source,
  /<g class="nm-session-glow-geometry" transform="\$\{matrix\.value\}">/,
  "map matrix must remain on inner glow geometry",
);

// The base History archive still uses the same layout matrix, so the glow and
// selected session geometry share identical map placement.
assert.match(
  source,
  /return `<g class="nm-session-archive"[^\n]+transform="\$\{matrix\.value\}">/,
);

// Multi mower already follows the safe pattern: member-map carries the matrix,
// while the selected glow group itself has no transform.
assert.match(source, /class="nm-multi-member-map"[^\n]+transform=/);
assert.match(source, /nm-multi-selected-session nm-session-selected/);

console.log("History glow beta18: Single filter stays in screen space while geometry keeps the map matrix");
