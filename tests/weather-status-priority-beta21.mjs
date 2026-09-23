import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/navimower-map-card.js", "utf8");

assert.match(
  source,
  /const explicitStatus = this\._config\?\.status_entity[\s\S]*?const status = explicitStatus\s*\|\|\s*mapAttrs\.display_state\s*\|\|\s*this\._mapPayload\?\.display_state\s*\|\|\s*mowerState2\?\.attributes\?\.display_state\s*\|\|\s*this\._text\(/,
  "live snapshot must prefer composed display_state over the auto-resolved lawn_mower state",
);

assert.match(
  source,
  /const status = explicitStatus\s*\|\|\s*mapAttrs\.display_state\s*\|\|\s*this\._mapPayload\?\.display_state\s*\|\|\s*mowerState\?\.attributes\?\.display_state\s*\|\|\s*this\._text\(/,
  "footer must prefer composed display_state over the auto-resolved lawn_mower state",
);

assert.match(
  source,
  /this\._text\(\s*this\._resolved\.status_entity,\s*mapAttrs\.activity \|\| this\._mapPayload\?\.activity/,
  "the canonical mower/status entity must remain only a compatibility fallback",
);

assert.match(
  source,
  /const unavailable = !mower \|\| \["unavailable", "unknown"\]\.includes\(String\(mower\.state\)/,
  "controls must continue to use canonical lawn_mower state",
);

console.log("beta21 weather status priority regression checks passed");
