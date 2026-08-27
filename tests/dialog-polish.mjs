import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const source = readFileSync("src/navimower-map-card.js", "utf8");
const upgrade = readFileSync("scripts/upgrade-dialog-polish.mjs", "utf8");

assert.equal(pkg.version, "0.3.5-beta14");
assert.match(source, /0\.3\.5-beta14: consistent card-dialog backdrop closing and schedule header alignment/);

// Settings and managed Schedule close only when the backdrop itself is clicked.
assert.match(source, /event\.target !== root/);
assert.match(source, /\[data-beta8-settings-root\]/);
assert.match(source, /\[data-beta8-settings-close\]/);
assert.match(source, /\[data-beta11-root\], \[data-beta2-root\]/);
assert.match(source, /\[data-beta11-close\], \[data-beta2-close\]/);

// The two-line managed Schedule heading must leave the close button at top-right.
assert.match(source, /head\.style\.alignItems = "flex-start"/);
assert.match(source, /copy\.style\.flex = "1 1 auto"/);
assert.match(source, /close\.style\.marginLeft = "auto"/);
assert.match(source, /close\.style\.flex = "0 0 auto"/);

// Keep the existing dashboard sizing contract unchanged: full width, automatic height.
const gridBlock = source.match(/function defaultGridOptions\(\) \{([\s\S]*?)\n\}/)?.[1] || "";
assert.match(gridBlock, /columns: "full"/);
assert.doesNotMatch(gridBlock, /\brows\s*:/);

// Prepare-release must own the deterministic runtime patch and tests stay read-only.
assert.match(upgrade, /Expected beta13 marker was not found/);
assert.match(pkg.scripts["prepare-release"], /upgrade-dialog-polish\.mjs/);
assert.match(pkg.scripts.test, /dialog-polish\.mjs/);

console.log("beta14 dialog polish and grid sizing regression checks passed");
