import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
assert.match(pkg.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, "package version must be release-like");
assert.ok(!/\b(?:beta\d+-version|prepare-beta\d+)\b/.test(pkg.scripts.test || ""), "tests must not depend on beta-specific builders");
assert.ok(!/npm run (?:build|prepare-release)/.test(pkg.scripts.test || ""), "npm test must be read-only");

const prepareRelease = pkg.scripts["prepare-release"] || "";
assert.equal(
  prepareRelease,
  "node scripts/sync-version.mjs && node scripts/build.mjs",
  "release preparation must only synchronize the version and build the optimized single-file runtime",
);
assert.doesNotMatch(
  prepareRelease,
  /(?:upgrade-|prepare-runtime-pipeline-beta|beta\d+)/,
  "historical beta patch scripts must not be part of the active release pipeline",
);

const notes = `.github/release-notes/${pkg.version}.md`;
assert.ok(existsSync(notes), `missing release notes: ${notes}`);
const notesText = readFileSync(notes, "utf8");
assert.ok(notesText.includes(pkg.version), "release notes must name the package version");

const source = readFileSync("src/navimower-map-card.js", "utf8");
const dist = readFileSync("dist/navimower-map-card.js", "utf8");
assert.ok(source.includes(`var NAVIMOWER_MAP_CARD_VERSION2 = "${pkg.version}";`), "runtime version must match package.json");
assert.ok(Buffer.byteLength(dist) < Buffer.byteLength(source), "optimized dist must be smaller than source");\nassert.ok(dist.includes(pkg.version), "optimized dist must contain the package version");\nassert.ok(dist.includes(`[Navimower Map Card] v${pkg.version} loaded`), "optimized dist must retain the current startup version message");

const startupVersionLogs = [...source.matchAll(/console\.info\(\s*["'`]\[Navimower Map Card\]\s+v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?[^"'\`\r\n]*["'`]\s*,?\s*\);/g)];
assert.equal(startupVersionLogs.length, 1, "runtime must expose exactly one informational version startup log");
assert.equal(
  startupVersionLogs[0][0],
  `console.info("[Navimower Map Card] v${pkg.version} loaded");`,
  "startup log must report only the current package version",
);

const betaVersionScripts = readdirSync("scripts").filter((name) => /^beta\d+-version\.mjs$/.test(name));
assert.deepEqual(betaVersionScripts, [], "beta-specific version scripts must not return");
assert.ok(existsSync(".github/workflows/publish.yml"), "generic publish workflow is required");
assert.ok(!existsSync(".github/workflows/release-beta3-now.yml"), "beta-specific release workflows must not return");
console.log(`${pkg.version} release contract checks passed`);
