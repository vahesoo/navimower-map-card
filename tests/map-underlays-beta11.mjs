import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const source = await readFile(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");
const dist = await readFile(new URL("../dist/navimower-map-card.js", import.meta.url), "utf8");

assert.match(packageJson.version, /^0\.3\.6-beta\d+$/);
assert.ok(Number(packageJson.version.split("beta")[1]) >= 11);
assert.match(packageJson.scripts["prepare-release"], /upgrade-map-underlays-beta11\.mjs/);
assert.match(packageJson.scripts.test, /map-underlays-beta11\.mjs/);

for (const runtime of [source, dist]) {
  assert.match(runtime, /0\.3\.6-beta11: unified map underlays, Estonia hybrid and Google Satellite/);
  for (const provider of ["openstreetmap", "estonia_orthophoto", "estonia_hybrid", "google_satellite"]) {
    assert.ok(runtime.includes(provider), `missing underlay provider ${provider}`);
  }
  for (const label of ["OpenStreetMap", "Ortofoto", "Hübriid", "Google Satellite", "Underlay opacity"]) {
    assert.ok(runtime.includes(label), `missing editor label ${label}`);
  }
  assert.match(runtime, /underlay_opacity/);
  assert.match(runtime, /osm_underlay_opacity/);
  assert.match(runtime, /hybriid@GMC/);
  assert.match(runtime, /EESTIFOTO,HYBRID/);
  assert.match(runtime, /tile_api_path_template/);
  assert.match(runtime, /viewport_api_path/);
  assert.match(runtime, /data-nm-google-path/);
  assert.match(runtime, /callApiRaw/);
  assert.match(runtime, /fetchWithAuth/);
  assert.match(runtime, /URL\.createObjectURL/);
  assert.match(runtime, /URL\.revokeObjectURL/);
  assert.match(runtime, /maxZoomRects/);
  assert.match(runtime, /Google Maps/);
  assert.match(runtime, /frontendUnderlayMetadata/);
  assert.match(runtime, /metadata\?\.google_satellite\?\.available === true/);
  assert.match(runtime, /providerMaxZoom/);
  assert.match(runtime, /fastHash\(markup\)/);
}

assert.doesNotMatch(source, /google.*api.*key/i);
assert.doesNotMatch(source, /AIza[0-9A-Za-z_-]+/);

console.log("0.3.6-beta11 unified map underlay regression checks passed");
