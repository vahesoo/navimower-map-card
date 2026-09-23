import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/navimower-map-card.js", "utf8");

assert.match(
  source,
  /mapAttrs\.display_state\s*\|\|\s*this\._mapPayload\?\.display_state\s*\|\|\s*mowerState2\?\.attributes\?\.display_state\s*\|\|\s*mapAttrs\.activity/,
  "single live snapshot must prefer the integration composed display state before physical activity",
);

assert.match(
  source,
  /mapAttrs\.display_state\s*\|\|\s*this\._mapPayload\?\.display_state\s*\|\|\s*mowerState\?\.attributes\?\.display_state\s*\|\|\s*mapAttrs\.activity/,
  "single footer must prefer the integration composed display state before physical activity",
);

assert.match(
  source,
  /const memberDisplayState036 = \(card, member, mower\) => \{[\s\S]*?payload\?\.display_state[\s\S]*?mower\?\.attributes\?\.display_state[\s\S]*?mower\?\.state/,
  "multi mower metadata must prefer Map API or mower display_state before the canonical mower state",
);

assert.match(
  source,
  /const unavailable = !mower \|\| \["unknown", "unavailable"\]\.includes\(String\(mower\.state/,
  "command availability must continue to use the canonical lawn_mower state",
);

assert.match(
  source,
  /const values = \[mower\.state, mower\.attributes\?\.activity, mower\.attributes\?\.state\]/,
  "error presentation must continue to use physical/canonical mower state rather than weather display state",
);

console.log("beta20 weather display state regression checks passed");
