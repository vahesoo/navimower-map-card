import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/navimower-map-card.js", import.meta.url), "utf8");
const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
const manual = await readFile(new URL("../examples/manual-entities.yaml", import.meta.url), "utf8");
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

assert.match(pkg.version, /^0\.3\.7(?:-|$)/);

for (const obsolete of [
  "osm_underlay_opacity",
  "notification_page_size",
  "mower_body_color",
  "mower_accent_color",
  "_multi036NotificationPage",
  "applyLimit",
]) {
  assert.ok(!source.includes(obsolete), `Legacy runtime field/helper remains: ${obsolete}`);
}

for (const obsoletePattern of [
  /\bconfig\??\.mower_entity\b/,
  /\bincoming\.mower_entity\b/,
  /\bthis\._config\??\.mower_entity\b/,
  /\bcard\?\._config\?\.mower_entity\b/,
  /^\s*mower_entity:\s*null,/m,
  /^\s*session_count:\s*\d+/m,
  /\._config\??\.session_count\b/,
]) {
  assert.doesNotMatch(source, obsoletePattern, `Legacy YAML compatibility pattern remains: ${obsoletePattern}`);
}

// Internal resolved/backend metadata keeps its canonical mower_entity property.
assert.match(source, /resolved\.mower_entity/);
assert.match(source, /mower_entity: entities\.mower/);

// Canonical replacements stay active.
assert.match(source, /underlay_opacity/);
assert.match(source, /notification_count/);
assert.match(source, /visibleItems = items\.slice\(0, notificationCount\(card\._config \|\| \{\}\)\)/);
assert.doesNotMatch(source, /data-multi-notification-page/);
assert.doesNotMatch(source, /nm-multi-notification-page/);

// History no longer carries the retired max-session limiter.
assert.match(source, /_sessionRecords\(\) \{/);
assert.match(source, /proto\._sessionRecords = function patchedSessionRecords\(\) \{/);
assert.doesNotMatch(source, /Maximum sessions shown/);

// Public docs/examples expose only canonical user-facing keys.
assert.doesNotMatch(readme, /osm_underlay_opacity|notification_page_size|\bmower_entity\b|\bsession_count\b/);
assert.match(readme, /underlay_opacity/);
assert.doesNotMatch(manual, /^mower_entity:/m);
assert.match(manual, /^entity:\s*lawn_mower\./m);

console.log("0.3.7-beta25 legacy config cleanup regression checks passed");
