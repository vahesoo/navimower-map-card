import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const read = (path) => readFileSync(path, "utf8");
const readme = read("README.md");

for (const path of [
  "docs/ARCHITECTURE.md",
  "docs/MULTI_MOWER_AND_UNDERLAYS.md",
  "docs/GATE_AREA_EDITOR.md",
  "docs/SESSION_API.md",
  "docs/outline-controls.md",
]) {
  assert.ok(existsSync(path), `missing current documentation file: ${path}`);
  assert.ok(readme.includes(path), `README must link ${path}`);
}

for (const token of [
  "Multi mower",
  "provider-specific reference frames",
  "current-cycle",
  "internal map zone IDs",
  "First-generation H-series",
  "navimower.set_gate_area",
  "navimower.delete_gate_area",
  "nearest existing polygon edge",
]) {
  assert.ok(readme.includes(token), `README missing current behavior: ${token}`);
}

const architecture = read("docs/ARCHITECTURE.md");
for (const token of [
  "include_current_cycle=0",
  "current_cycle_only=1",
  "bounded concurrency",
  "generation-checked",
  "node scripts/sync-version.mjs && node scripts/build.mjs",
]) {
  assert.ok(architecture.includes(token), `architecture guide missing ${token}`);
}

const multi = read("docs/MULTI_MOWER_AND_UNDERLAYS.md");
for (const token of [
  "web_wgs84",
  "regional_cartographic",
  "underlay_origins",
  "Google Satellite",
  "-10.0 m ... +10.0 m",
]) {
  assert.ok(multi.includes(token), `Multi/underlay guide missing ${token}`);
}

const gate = read("docs/GATE_AREA_EDITOR.md");
for (const token of [
  "first three",
  "nearest existing polygon edge",
  "no maximum screen-distance threshold",
  "3 to 64",
  "self-intersecting",
  "navimower.set_gate_area",
]) {
  assert.ok(gate.includes(token), `Gate editor guide missing ${token}`);
}

const session = read("docs/SESSION_API.md");
assert.ok(session.includes("include_current_cycle=0"));
assert.ok(session.includes("current_cycle_only=1"));
assert.ok(session.includes("Home Assistant's configured time zone"));
assert.ok(!session.includes("Map Card 0.1.6"), "obsolete 0.1.6 Session API wording must not return");

const outlines = read("docs/outline-controls.md");
for (const key of [
  "zone_stroke_width",
  "off_limit_stroke_width",
  "vf_off_stroke_width",
  "channel_stroke_width",
  "gate_area_stroke_width",
  "dock_stroke_width",
  "custom_area_stroke_width",
]) {
  assert.ok(outlines.includes(`\`${key}\``), `outline guide missing ${key}`);
}
assert.ok((outlines.match(/`1\.5`/g) || []).length >= 7, "all current outline defaults must be documented as 1.5");

const notes = `.github/release-notes/${pkg.version}.md`;
assert.ok(existsSync(notes), `missing release notes for ${pkg.version}`);
assert.ok(read(notes).includes(pkg.version), "current release notes must name package version");

const prepare = pkg.scripts["prepare-release"] || "";
assert.equal(prepare, "node scripts/sync-version.mjs && node scripts/build.mjs");
assert.doesNotMatch(prepare, /(?:upgrade-|prepare-runtime-pipeline-beta|beta\d+)/);

console.log(`${pkg.version} documentation contract checks passed`);
