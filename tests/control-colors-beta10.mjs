import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync("src/navimower-map-card.js", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
assert.equal(pkg.version, "0.4.0-beta10");

const single = src.slice(src.indexOf("function ensureStyles(card) {"), src.indexOf("function resumeTarget(card) {"));
const multi = src.slice(src.indexOf('".nm-multi-command-grid{display:grid;'), src.indexOf('".nm-multi-command-status{', src.indexOf('".nm-multi-command-grid{display:grid;')));

// Stable backgrounds: blue Resume/Mow, gray Pause/Dock. A disabled control
// stays opaque, retaining its background while its label and icon turn dark.
assert.match(single, /\.nm-control\.nm-resume \{ color: var\(--text-primary-color, #fff\);\s*background: var\(--primary-color, #03a9f4\);/);
assert.match(single, /\.nm-control:disabled \{\s*opacity: 1; color: #374151;/);
assert.match(single, /\.nm-control\[data-command="pause"\]:not\(:disabled\)/);
assert.match(single, /\.nm-control\[data-command="dock"\]:not\(:disabled\)/);
assert.match(single, /color: #38bdf8/);
assert.match(single, /\.nm-control:disabled \{ color: #374151; opacity: 1; \}/);
assert.match(single, /\.nm-control ha-icon \{ color: inherit; \}/);
assert.doesNotMatch(single, /background: var\(--disabled-color/);

assert.match(multi, /\[data-multi-command=mow\],\.nm-multi-command-grid \[data-multi-command=resume\]\{color:var\(--text-primary-color,#fff\);background:var\(--primary-color,#03a9f4\)/);
assert.match(multi, /button:disabled\{opacity:1;color:#374151!important;box-shadow:none;cursor:default\}/);
assert.match(multi, /\[data-multi-command=pause\]:not\(:disabled\)/);
assert.match(multi, /\[data-multi-command=dock\]:not\(:disabled\)\{color:#38bdf8\}/);
assert.match(multi, /ha-icon\{--mdc-icon-size:19px;color:inherit\}/);
assert.doesNotMatch(multi, /background:var\(--disabled-color/);
console.log("0.4.0-beta10 stable button backgrounds and readable enabled/disabled labels verified");
