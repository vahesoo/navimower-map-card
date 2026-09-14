import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

const activePublicDocs = [
  "README.md",
  "CONTRIBUTING.md",
  "docs/ARCHITECTURE.md",
  "docs/GATE_AREA_EDITOR.md",
  "docs/MULTI_MOWER_AND_UNDERLAYS.md",
  "docs/PRIVACY_AND_FRONTEND_BOUNDARY.md",
  "docs/SESSION_API.md",
  "docs/outline-controls.md",
];

for (const path of activePublicDocs) {
  const text = read(path);
  for (const phrase of [
    "private-cloud",
    "private cloud",
    "reverse engineering",
    "reverse-engineering",
    "captured live",
    "proven live",
  ]) {
    assert.ok(
      !text.toLowerCase().includes(phrase),
      `${path} must keep current public wording focused on frontend interoperability, not protocol provenance: ${phrase}`,
    );
  }
}

const readme = read("README.md");
assert.ok(readme.includes("The card is a frontend only"));
assert.ok(readme.includes("mower commands, schedules, notifications, map/georeference data and gate occupancy remain integration responsibilities"));
assert.ok(readme.includes("Google credentials and tile-session secrets stay on the Home Assistant backend"));

const architecture = read("docs/ARCHITECTURE.md");
assert.ok(architecture.includes("Navimow account/cloud and MQTT communication"));
assert.ok(architecture.includes("only through Home Assistant and Navimower integration APIs"));
assert.ok(architecture.includes("account session tokens and map-provider secrets remain backend-owned"));

const multi = read("docs/MULTI_MOWER_AND_UNDERLAYS.md");
assert.ok(multi.includes("API key and provider session token are backend-owned"));
assert.ok(multi.includes("not exposed to card JavaScript"));

const privacy = read("docs/PRIVACY_AND_FRONTEND_BOUNDARY.md");
assert.ok(privacy.includes("does not require or store Navimow account credentials"));
assert.ok(privacy.includes("sanitized Home Assistant Download diagnostics workflow"));

console.log("frontend privacy/interoperability wording checks passed");
