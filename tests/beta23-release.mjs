import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
assert.equal(pkg.version, "0.3.6-beta23");

const notes = readFileSync(".github/release-notes/0.3.6-beta23.md", "utf8");
assert.ok(notes.startsWith("title: Navimower Map Card 0.3.6-beta23"));
assert.ok(notes.includes("privacy and interoperability cleanup"));
assert.ok(notes.includes("Existing screenshots/images and Navimower branding are unchanged"));

console.log("0.3.6-beta23 release regression checks passed");
