import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const registry = new Map();
globalThis.HTMLElement = class {};
globalThis.customElements = {
  define(name, constructor) { registry.set(name, constructor); },
  get(name) { return registry.get(name); },
};
globalThis.window = { customCards: [] };
globalThis.Event = class {
  constructor(type, options = {}) { this.type = type; Object.assign(this, options); }
};

await import(new URL("../src/navimower-map-card.js", import.meta.url).href);
const source = await readFile(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const Card = customElements.get("navimower-map-card");

assert.equal(pkg.version, "0.3.7-beta26");
assert.equal(typeof Card, "function");

const findSchema = (node, name) => {
  if (!node || typeof node !== "object") return null;
  if (node.name === name) return node;
  for (const child of Array.isArray(node.schema) ? node.schema : []) {
    const found = findSchema(child, name);
    if (found) return found;
  }
  return null;
};

const googleOption = () => {
  const form = Card.getConfigForm();
  const field = findSchema(form, "map_underlay");
  assert.ok(field, "Map underlay field is missing");
  const option = field.selector?.select?.options?.find((item) => item?.value === "google_satellite");
  assert.ok(option, "Google Satellite option is missing");
  return option;
};

Card.__navimowerGoogleSatelliteConfigured = false;
Card.__navimowerGoogleSatelliteAvailable = false;
let option = googleOption();
assert.equal(option.disabled, true);
assert.equal(option.label, "Google Satellite — requires Google Map Tiles API setup");

Card.__navimowerGoogleSatelliteConfigured = true;
Card.__navimowerGoogleSatelliteAvailable = false;
option = googleOption();
assert.equal(option.disabled, true);
assert.equal(option.label, "Google Satellite — check Google Map Tiles API setup");

Card.__navimowerGoogleSatelliteConfigured = true;
Card.__navimowerGoogleSatelliteAvailable = true;
option = googleOption();
assert.equal(option.disabled, false);
assert.equal(option.label, "Google Satellite");

for (const needle of [
  "rememberGoogleSatelliteAvailability",
  "Card.__navimowerGoogleSatelliteConfigured = google.configured",
  "Card.__navimowerGoogleSatelliteAvailable = google.available",
  "disabled: !googleAvailable",
]) {
  assert.ok(source.includes(needle), `Missing beta26 Google underlay capability contract: ${needle}`);
}

console.log("0.3.7-beta26 Google Satellite editor availability checks passed");
