import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const source = await readFile(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");
const dist = await readFile(new URL("../dist/navimower-map-card.js", import.meta.url), "utf8");
const upgrade = await readFile(new URL("../scripts/upgrade-underlay-resilience-beta15.mjs", import.meta.url), "utf8");

assert.equal(packageJson.version, "0.3.6-beta15");
assert.match(packageJson.scripts["prepare-release"], /upgrade-underlay-resilience-beta15\.mjs/);
assert.match(packageJson.scripts.test, /underlay-resilience-beta15\.mjs/);

for (const runtime of [source, dist]) {
  assert.match(runtime, /0\.3\.6-beta15: single-underlay metadata isolation and null-safe coordinates/);

  for (const name of ["finite", "finite10", "finite11", "finite14"]) {
    const pattern = new RegExp(
      `const ${name} = \\(value, fallback = null\\) => \\{\\s*if \\(value === null \\|\\| value === undefined \\|\\| value === ""\\) return fallback;`,
    );
    assert.match(runtime, pattern, `${name} must reject null/undefined/empty values`);
  }

  assert.match(runtime, /const frontendUnderlayMetadata = \(card\) => \{[\s\S]*?const single = card\?\._mapPayload\?\.frontend\?\.map_underlays;[\s\S]*?const multiVisible = Boolean\(card\?\._multi036Layer && card\._multi036Layer\.style\.display !== "none"\);[\s\S]*?if \(!multiVisible && single && typeof single === "object"\) return single;/);
  assert.match(runtime, /const providerFrontend13 = \(card\) => \{[\s\S]*?const single = card\?\._mapPayload\?\.frontend;[\s\S]*?const multiVisible = Boolean\(card\?\._multi036Layer && card\._multi036Layer\.style\.display !== "none"\);[\s\S]*?if \(!multiVisible && single && typeof single === "object"\) return single;/);
}

// The card only isolates Single/Multi metadata and validates numeric values. It
// must not grow mower-model or datum-specific correction policy.
assert.doesNotMatch(upgrade, /x3_rtk_anchor/i);
assert.doesNotMatch(upgrade, /vendor_map_static_fit/i);
assert.doesNotMatch(upgrade, /epsg:?\s*8366/i);
assert.doesNotMatch(upgrade, /etrs89/i);

console.log("0.3.6-beta15 underlay resilience regression checks passed");
