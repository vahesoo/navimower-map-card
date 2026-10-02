import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");
const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));

assert.equal(pkg.version, "0.4.0-beta7");

const singleTail = source.indexOf('class="nm-session-path nm-live-tail"');
assert.ok(singleTail >= 0, "missing Single live tail");
const singleClose = source.indexOf("/>", singleTail);
assert.match(source.slice(singleTail, singleClose), /vector-effect="non-scaling-stroke"/);

const multiClasses = [
  "nm-multi-live-trail nm-semantic-live-cutting",
  "nm-multi-live-trail nm-prepared-live-route",
  "nm-multi-live-trail nm-live-tail",
  "nm-multi-live-trail",
];

for (const cssClass of multiClasses) {
  const marker = 'class=\\\"' + cssClass + '\\\"';
  const index = source.indexOf(marker);
  assert.ok(index >= 0, `missing Multi live trail markup: ${cssClass}`);
  const close = source.indexOf('/>");', index);
  assert.ok(close > index);
  const markup = source.slice(index, close);
  assert.match(markup, /vector-effect=\\\"non-scaling-stroke\\\"/);
}

assert.match(source, /v0\.4\.0-beta7 loaded/);
console.log("beta7 live trail zoom contract OK");
