import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Historical regression: beta23 was the final prerelease before 0.3.6 stable.
// Keep its release record available without pinning the active package version.
const notes = readFileSync(".github/release-notes/0.3.6-beta23.md", "utf8");
assert.ok(notes.startsWith("title: Navimower Map Card 0.3.6-beta23"));
assert.ok(notes.includes("privacy and interoperability cleanup"));
assert.ok(notes.includes("Existing screenshots/images and Navimower branding are unchanged"));

console.log("0.3.6-beta23 historical release regression checks passed");
