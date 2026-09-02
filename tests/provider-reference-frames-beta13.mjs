import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const source = await readFile(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");
const dist = await readFile(new URL("../dist/navimower-map-card.js", import.meta.url), "utf8");
const upgrade = await readFile(new URL("../scripts/upgrade-provider-reference-frames-beta13.mjs", import.meta.url), "utf8");

assert.equal(packageJson.version, "0.3.6-beta13");
assert.match(packageJson.scripts["prepare-release"], /upgrade-provider-reference-frames-beta13\.mjs/);
assert.match(packageJson.scripts.test, /provider-reference-frames-beta13\.mjs/);

for (const runtime of [source, dist]) {
  assert.match(runtime, /0\.3\.6-beta13: integration-owned provider reference frames/);
  assert.match(runtime, /providerFrontend13/);
  assert.match(runtime, /providerFrameName13/);
  assert.match(runtime, /providerGeoreference13/);
  assert.match(runtime, /providerSiteOrigin13/);
  assert.match(runtime, /georeference_frames/);
  assert.match(runtime, /underlay_origins/);
  assert.match(runtime, /reference_frame/);
  assert.match(runtime, /"web_wgs84"/);
  assert.match(runtime, /"regional_cartographic"/);
  assert.match(runtime, /const geo = providerGeoreference13\(card, activeGeo\)/);
  assert.match(runtime, /const origin = providerSiteOrigin13\(card, site\)/);
  assert.match(runtime, /beta12_compatibility_fallback/);
  assert.match(runtime, /googleDynamicGeoreference12\(card, activeGeo\)/);
  assert.match(runtime, /googleDynamicSiteOrigin12\(card, site\?\.origin \|\| \{\}\)/);
}

// Provider selection belongs to integration metadata / semantic frame names,
// never mower model identifiers or an EPSG calculation in the card.
assert.doesNotMatch(upgrade, /x3_rtk_anchor/i);
assert.doesNotMatch(upgrade, /vendor_map_static_fit/i);
assert.doesNotMatch(upgrade, /epsg:?\s*8366/i);
assert.doesNotMatch(upgrade, /etrs89/i);

console.log("0.3.6-beta13 provider reference frame regression checks passed");
