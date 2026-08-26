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

const frames = [];
globalThis.requestAnimationFrame = (callback) => {
  frames.push(callback);
  return frames.length;
};
globalThis.cancelAnimationFrame = () => {};

await import("../src/navimower-map-card.js");
const source = await readFile(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");
const Card = customElements.get("navimower-map-card");
assert.equal(typeof Card, "function");
assert.equal((source.match(/0\.3\.5-beta4: flattened hot-path and phased visual render pipeline\./g) || []).length, 1);

const card = new Card();
assert.deepEqual(card._performanceRenderPhases035(), [
  ["dialog"],
  ["shell", "message", "history", "trail"],
  ["mower"],
  ["footer", "controls"],
  ["sessions"],
]);

const calls = [];
for (const name of ["Shell", "History", "Trail", "Mower", "Footer", "Controls", "Sessions", "Message"]) {
  card[`_render${name}`] = () => calls.push(name.toLowerCase());
}
card._pendingRender = {};
card._renderHandle = null;
card._queueRender({ shell: true, history: true, trail: true, mower: true, footer: true, controls: true, sessions: true, message: true });
assert.equal(frames.length, 1);
while (frames.length) frames.shift()();
assert.deepEqual(calls, [
  "shell",
  "message",
  "history",
  "trail",
  "mower",
  "footer",
  "controls",
  "sessions",
]);

// A user-opened dialog gets first-frame priority over queued map/chrome work.
const dialogCard = new Card();
const dialogCalls = [];
dialogCard._renderDialog = () => dialogCalls.push("dialog");
dialogCard._renderTrail = () => dialogCalls.push("trail");
dialogCard._pendingRender = {};
dialogCard._renderHandle = null;
dialogCard._queueRender({ trail: true, dialog: true });
frames.shift()();
assert.deepEqual(dialogCalls, ["dialog"]);
frames.shift()();
assert.deepEqual(dialogCalls, ["dialog", "trail"]);

// Closed optional dialogs stay outside the normal hass compatibility chain.
const hassDescriptor = Object.getOwnPropertyDescriptor(Card.prototype, "hass");
assert.equal(typeof hassDescriptor?.set, "function");
const hotCard = new Card();
hotCard._config = { auto_entities: false };
hotCard._domReady = true;
hotCard._resolved = {
  mower_entity: "lawn_mower.test",
  status_entity: "lawn_mower.test",
  x_entity: "sensor.x",
  y_entity: "sensor.y",
  heading_entity: "sensor.heading",
  battery_entity: "sensor.battery",
  zone_entity: "sensor.zone",
};
hotCard._resolveEntities = () => {};
let mapChecks = 0;
let liveChecks = 0;
hotCard._maybeLoadMap = () => { mapChecks += 1; };
hotCard._updateLive = () => { liveChecks += 1; };
const hass = {
  states: {
    "lawn_mower.test": { state: "docked", last_updated: "1", last_changed: "1", attributes: {} },
    "sensor.x": { state: "1", last_updated: "1", last_changed: "1", attributes: {} },
    "sensor.y": { state: "2", last_updated: "1", last_changed: "1", attributes: {} },
    "sensor.heading": { state: "90", last_updated: "1", last_changed: "1", attributes: {} },
    "sensor.battery": { state: "80", last_updated: "1", last_changed: "1", attributes: {} },
    "sensor.zone": { state: "Yard", last_updated: "1", last_changed: "1", attributes: {} },
  },
  services: { navimower: { resume: {}, set_schedule_queue: {} } },
};
hassDescriptor.set.call(hotCard, hass);
assert.equal(mapChecks, 1);
assert.equal(liveChecks, 1);
hassDescriptor.set.call(hotCard, { ...hass, states: { ...hass.states, "sensor.unrelated": { state: "changed", last_updated: "2" } } });
assert.equal(mapChecks, 1, "unrelated HA states must not trigger map work");
assert.equal(liveChecks, 1, "unrelated HA states must not trigger live render work");

console.log("Performance pipeline regression checks passed");
