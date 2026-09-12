import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const source = await readFile(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");
const dist = await readFile(new URL("../dist/navimower-map-card.js", import.meta.url), "utf8");
const notes = await readFile(new URL("../.github/release-notes/0.3.6-beta18.md", import.meta.url), "utf8");

assert.equal(packageJson.version, "0.3.6-beta18");
assert.match(packageJson.scripts["prepare-release"], /upgrade-beta18-gate-area-polygons\.mjs/);
assert.match(packageJson.scripts.test, /beta18-gate-area-polygons\.mjs/);
assert.equal(dist, source, "dist must remain the deterministic single-file build");
assert.match(notes, /Exact polygon gate areas/);

for (const runtime of [source, dist]) {
  assert.match(runtime, /0\.3\.6-beta18: exact polygon gate-area rendering in Single and Multi mower views/);

  // Single mower: polygon geometry participates in layout bounds and is rendered
  // directly. Legacy min/max rows keep their existing rectangle fallback.
  assert.match(runtime, /gateAreas\.forEach\(\(channel\) => \{\s*const polygon = \(Array\.isArray\(channel\?\.polygon\)/);
  assert.match(runtime, /polygon\.forEach\(\(point\) => stable\.push\(point\)\)/);
  assert.match(runtime, /<polygon points="\$\{this\._pointString\(polygon\)\}"[^>]*gate_area_color/);
  assert.match(runtime, /const x1 = sx\(Number\(channel\.x_min\)\);[\s\S]*?<rect x=/);

  // Multi mower: use the same mower-local polygon inside the member SVG matrix,
  // with the previous rectangle retained only as compatibility fallback.
  assert.match(runtime, /const polygon = rawPoints036\(gate\?\.polygon\);/);
  assert.match(runtime, /<polygon points=\\"" \+ polygon \+ "\\"[^\n]*gate_area_color/);
  assert.match(runtime, /continue;\s*}\s*const x1 = finite036\(gate\?\.x_min, null\)/);
}

console.log("0.3.6-beta18 exact polygon gate-area rendering checks passed");
