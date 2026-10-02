import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");
const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));

assert.equal(pkg.version, "0.4.0-beta7");

const liveNeedles = [
  'class="nm-session-path nm-live-tail"',
  'class="nm-multi-live-trail nm-semantic-live-cutting"',
  'class="nm-multi-live-trail nm-prepared-live-route"',
  'class="nm-multi-live-trail nm-live-tail"',
  'class="nm-multi-live-trail"',
];

for (const needle of liveNeedles) {
  const index = source.indexOf(needle);
  assert.ok(index >= 0, `missing live trail markup: ${needle}`);
  const close = source.indexOf('/>', index);
  assert.ok(close > index);
  const markup = source.slice(index, close);
  assert.match(markup, /vector-effect=.*non-scaling-stroke/);
}

assert.match(source, /v0\.4\.0-beta7 loaded/);
console.log("beta7 live trail zoom contract OK");
