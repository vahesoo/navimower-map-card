import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
assert.ok(
  ["0.3.1-beta6", "0.3.1"].includes(pkg.version),
  `expected 0.3.1-beta6 or stable 0.3.1, got ${pkg.version}`,
);
assert.match(pkg.scripts.build, /scripts\/build\.mjs/);
assert.match(pkg.scripts.check, /check-runtime-layout\.mjs/);
assert.match(pkg.scripts.test, /v0316-beta6-single-runtime\.mjs/);

const expectedRuntime = ["navimower-map-card.js"];
for (const root of ["src", "dist"]) {
  const js = readdirSync(root).filter((name) => name.endsWith(".js")).sort();
  assert.deepEqual(js, expectedRuntime, `${root} must contain exactly one runtime JS file`);
}

const source = readFileSync("src/navimower-map-card.js", "utf8");
const dist = readFileSync("dist/navimower-map-card.js", "utf8");
assert.equal(dist, source, "dist must remain an exact build copy of src");
assert.match(source, /0\.3\.1-beta6/);
assert.doesNotMatch(source, /(?:from\s+|import\s*)["']\.\/navimower-map-card-/);

for (const marker of [
  "LATEST_MAP_PAYLOAD_CACHE",
  "daily_trails_revision",
  "show_vf_off_areas",
  "notification_count",
  "mark_notification_read",
  "mark_all_notifications_read",
  "nm-has-resume",
  "navimower.resume",
]) {
  assert.ok(source.includes(marker), `flattened runtime must retain ${marker}`);
}

const hacs = JSON.parse(readFileSync("hacs.json", "utf8"));
assert.equal(hacs.filename, "navimower-map-card.js");

const build = readFileSync("scripts/build.mjs", "utf8");
assert.match(build, /sourceJs\.length !== 1/);
assert.match(build, /await rm\(distDir/);
assert.match(build, /await copyFile\(source, target\)/);

const guard = readFileSync("scripts/check-runtime-layout.mjs", "utf8");
assert.match(guard, /src must contain exactly one runtime JavaScript file/);
assert.match(guard, /dist must contain exactly one runtime JavaScript file/);
assert.match(guard, /byte|exact build copy/i);

const contributing = readFileSync("CONTRIBUTING.md", "utf8");
assert.match(contributing, /exactly one runtime JavaScript file/i);
assert.match(contributing, /Do \*\*not\*\* add files such as/);
assert.match(contributing, /genuinely needs more than one runtime JavaScript file/i);

for (const workflow of [
  ".github/workflows/publish-prerelease.yml",
  ".github/workflows/publish-release.yml",
]) {
  const text = readFileSync(workflow, "utf8");
  const trigger = text.split("\npermissions:")[0];
  assert.match(trigger, /paths:\n\s+- package\.json/);
  assert.doesNotMatch(trigger, /src\/navimower-map-card\.js/);
  assert.doesNotMatch(trigger, /release-notes/);
}

console.log("0.3.1 beta6/stable single-runtime regression checks passed");
