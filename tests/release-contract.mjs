import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
assert.match(pkg.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, "package version must be release-like");
assert.ok(!/\b(?:beta\d+-version|prepare-beta\d+)\b/.test(pkg.scripts.test || ""), "tests must not depend on beta-specific builders");
assert.ok(!/npm run (?:build|prepare-release)/.test(pkg.scripts.test || ""), "npm test must be read-only");

const notes = `.github/release-notes/${pkg.version}.md`;
assert.ok(existsSync(notes), `missing release notes: ${notes}`);
const notesText = readFileSync(notes, "utf8");
assert.ok(notesText.includes(pkg.version), "release notes must name the package version");

const source = readFileSync("src/navimower-map-card.js", "utf8");
const dist = readFileSync("dist/navimower-map-card.js", "utf8");
assert.ok(source.includes(`var NAVIMOWER_MAP_CARD_VERSION2 = "${pkg.version}";`), "runtime version must match package.json");
assert.equal(dist, source, "dist must be the committed build copy of src");

const betaVersionScripts = readdirSync("scripts").filter((name) => /^beta\d+-version\.mjs$/.test(name));
assert.deepEqual(betaVersionScripts, [], "beta-specific version scripts must not return");
assert.ok(existsSync(".github/workflows/publish.yml"), "generic publish workflow is required");
assert.ok(!existsSync(".github/workflows/release-beta3-now.yml"), "beta-specific release workflows must not return");
console.log(`${pkg.version} release contract checks passed`);
