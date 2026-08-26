import assert from "node:assert/strict";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = new URL("../", import.meta.url);
const source = new URL("../src/navimower-map-card.js", import.meta.url);
const upgrade = new URL("../scripts/upgrade-mower-visibility.mjs", import.meta.url);
const tempDir = await mkdtemp(join(tmpdir(), "navimower-mower-visibility-"));
const tempSource = join(tempDir, "navimower-map-card.mjs");

try {
  await copyFile(source, tempSource);
  execFileSync(process.execPath, [upgrade.pathname], {
    cwd: new URL(".", root),
    env: { ...process.env, NAVIMOWER_MAP_CARD_SOURCE: tempSource },
    stdio: "pipe",
  });

  const patched = await readFile(tempSource, "utf8");
  assert.equal((patched.match(/0\.3\.5-beta5: resilient mower artwork visibility\./g) || []).length, 1);
  assert.match(patched, /state\?\.attributes\?\.model/);
  assert.match(patched, /card\._mowerModelResolved032 = true/);
  assert.doesNotMatch(patched, /config\/device_registry\/list[^\n]*beta5/);

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
  globalThis.requestAnimationFrame = (callback) => {
    callback();
    return 1;
  };
  globalThis.cancelAnimationFrame = () => {};

  await import(pathToFileURL(tempSource).href + `?t=${Date.now()}`);
  const Card = customElements.get("navimower-map-card");
  assert.equal(typeof Card, "function");

  const card = new Card();
  card._config = { mower_icon: "auto" };
  card._resolved = { mower_entity: "lawn_mower.test" };
  card._hass = {
    states: {
      "lawn_mower.test": { state: "mowing", attributes: {} },
    },
  };

  const fallback = card._syncMowerArtworkModel035();
  assert.deepEqual(fallback, { model: "", resolved: true });
  assert.equal(card._mowerModelResolved032, true, "unresolved auto artwork must use the safe fallback instead of hiding");

  card._mowerArtworkKey032 = "h2";
  card._mowerRenderKey = "old";
  card._hass.states["lawn_mower.test"].attributes.model = "H215";
  const detected = card._syncMowerArtworkModel035();
  assert.deepEqual(detected, { model: "H215", resolved: true });
  assert.equal(card._mowerArtworkKey032, null, "new model metadata must invalidate fallback artwork");
  assert.equal(card._mowerRenderKey, null, "new model metadata must force a mower rerender");

  console.log("Mower visibility regression checks passed");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
