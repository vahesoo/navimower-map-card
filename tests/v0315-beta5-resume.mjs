import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  NAVIMOWER_MAP_CARD_V039R_VERSION,
  resumeServiceAvailable,
  resumeStateKind,
  shouldOfferResume,
} from "../src/navimower-map-card-v039r.js";

assert.equal(NAVIMOWER_MAP_CARD_V039R_VERSION, "0.3.1-beta5");

const noService = { services: { navimower: {} } };
const withService = { services: { navimower: { resume: { name: "Resume" } } } };
assert.equal(resumeServiceAvailable(noService), false);
assert.equal(resumeServiceAvailable(withService), true);
assert.equal(resumeServiceAvailable({}), false);

assert.equal(resumeStateKind({ state: "paused", attributes: {} }), "paused");
assert.equal(resumeStateKind({ state: "docked", attributes: {} }), "docked");
assert.equal(resumeStateKind({ state: "charging", attributes: {} }), "charging");
assert.equal(resumeStateKind({ state: "idle", attributes: { docked: true } }), "docked");
assert.equal(resumeStateKind({ state: "returning", attributes: {} }), null);
assert.equal(resumeStateKind({ state: "mowing", attributes: {} }), null);

assert.equal(shouldOfferResume(withService, { state: "paused", attributes: {} }), true);
assert.equal(shouldOfferResume(withService, { state: "docked", attributes: {} }), true);
assert.equal(shouldOfferResume(withService, { state: "charging", attributes: {} }), true);
assert.equal(shouldOfferResume(withService, { state: "mowing", attributes: {} }), false);
assert.equal(shouldOfferResume(noService, { state: "paused", attributes: {} }), false);

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
assert.equal(packageJson.version, "0.3.1-beta5");
assert.match(packageJson.scripts.check, /navimower-map-card-0\.3\.1-b5\.js/);
assert.match(packageJson.scripts.check, /navimower-map-card-v039r\.js/);
assert.match(packageJson.scripts.test, /v0315-beta5-resume\.mjs/);

const hacs = JSON.parse(readFileSync("hacs.json", "utf8"));
assert.equal(hacs.filename, "navimower-map-card-0.3.1-b5.js");

const notes = readFileSync(".github/release-notes/0.3.1-beta5.md", "utf8");
assert.match(notes, /navimower\.resume/);
assert.match(notes, /paused, docked, or charging/i);
assert.match(notes, /field validation/i);

for (const root of ["src", "dist"]) {
  const currentLoader = readFileSync(`${root}/navimower-map-card.js`, "utf8");
  const beta5Loader = readFileSync(`${root}/navimower-map-card-0.3.1-b5.js`, "utf8");
  const layer = readFileSync(`${root}/navimower-map-card-v039r.js`, "utf8");

  assert.match(currentLoader, /NAVIMOWER_MAP_CARD_VERSION = "0\.3\.1-beta5"/);
  assert.match(beta5Loader, /NAVIMOWER_MAP_CARD_VERSION = "0\.3\.1-beta5"/);
  assert.match(currentLoader, /navimower-map-card-v039r\.js/);
  assert.match(beta5Loader, /navimower-map-card-v039r\.js/);

  assert.match(layer, /callService\("navimower", "resume"/);
  assert.match(layer, /data\.command = "resume"|dataset\.command = "resume"/);
  assert.match(layer, /nm-has-resume/);
  assert.match(layer, /resumeServiceAvailable\(this\._hass\) && this\._isPausedJob/);
  assert.match(layer, /openNewMowDialog\(this\)/);
  assert.doesNotMatch(layer, /callService\("lawn_mower", "start_mowing"/);
  assert.doesNotMatch(layer, /mark_notification_read|mark_all_notifications_read/);
}

assert.equal(
  readFileSync("src/navimower-map-card-v039r.js", "utf8"),
  readFileSync("dist/navimower-map-card-v039r.js", "utf8"),
);
assert.equal(
  readFileSync("src/navimower-map-card-0.3.1-b5.js", "utf8"),
  readFileSync("dist/navimower-map-card-0.3.1-b5.js", "utf8"),
);

console.log("0.3.1-beta5 Resume control checks passed");
